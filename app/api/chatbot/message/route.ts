import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { helpdeskChatbotSessions, helpdeskTickets, helpdeskClients } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { requireClient } from '@/lib/auth'
import { getChatbotResponse, type ChatMessage } from '@/lib/ai/chatbot'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  const session = await requireClient()
  const body = await req.json()
  const { sessionId, message } = body

  if (!sessionId || !message) {
    return NextResponse.json({ error: 'sessionId and message required' }, { status: 400 })
  }

  // Fetch session (verify ownership)
  const sessions = await db
    .select()
    .from(helpdeskChatbotSessions)
    .where(eq(helpdeskChatbotSessions.id, sessionId))
    .limit(1)

  const chatSession = sessions[0]
  if (!chatSession || chatSession.userId !== session.userId) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  // Get client name
  const clients = await db
    .select({ clientName: helpdeskClients.clientName })
    .from(helpdeskClients)
    .where(eq(helpdeskClients.id, session.clientId))
    .limit(1)
  const clientName = clients[0]?.clientName ?? 'Client'

  // Get chatbot response
  const existingMessages = (chatSession.messages ?? []) as ChatMessage[]
  const aiResponse = await getChatbotResponse({
    clientName,
    clientId: session.clientId,
    conversationHistory: existingMessages,
    userMessage: message,
  })

  const now = new Date().toISOString()

  // Build the assistant's display message
  let displayAnswer = aiResponse.answer
  if (!aiResponse.confident) {
    displayAnswer += "\n\nI'm not sure about that one — would you like to submit this as a help ticket so Erick can take a look?"
  }

  // Append both messages to session
  const userMsg: ChatMessage = { role: 'user', content: message, timestamp: now }
  const assistantMsg: ChatMessage = {
    role: 'assistant',
    content: displayAnswer,
    timestamp: new Date().toISOString(),
    kbArticleIds: aiResponse.citedArticles,
  }

  const updatedMessages = [...existingMessages, userMsg, assistantMsg]

  // Update cited articles
  const existingCited = chatSession.kbArticlesCited ?? []
  const newCited = [...new Set([...existingCited, ...aiResponse.citedArticles])]

  await db
    .update(helpdeskChatbotSessions)
    .set({
      messages: updatedMessages,
      kbArticlesCited: newCited,
      updatedAt: new Date(),
    })
    .where(eq(helpdeskChatbotSessions.id, sessionId))

  // Update ticket updatedAt
  await db
    .update(helpdeskTickets)
    .set({ updatedAt: new Date() })
    .where(eq(helpdeskTickets.id, chatSession.ticketId))

  return NextResponse.json({
    answer: displayAnswer,
    confident: aiResponse.confident,
    citedArticles: aiResponse.citedArticles,
  })
}
