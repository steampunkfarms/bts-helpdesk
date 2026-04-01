import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { helpdeskTickets, helpdeskMessages } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { generateKbArticle } from '@/lib/ai/kb-generator'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role === 'client') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { ticketId } = body

  if (!ticketId) {
    return NextResponse.json({ error: 'ticketId required' }, { status: 400 })
  }

  // Fetch ticket
  const tickets = await db
    .select({
      subject: helpdeskTickets.subject,
      category: helpdeskTickets.category,
    })
    .from(helpdeskTickets)
    .where(eq(helpdeskTickets.id, ticketId))
    .limit(1)

  if (!tickets[0]) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
  }

  // Fetch messages
  const messages = await db
    .select({
      content: helpdeskMessages.content,
      source: helpdeskMessages.source,
      isInternal: helpdeskMessages.isInternal,
    })
    .from(helpdeskMessages)
    .where(eq(helpdeskMessages.ticketId, ticketId))
    .orderBy(asc(helpdeskMessages.createdAt))

  const draft = await generateKbArticle({
    ticketSubject: tickets[0].subject,
    ticketCategory: tickets[0].category,
    messages,
  })

  return NextResponse.json({ ...draft, sourceTicketId: ticketId })
}
