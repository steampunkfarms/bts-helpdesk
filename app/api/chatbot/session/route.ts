import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { helpdeskTickets, helpdeskChatbotSessions, helpdeskClients } from '@/lib/schema'
import { eq, and, notInArray } from 'drizzle-orm'
import { requireClient } from '@/lib/auth'
import { generateTicketNumber } from '@/lib/ticket-number'

export async function POST(req: NextRequest) {
  const session = await requireClient()
  const body = await req.json()
  const { message } = body

  if (!message) {
    return NextResponse.json({ error: 'message required' }, { status: 400 })
  }

  // Check for an existing active chatbot session for this user
  const existingSessions = await db
    .select({
      id: helpdeskChatbotSessions.id,
      ticketId: helpdeskChatbotSessions.ticketId,
      messages: helpdeskChatbotSessions.messages,
    })
    .from(helpdeskChatbotSessions)
    .innerJoin(helpdeskTickets, eq(helpdeskChatbotSessions.ticketId, helpdeskTickets.id))
    .where(
      and(
        eq(helpdeskChatbotSessions.userId, session.userId),
        eq(helpdeskChatbotSessions.wasEscalated, false),
        notInArray(helpdeskTickets.status, ['resolved', 'closed']),
      )
    )
    .limit(1)

  if (existingSessions[0]) {
    // Return existing session
    const existing = existingSessions[0]
    const ticket = await db
      .select({ ticketNumber: helpdeskTickets.ticketNumber })
      .from(helpdeskTickets)
      .where(eq(helpdeskTickets.id, existing.ticketId))
      .limit(1)

    return NextResponse.json({
      sessionId: existing.id,
      ticketId: existing.ticketId,
      ticketNumber: ticket[0]?.ticketNumber,
      messages: existing.messages,
      isExisting: true,
    })
  }

  // Get client name for the ticket
  const clients = await db
    .select({ clientName: helpdeskClients.clientName })
    .from(helpdeskClients)
    .where(eq(helpdeskClients.id, session.clientId))
    .limit(1)

  const ticketNumber = await generateTicketNumber()

  // Create ticket
  const [ticket] = await db
    .insert(helpdeskTickets)
    .values({
      ticketNumber,
      subject: message.slice(0, 80),
      category: 'Help Center',
      priority: 'normal',
      status: 'in_progress',
      clientId: session.clientId,
      createdByUserId: session.userId,
      source: 'chatbot',
      isInternal: false,
      isProactive: false,
    })
    .returning()

  // Create chatbot session
  const now = new Date().toISOString()
  const [chatSession] = await db
    .insert(helpdeskChatbotSessions)
    .values({
      ticketId: ticket.id,
      userId: session.userId,
      clientId: session.clientId,
      messages: [{ role: 'user', content: message, timestamp: now }],
    })
    .returning()

  // Update ticket with session link
  await db
    .update(helpdeskTickets)
    .set({ chatbotSessionId: chatSession.id })
    .where(eq(helpdeskTickets.id, ticket.id))

  return NextResponse.json({
    sessionId: chatSession.id,
    ticketId: ticket.id,
    ticketNumber,
    messages: [{ role: 'user', content: message, timestamp: now }],
    isExisting: false,
  }, { status: 201 })
}

// GET: Fetch active session for current user (for widget reload)
export async function GET() {
  const session = await requireClient()

  const activeSessions = await db
    .select({
      id: helpdeskChatbotSessions.id,
      ticketId: helpdeskChatbotSessions.ticketId,
      messages: helpdeskChatbotSessions.messages,
    })
    .from(helpdeskChatbotSessions)
    .innerJoin(helpdeskTickets, eq(helpdeskChatbotSessions.ticketId, helpdeskTickets.id))
    .where(
      and(
        eq(helpdeskChatbotSessions.userId, session.userId),
        eq(helpdeskChatbotSessions.wasEscalated, false),
        notInArray(helpdeskTickets.status, ['resolved', 'closed']),
      )
    )
    .limit(1)

  if (!activeSessions[0]) {
    return NextResponse.json({ active: false })
  }

  const s = activeSessions[0]
  const ticket = await db
    .select({ ticketNumber: helpdeskTickets.ticketNumber })
    .from(helpdeskTickets)
    .where(eq(helpdeskTickets.id, s.ticketId))
    .limit(1)

  return NextResponse.json({
    active: true,
    sessionId: s.id,
    ticketId: s.ticketId,
    ticketNumber: ticket[0]?.ticketNumber,
    messages: s.messages,
  })
}
