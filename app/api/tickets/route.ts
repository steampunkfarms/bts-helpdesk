import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { helpdeskTickets, helpdeskMessages, helpdeskClients } from '@/lib/schema'
import { eq, desc, and, or, ilike, sql } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { generateTicketNumber } from '@/lib/ticket-number'
import { auditLog } from '@/lib/audit'
import { triageTicket } from '@/lib/ai/triage'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role === 'client') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = req.nextUrl
  const statusFilter = url.searchParams.get('status')
  const priorityFilter = url.searchParams.get('priority')
  const categoryFilter = url.searchParams.get('category')
  const search = url.searchParams.get('q')

  const conditions = []
  if (statusFilter) conditions.push(eq(helpdeskTickets.status, statusFilter))
  if (priorityFilter) conditions.push(eq(helpdeskTickets.priority, priorityFilter))
  if (categoryFilter) conditions.push(eq(helpdeskTickets.category, categoryFilter))
  if (search) {
    conditions.push(
      or(
        ilike(helpdeskTickets.subject, `%${search}%`),
        ilike(helpdeskTickets.ticketNumber, `%${search}%`)
      )
    )
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const tickets = await db
    .select({
      id: helpdeskTickets.id,
      ticketNumber: helpdeskTickets.ticketNumber,
      subject: helpdeskTickets.subject,
      category: helpdeskTickets.category,
      priority: helpdeskTickets.priority,
      status: helpdeskTickets.status,
      isInternal: helpdeskTickets.isInternal,
      source: helpdeskTickets.source,
      aiSummary: helpdeskTickets.aiSummary,
      slaResponseDue: helpdeskTickets.slaResponseDue,
      slaResolutionDue: helpdeskTickets.slaResolutionDue,
      slaResponseBreached: helpdeskTickets.slaResponseBreached,
      slaResolutionBreached: helpdeskTickets.slaResolutionBreached,
      clientName: helpdeskClients.clientName,
      createdAt: helpdeskTickets.createdAt,
      updatedAt: helpdeskTickets.updatedAt,
    })
    .from(helpdeskTickets)
    .leftJoin(helpdeskClients, eq(helpdeskTickets.clientId, helpdeskClients.id))
    .where(where)
    .orderBy(desc(helpdeskTickets.createdAt))
    .limit(100)

  return NextResponse.json({ tickets })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role === 'client') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { subject, category, priority, clientId, isInternal, description } = body

  if (!subject || !category) {
    return NextResponse.json({ error: 'Subject and category required' }, { status: 400 })
  }

  const ticketNumber = await generateTicketNumber()

  // Calculate SLA deadlines if client-facing
  let slaResponseDue: Date | null = null
  let slaResolutionDue: Date | null = null

  if (clientId && !isInternal) {
    const clients = await db
      .select()
      .from(helpdeskClients)
      .where(eq(helpdeskClients.id, clientId))
      .limit(1)

    if (clients[0]) {
      const now = new Date()
      slaResponseDue = new Date(now.getTime() + clients[0].responseSlaMin * 60 * 1000)
      slaResolutionDue = new Date(now.getTime() + clients[0].resolutionSlaDays * 24 * 60 * 60 * 1000)
    }
  }

  const [ticket] = await db
    .insert(helpdeskTickets)
    .values({
      ticketNumber,
      subject,
      category,
      priority: priority ?? 'normal',
      clientId: clientId ?? null,
      isInternal: isInternal ?? false,
      source: 'portal',
      createdByUserId: session.userId,
      slaResponseDue,
      slaResolutionDue,
    })
    .returning()

  // Create initial message if description provided
  if (description) {
    await db.insert(helpdeskMessages).values({
      ticketId: ticket.id,
      authorUserId: session.userId,
      content: description,
      source: 'portal',
      isInternal: isInternal ?? false,
    })
  }

  // AI triage (non-blocking)
  triageTicket({ subject, body: description ?? '' })
    .then(async (result) => {
      await db
        .update(helpdeskTickets)
        .set({
          aiCategory: result.category,
          aiPriority: result.priority,
          aiSummary: result.summary,
          aiDraftResponse: result.draftResponse,
          aiConfidence: result.confidence,
        })
        .where(eq(helpdeskTickets.id, ticket.id))
    })
    .catch((e) => console.error('[triage] Failed:', e))

  await auditLog({
    entityType: 'ticket',
    entityId: ticket.id,
    action: 'created',
    userId: session.email,
    afterData: { ticketNumber, subject, category, priority: priority ?? 'normal' },
  })

  return NextResponse.json({ ticket }, { status: 201 })
}
