import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { helpdeskClients, helpdeskTickets, helpdeskMessages } from '@/lib/schema'
import { ilike, or } from 'drizzle-orm'
import { eq } from 'drizzle-orm'
import { generateTicketNumber } from '@/lib/ticket-number'
import { triageTicket } from '@/lib/ai/triage'
import { getResendClient, FROM_ADDRESS } from '@/lib/resend'
import { auditLog } from '@/lib/audit'

export async function POST(req: NextRequest) {
  // Auth: validate internal secret from bts-site
  const secret = req.headers.get('x-internal-secret')
  const expectedSecret = process.env.HELPDESK_INTERNAL_SECRET?.trim()

  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { callSid, callerNumber, transcription, recordingUrl } = body

  if (!callSid || !transcription) {
    return NextResponse.json({ error: 'callSid and transcription required' }, { status: 400 })
  }

  // Look up caller by phone number
  const last10 = callerNumber?.replace(/\D/g, '').slice(-10)
  let client = null

  if (last10) {
    const results = await db
      .select()
      .from(helpdeskClients)
      .where(ilike(helpdeskClients.phone, `%${last10}%`))
      .limit(1)
    client = results[0] ?? null
  }

  const ticketNumber = await generateTicketNumber()

  const [ticket] = await db
    .insert(helpdeskTickets)
    .values({
      ticketNumber,
      subject: `Voicemail from ${callerNumber ?? 'Unknown'}`,
      category: 'Internal Task', // AI will override
      priority: 'normal',
      clientId: client?.id ?? null,
      source: 'phone',
      isInternal: !client, // unknown callers get internal-only tickets
    })
    .returning()

  await db.insert(helpdeskMessages).values({
    ticketId: ticket.id,
    content: transcription,
    source: 'phone',
    callSid,
    recordingUrl,
    transcription,
    isInternal: false,
  })

  // AI triage (non-blocking)
  triageTicket({
    subject: `Voicemail from ${callerNumber ?? 'Unknown'}`,
    body: transcription,
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
          subject: `${result.summary} (voicemail from ${callerNumber ?? 'Unknown'})`,
        })
        .where(eq(helpdeskTickets.id, ticket.id))

      // Notify Erick
      try {
        const resend = getResendClient()
        await resend.emails.send({
          from: FROM_ADDRESS,
          to: 'erick@tronboll.us',
          subject: `[${ticketNumber}] Voicemail — ${client?.clientName ?? callerNumber ?? 'Unknown'}`,
          html: `
            <div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#0d1117">
              <h2 style="color:#c2410c;margin:0 0 16px;font-size:1.1rem">Voicemail → Helpdesk Ticket</h2>
              <table style="width:100%;border-collapse:collapse">
                <tr><td style="color:#94a3b8;padding:4px 0;width:80px">Ticket</td><td style="color:#e2e8f0">${ticketNumber}</td></tr>
                <tr><td style="color:#94a3b8;padding:4px 0">Caller</td><td style="color:#e2e8f0">${callerNumber ?? 'Unknown'}</td></tr>
                <tr><td style="color:#94a3b8;padding:4px 0">Client</td><td style="color:#e2e8f0">${client?.clientName ?? 'Unknown caller'}</td></tr>
                <tr><td style="color:#94a3b8;padding:4px 0">Category</td><td style="color:#e2e8f0">${result.category}</td></tr>
                <tr><td style="color:#94a3b8;padding:4px 0">Priority</td><td style="color:#e2e8f0">${result.priority}</td></tr>
                <tr><td style="color:#94a3b8;padding:4px 0;vertical-align:top">Transcript</td><td style="color:#e2e8f0;line-height:1.6">${transcription}</td></tr>
              </table>
              ${recordingUrl ? `<div style="margin-top:16px"><a href="${recordingUrl}.mp3" style="display:inline-block;padding:8px 20px;background:#31b9ce;color:#fff;text-decoration:none;border-radius:6px;font-size:0.875rem">Listen to Recording</a></div>` : ''}
            </div>
          `,
        })
      } catch (e) {
        console.error('[twilio-inbound] Failed to notify admin:', e)
      }
    })
    .catch((e) => console.error('[twilio-inbound] Triage failed:', e))

  await auditLog({
    entityType: 'ticket',
    entityId: ticket.id,
    action: 'created',
    userId: 'system',
    afterData: { ticketNumber, source: 'phone', callSid, callerNumber },
  })

  return NextResponse.json({ ok: true, ticketNumber })
}
