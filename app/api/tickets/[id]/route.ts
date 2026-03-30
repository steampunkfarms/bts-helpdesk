import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { helpdeskTickets, helpdeskClients, helpdeskUsers, helpdeskMessages } from '@/lib/schema'
import { eq, desc } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { auditLog } from '@/lib/audit'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session || session.role === 'client') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const tickets = await db
    .select()
    .from(helpdeskTickets)
    .where(eq(helpdeskTickets.id, id))
    .limit(1)

  if (!tickets[0]) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const ticket = tickets[0]

  // Get client info
  let client = null
  if (ticket.clientId) {
    const clients = await db
      .select()
      .from(helpdeskClients)
      .where(eq(helpdeskClients.id, ticket.clientId))
      .limit(1)
    client = clients[0] ?? null
  }

  // Get assigned user
  let assignedTo = null
  if (ticket.assignedToUserId) {
    const users = await db
      .select({ id: helpdeskUsers.id, name: helpdeskUsers.name, email: helpdeskUsers.email })
      .from(helpdeskUsers)
      .where(eq(helpdeskUsers.id, ticket.assignedToUserId))
      .limit(1)
    assignedTo = users[0] ?? null
  }

  // Get messages
  const messages = await db
    .select({
      id: helpdeskMessages.id,
      content: helpdeskMessages.content,
      contentHtml: helpdeskMessages.contentHtml,
      isInternal: helpdeskMessages.isInternal,
      source: helpdeskMessages.source,
      attachments: helpdeskMessages.attachments,
      callSid: helpdeskMessages.callSid,
      recordingUrl: helpdeskMessages.recordingUrl,
      transcription: helpdeskMessages.transcription,
      authorName: helpdeskUsers.name,
      authorEmail: helpdeskUsers.email,
      createdAt: helpdeskMessages.createdAt,
    })
    .from(helpdeskMessages)
    .leftJoin(helpdeskUsers, eq(helpdeskMessages.authorUserId, helpdeskUsers.id))
    .where(eq(helpdeskMessages.ticketId, id))
    .orderBy(helpdeskMessages.createdAt)

  return NextResponse.json({ ticket, client, assignedTo, messages })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session || session.role === 'client') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()

  // Get current ticket state for audit
  const current = await db
    .select()
    .from(helpdeskTickets)
    .where(eq(helpdeskTickets.id, id))
    .limit(1)

  if (!current[0]) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() }

  if (body.status !== undefined) {
    updates.status = body.status
    if (body.status === 'resolved') updates.resolvedAt = new Date()
    if (body.status === 'closed') updates.closedAt = new Date()
  }
  if (body.priority !== undefined) updates.priority = body.priority
  if (body.category !== undefined) updates.category = body.category
  if (body.assignedToUserId !== undefined) updates.assignedToUserId = body.assignedToUserId

  const [updated] = await db
    .update(helpdeskTickets)
    .set(updates)
    .where(eq(helpdeskTickets.id, id))
    .returning()

  await auditLog({
    entityType: 'ticket',
    entityId: id,
    action: body.status ? 'status_changed' : 'updated',
    userId: session.email,
    beforeData: { status: current[0].status, priority: current[0].priority },
    afterData: updates,
  })

  return NextResponse.json({ ticket: updated })
}
