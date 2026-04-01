import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { helpdeskMessages, helpdeskTickets } from '@/lib/schema'
import { eq, and, asc } from 'drizzle-orm'
import { requireClient } from '@/lib/auth'
import { auditLog } from '@/lib/audit'

// SAFE message columns — no internal flag column returned (we filter by it)
const SAFE_MESSAGE_COLUMNS = {
  id: helpdeskMessages.id,
  ticketId: helpdeskMessages.ticketId,
  content: helpdeskMessages.content,
  contentHtml: helpdeskMessages.contentHtml,
  source: helpdeskMessages.source,
  createdAt: helpdeskMessages.createdAt,
} as const

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireClient()
  const { id } = await params

  // Verify ticket belongs to this client and is not internal
  const tickets = await db
    .select({ id: helpdeskTickets.id })
    .from(helpdeskTickets)
    .where(
      and(
        eq(helpdeskTickets.id, id),
        eq(helpdeskTickets.clientId, session.clientId),
        eq(helpdeskTickets.isInternal, false),
      )
    )
    .limit(1)

  if (!tickets[0]) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Only non-internal messages — column-level selection, no AI draft messages
  const messages = await db
    .select(SAFE_MESSAGE_COLUMNS)
    .from(helpdeskMessages)
    .where(
      and(
        eq(helpdeskMessages.ticketId, id),
        eq(helpdeskMessages.isInternal, false),
      )
    )
    .orderBy(asc(helpdeskMessages.createdAt))

  return NextResponse.json(messages)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireClient()
  const { id } = await params

  // Verify ticket ownership
  const tickets = await db
    .select({ id: helpdeskTickets.id })
    .from(helpdeskTickets)
    .where(
      and(
        eq(helpdeskTickets.id, id),
        eq(helpdeskTickets.clientId, session.clientId),
        eq(helpdeskTickets.isInternal, false),
      )
    )
    .limit(1)

  if (!tickets[0]) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await req.json()
  if (!body.content) {
    return NextResponse.json({ error: 'Content required' }, { status: 400 })
  }

  const [message] = await db
    .insert(helpdeskMessages)
    .values({
      ticketId: id,
      authorUserId: session.userId,
      content: body.content,
      source: 'portal',
      isInternal: false,
    })
    .returning(SAFE_MESSAGE_COLUMNS)

  // Update ticket status
  await db
    .update(helpdeskTickets)
    .set({ status: 'awaiting_tech', updatedAt: new Date() })
    .where(eq(helpdeskTickets.id, id))

  await auditLog({
    entityType: 'message',
    entityId: message.id,
    action: 'created',
    userId: session.email,
    afterData: { ticketId: id, source: 'portal' },
  })

  return NextResponse.json(message, { status: 201 })
}
