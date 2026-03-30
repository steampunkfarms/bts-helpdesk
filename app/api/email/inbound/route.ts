import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { db } from '@/lib/db'
import {
  helpdeskClientEmails, helpdeskClients, helpdeskTickets,
  helpdeskMessages, helpdeskUsers,
} from '@/lib/schema'
import { eq, or } from 'drizzle-orm'
import { generateTicketNumber } from '@/lib/ticket-number'
import { getResendClient, FROM_ADDRESS } from '@/lib/resend'
import { triageTicket } from '@/lib/ai/triage'
import { auditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'

// MUST always return 200 — Resend fires account-wide webhooks to ALL endpoints.
// Non-200 responses cause Resend to suspend the domain.

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()

    // Verify svix signature
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET?.trim()
    if (!webhookSecret) {
      console.error('[INBOUND] RESEND_WEBHOOK_SECRET not set')
      return NextResponse.json({ received: true })
    }

    const svixId = req.headers.get('svix-id')
    const svixTimestamp = req.headers.get('svix-timestamp')
    const svixSignature = req.headers.get('svix-signature')

    if (!svixId || !svixTimestamp || !svixSignature) {
      return NextResponse.json({ received: true })
    }

    let event: { type: string; data: Record<string, unknown> }
    try {
      const wh = new Webhook(webhookSecret)
      event = wh.verify(rawBody, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as typeof event
    } catch {
      console.error('[INBOUND] Svix verification failed')
      return NextResponse.json({ received: true })
    }

    // Only process email.received events
    if (event.type !== 'email.received') {
      return NextResponse.json({ received: true, action: 'ignored', reason: event.type })
    }

    const data = event.data
    const from = (data.from as string) ?? ''
    const to = (data.to as string[]) ?? []
    const subject = (data.subject as string) ?? '(no subject)'
    const text = (data.text as string) ?? ''
    const html = (data.html as string) ?? ''

    // Check if this email is for the helpdesk
    const isForHelpdesk = to.some(
      (addr) =>
        addr.toLowerCase().includes('helpdesk@tronboll.us') ||
        addr.toLowerCase().match(/^ticket\+[a-f0-9-]+@tronboll\.us$/)
    )
    if (!isForHelpdesk) {
      return NextResponse.json({ received: true, action: 'not_for_helpdesk' })
    }

    const senderEmail = from.toLowerCase().trim()

    // Check for ticket reply (ticket+{id}@tronboll.us pattern)
    const ticketIdMatch = to
      .map((addr) => addr.toLowerCase().match(/^ticket\+([a-f0-9-]+)@tronboll\.us$/))
      .find(Boolean)

    if (ticketIdMatch) {
      const ticketId = ticketIdMatch[1]
      const tickets = await db
        .select()
        .from(helpdeskTickets)
        .where(eq(helpdeskTickets.id, ticketId))
        .limit(1)

      if (tickets[0]) {
        await db.insert(helpdeskMessages).values({
          ticketId: tickets[0].id,
          content: text || html,
          contentHtml: html || undefined,
          source: 'email',
          emailFrom: senderEmail,
          isInternal: false,
        })

        await db
          .update(helpdeskTickets)
          .set({ status: 'awaiting_tech', updatedAt: new Date() })
          .where(eq(helpdeskTickets.id, tickets[0].id))

        await auditLog({
          entityType: 'ticket',
          entityId: tickets[0].id,
          action: 'email_reply_received',
          userId: senderEmail,
        })

        return NextResponse.json({ received: true, action: 'reply_appended' })
      }
    }

    // New ticket — lookup sender
    const registeredEmails = await db
      .select({ clientId: helpdeskClientEmails.clientId })
      .from(helpdeskClientEmails)
      .where(eq(helpdeskClientEmails.email, senderEmail))
      .limit(1)

    if (!registeredEmails[0]) {
      // Unregistered sender — polite rejection
      try {
        const resend = getResendClient()
        await resend.emails.send({
          from: FROM_ADDRESS,
          to: senderEmail,
          subject: 'Re: ' + subject,
          html: `
            <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
              <p>Thank you for contacting Backcountry Tech Solutions.</p>
              <p>We could not match your email address to an active client account. If you believe this is an error, please call us at <strong>(760) 782-8476</strong>.</p>
            </div>
          `,
        })
      } catch (e) {
        console.error('[INBOUND] Failed to send rejection:', e)
      }

      await auditLog({
        entityType: 'email',
        entityId: senderEmail,
        action: 'rejected_unregistered',
        userId: senderEmail,
      })

      return NextResponse.json({ received: true, action: 'rejected' })
    }

    // Registered sender — create ticket
    const clientId = registeredEmails[0].clientId
    const clients = await db
      .select()
      .from(helpdeskClients)
      .where(eq(helpdeskClients.id, clientId))
      .limit(1)

    const client = clients[0]
    const ticketNumber = await generateTicketNumber()

    const now = new Date()
    const slaResponseDue = client
      ? new Date(now.getTime() + client.responseSlaMin * 60 * 1000)
      : null
    const slaResolutionDue = client
      ? new Date(now.getTime() + client.resolutionSlaDays * 24 * 60 * 60 * 1000)
      : null

    const [ticket] = await db
      .insert(helpdeskTickets)
      .values({
        ticketNumber,
        subject,
        category: 'Internal Task', // AI will override
        priority: 'normal',
        clientId,
        source: 'email',
        isInternal: false,
        slaResponseDue,
        slaResolutionDue,
      })
      .returning()

    await db.insert(helpdeskMessages).values({
      ticketId: ticket.id,
      content: text || html,
      contentHtml: html || undefined,
      source: 'email',
      emailFrom: senderEmail,
      isInternal: false,
    })

    // AI triage (non-blocking)
    triageTicket({
      subject,
      body: text,
      clientName: client?.clientName,
      slaTier: client?.slaTier,
    })
      .then(async (result) => {
        await db
          .update(helpdeskTickets)
          .set({
            aiCategory: result.category,
            aiPriority: result.priority,
            aiSummary: result.summary,
            aiDraftResponse: result.draftResponse,
            aiConfidence: result.confidence,
            category: result.category,
          })
          .where(eq(helpdeskTickets.id, ticket.id))

        // Send auto-reply to sender
        try {
          const resend = getResendClient()
          const slaHours = client ? Math.round(client.responseSlaMin / 60) : 8

          await resend.emails.send({
            from: FROM_ADDRESS,
            to: senderEmail,
            subject: `Re: [${ticketNumber}] ${subject}`,
            replyTo: `ticket+${ticket.id}@tronboll.us`,
            html: `
              <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
                <p>Thanks for contacting BTS Support. Your request has been logged as <strong>Ticket #${ticketNumber}</strong>.</p>
                <table style="width:100%;border-collapse:collapse;margin:16px 0">
                  <tr><td style="color:#6b7280;padding:4px 0;width:120px">Summary</td><td>${result.summary}</td></tr>
                  <tr><td style="color:#6b7280;padding:4px 0">Priority</td><td>${result.priority}</td></tr>
                  <tr><td style="color:#6b7280;padding:4px 0">Expected response</td><td>Within ${slaHours} hours</td></tr>
                </table>
                <p style="color:#6b7280;font-size:0.875rem">Reply to this email to add updates to your ticket.</p>
              </div>
            `,
          })
        } catch (e) {
          console.error('[INBOUND] Failed to send auto-reply:', e)
        }

        // Notify Erick
        try {
          const resend = getResendClient()
          await resend.emails.send({
            from: FROM_ADDRESS,
            to: 'erick@tronboll.us',
            subject: `[${ticketNumber}] ${subject} — ${client?.clientName ?? 'Unknown'}`,
            html: `
              <div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#0d1117">
                <h2 style="color:#c2410c;margin:0 0 16px;font-size:1.1rem">New Helpdesk Ticket</h2>
                <table style="width:100%;border-collapse:collapse">
                  <tr><td style="color:#94a3b8;padding:4px 0;width:80px">Ticket</td><td style="color:#e2e8f0">${ticketNumber}</td></tr>
                  <tr><td style="color:#94a3b8;padding:4px 0">Client</td><td style="color:#e2e8f0">${client?.clientName ?? 'Unknown'}</td></tr>
                  <tr><td style="color:#94a3b8;padding:4px 0">From</td><td style="color:#e2e8f0">${senderEmail}</td></tr>
                  <tr><td style="color:#94a3b8;padding:4px 0">Category</td><td style="color:#e2e8f0">${result.category}</td></tr>
                  <tr><td style="color:#94a3b8;padding:4px 0">Priority</td><td style="color:#e2e8f0">${result.priority}</td></tr>
                  <tr><td style="color:#94a3b8;padding:4px 0;vertical-align:top">Summary</td><td style="color:#e2e8f0">${result.summary}</td></tr>
                </table>
              </div>
            `,
          })
        } catch (e) {
          console.error('[INBOUND] Failed to notify admin:', e)
        }
      })
      .catch((e) => console.error('[INBOUND] Triage failed:', e))

    await auditLog({
      entityType: 'ticket',
      entityId: ticket.id,
      action: 'created',
      userId: senderEmail,
      afterData: { ticketNumber, subject, source: 'email' },
    })

    return NextResponse.json({ received: true, action: 'ticket_created', ticketNumber })
  } catch (e) {
    console.error('[INBOUND] Unhandled error:', e)
    return NextResponse.json({ received: true })
  }
}
