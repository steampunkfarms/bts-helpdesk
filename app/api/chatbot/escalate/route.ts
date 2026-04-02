import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { helpdeskChatbotSessions, helpdeskTickets, helpdeskMessages, helpdeskClients } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { requireClient } from '@/lib/auth'
import { auditLog } from '@/lib/audit'
import type { ChatMessage } from '@/lib/ai/chatbot'

export async function POST(req: NextRequest) {
  const session = await requireClient()
  const { sessionId } = await req.json()

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
  }

  const sessions = await db
    .select()
    .from(helpdeskChatbotSessions)
    .where(eq(helpdeskChatbotSessions.id, sessionId))
    .limit(1)

  const chatSession = sessions[0]
  if (!chatSession || chatSession.userId !== session.userId) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const now = new Date()

  // Mark session as escalated
  await db
    .update(helpdeskChatbotSessions)
    .set({ wasEscalated: true, escalatedAt: now, updatedAt: now })
    .where(eq(helpdeskChatbotSessions.id, sessionId))

  // Get client SLA for response clock
  const clients = await db
    .select({
      responseSlaMin: helpdeskClients.responseSlaMin,
      resolutionSlaDays: helpdeskClients.resolutionSlaDays,
    })
    .from(helpdeskClients)
    .where(eq(helpdeskClients.id, session.clientId))
    .limit(1)
  const client = clients[0]

  // SLA starts at escalation, not ticket creation
  const slaResponseDue = client
    ? new Date(now.getTime() + client.responseSlaMin * 60 * 1000)
    : null
  const slaResolutionDue = client
    ? new Date(now.getTime() + client.resolutionSlaDays * 24 * 60 * 60 * 1000)
    : null

  // Change ticket to open, set SLA from escalation time
  await db
    .update(helpdeskTickets)
    .set({
      status: 'open',
      slaResponseDue,
      slaResolutionDue,
      updatedAt: now,
    })
    .where(eq(helpdeskTickets.id, chatSession.ticketId))

  // Paste transcript as a message on the ticket
  const messages = (chatSession.messages ?? []) as ChatMessage[]
  const transcript = messages
    .map((m) => `**${m.role === 'user' ? 'Client' : 'Help Center'}:** ${m.content}`)
    .join('\n\n')

  const transcriptContent = `**Chatbot Transcript**\n---\n${transcript}\n---\n*Escalated to human support at ${now.toLocaleString()}*`

  await db.insert(helpdeskMessages).values({
    ticketId: chatSession.ticketId,
    content: transcriptContent,
    source: 'system',
    isInternal: false,
  })

  await auditLog({
    entityType: 'ticket',
    entityId: chatSession.ticketId,
    action: 'chatbot_escalated',
    userId: session.email,
    afterData: { escalatedAt: now.toISOString(), messageCount: messages.length },
  })

  return NextResponse.json({ ok: true, ticketId: chatSession.ticketId })
}
