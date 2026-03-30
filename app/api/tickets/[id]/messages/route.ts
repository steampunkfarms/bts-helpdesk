import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { helpdeskMessages, helpdeskTickets, helpdeskClients } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { getResendClient, FROM_ADDRESS } from '@/lib/resend'
import { auditLog } from '@/lib/audit'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session || session.role === 'client') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { content, isInternal } = body

  if (!content) {
    return NextResponse.json({ error: 'Content required' }, { status: 400 })
  }

  // Get ticket
  const tickets = await db
    .select()
    .from(helpdeskTickets)
    .where(eq(helpdeskTickets.id, id))
    .limit(1)

  if (!tickets[0]) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
  }

  const ticket = tickets[0]

  const [message] = await db
    .insert(helpdeskMessages)
    .values({
      ticketId: id,
      authorUserId: session.userId,
      content,
      isInternal: isInternal ?? false,
      source: 'portal',
    })
    .returning()

  // Update ticket status and SLA tracking
  const ticketUpdates: Record<string, unknown> = {
    updatedAt: new Date(),
    status: isInternal ? ticket.status : 'awaiting_client',
  }

  // Track first response time for SLA
  if (!isInternal && !ticket.firstRespondedAt) {
    ticketUpdates.firstRespondedAt = new Date()
  }

  await db
    .update(helpdeskTickets)
    .set(ticketUpdates)
    .where(eq(helpdeskTickets.id, id))

  // Send email to client (if not internal and ticket has a client)
  if (!isInternal && ticket.clientId) {
    try {
      const clients = await db
        .select()
        .from(helpdeskClients)
        .where(eq(helpdeskClients.id, ticket.clientId))
        .limit(1)

      if (clients[0]) {
        const resend = getResendClient()
        const siteUrl = process.env.SITE_URL?.trim() ?? 'https://helpdesk.tronboll.us'

        await resend.emails.send({
          from: FROM_ADDRESS,
          to: clients[0].primaryEmail,
          subject: `Re: [${ticket.ticketNumber}] ${ticket.subject}`,
          replyTo: `ticket+${ticket.id}@tronboll.us`,
          html: `
            <div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
              <p style="color:#4b5563;line-height:1.6">${content.replace(/\n/g, '<br>')}</p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
              <p style="color:#9ca3af;font-size:0.75rem">
                Ticket: ${ticket.ticketNumber} | Status: ${ticketUpdates.status}<br>
                <a href="${siteUrl}/portal/tickets/${ticket.id}">View in portal</a> |
                Reply to this email to respond.
              </p>
            </div>
          `,
        })
      }
    } catch (e) {
      console.error('[message] Failed to send client notification:', e)
    }
  }

  await auditLog({
    entityType: 'message',
    entityId: message.id,
    action: 'created',
    userId: session.email,
    afterData: { ticketId: id, isInternal },
  })

  return NextResponse.json({ message }, { status: 201 })
}
