import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { helpdeskTickets } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'
import { requireClient } from '@/lib/auth'

// SAFE columns only — no AI fields, no internal flags, no time tracking, no billing
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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireClient()
  const { id } = await params

  const tickets = await db
    .select(SAFE_TICKET_COLUMNS)
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

  return NextResponse.json(tickets[0])
}
