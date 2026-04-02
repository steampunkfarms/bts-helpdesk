import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { helpdeskChatbotSessions, helpdeskTickets } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { requireClient } from '@/lib/auth'
import { auditLog } from '@/lib/audit'

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

  await db
    .update(helpdeskTickets)
    .set({
      status: 'resolved',
      resolvedAt: now,
      resolvedBy: 'chatbot',
      updatedAt: now,
    })
    .where(eq(helpdeskTickets.id, chatSession.ticketId))

  await auditLog({
    entityType: 'ticket',
    entityId: chatSession.ticketId,
    action: 'resolved',
    userId: session.email,
    afterData: { resolvedBy: 'chatbot', source: 'chatbot' },
  })

  return NextResponse.json({ ok: true })
}
