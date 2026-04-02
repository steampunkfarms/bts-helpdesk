import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { helpdeskChatbotSessions } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { requireClient } from '@/lib/auth'
import type { ChatMessage } from '@/lib/ai/chatbot'

export async function POST(req: NextRequest) {
  const session = await requireClient()
  const { sessionId, messageIndex, feedback } = await req.json()

  if (!sessionId || messageIndex === undefined || !['up', 'down'].includes(feedback)) {
    return NextResponse.json({ error: 'sessionId, messageIndex, and feedback (up|down) required' }, { status: 400 })
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

  const messages = (chatSession.messages ?? []) as ChatMessage[]
  if (messageIndex < 0 || messageIndex >= messages.length) {
    return NextResponse.json({ error: 'Invalid message index' }, { status: 400 })
  }

  messages[messageIndex].feedback = feedback

  await db
    .update(helpdeskChatbotSessions)
    .set({ messages, updatedAt: new Date() })
    .where(eq(helpdeskChatbotSessions.id, sessionId))

  return NextResponse.json({ ok: true })
}
