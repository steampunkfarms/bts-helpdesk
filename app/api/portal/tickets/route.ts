import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { helpdeskTickets, helpdeskClients } from '@/lib/schema'
import { eq, and, desc } from 'drizzle-orm'
import { requireClient } from '@/lib/auth'
import { generateTicketNumber } from '@/lib/ticket-number'
import { triageTicket } from '@/lib/ai/triage'
import { auditLog } from '@/lib/audit'

// SAFE columns only — no AI triage fields, no isInternal, no time tracking
const SAFE_TICKET_COLUMNS = {
  id: helpdeskTickets.id,
  ticketNumber: helpdeskTickets.ticketNumber,
  subject: helpdeskTickets.subject,
  category: helpdeskTickets.category,
  priority: helpdeskTickets.priority,
  status: helpdeskTickets.status,
  source: helpdeskTickets.source,
  createdAt: helpdeskTickets.createdAt,
  updatedAt: helpdeskTickets.updatedAt,
  slaResponseDue: helpdeskTickets.slaResponseDue,
  slaResolutionDue: helpdeskTickets.slaResolutionDue,
  firstRespondedAt: helpdeskTickets.firstRespondedAt,
  resolvedAt: helpdeskTickets.resolvedAt,
} as const

export async function GET() {
  const session = await requireClient()

  const tickets = await db
    .select(SAFE_TICKET_COLUMNS)
    .from(helpdeskTickets)
    .where(
      and(
        eq(helpdeskTickets.clientId, session.clientId),
        eq(helpdeskTickets.isInternal, false),
      )
    )
    .orderBy(desc(helpdeskTickets.createdAt))
    .limit(100)

  return NextResponse.json(tickets)
}

export async function POST(req: NextRequest) {
  const session = await requireClient()

  const body = await req.json()
  const { subject, description, priority } = body

  if (!subject || !description) {
    return NextResponse.json({ error: 'Subject and description required' }, { status: 400 })
  }

  // Look up client for SLA
  const clients = await db
    .select({
      clientName: helpdeskClients.clientName,
      slaTier: helpdeskClients.slaTier,
      responseSlaMin: helpdeskClients.responseSlaMin,
      resolutionSlaDays: helpdeskClients.resolutionSlaDays,
    })
    .from(helpdeskClients)
    .where(eq(helpdeskClients.id, session.clientId))
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
      priority: priority ?? 'normal',
      clientId: session.clientId,
      createdByUserId: session.userId,
      source: 'portal',
      isInternal: false,
      isProactive: false,
      slaResponseDue,
      slaResolutionDue,
    })
    .returning(SAFE_TICKET_COLUMNS)

  // Add the description as first message
  const { helpdeskMessages } = await import('@/lib/schema')
  await db.insert(helpdeskMessages).values({
    ticketId: ticket.id,
    authorUserId: session.userId,
    content: description,
    source: 'portal',
    isInternal: false,
  })

  // AI triage (non-blocking)
  triageTicket({
    subject,
    body: description,
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
    })
    .catch((e) => console.error('[portal-tickets] Triage failed:', e))

  await auditLog({
    entityType: 'ticket',
    entityId: ticket.id,
    action: 'created',
    userId: session.email,
    afterData: { ticketNumber, source: 'portal', clientId: session.clientId },
  })

  return NextResponse.json(ticket, { status: 201 })
}
