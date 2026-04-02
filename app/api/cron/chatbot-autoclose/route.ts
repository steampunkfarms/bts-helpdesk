import { NextRequest } from 'next/server'
import { verifyCronAuth, cronResponse } from '@/lib/cron-auth'
import { db } from '@/lib/db'
import { helpdeskChatbotSessions, helpdeskTickets } from '@/lib/schema'
import { eq, and, lt, sql } from 'drizzle-orm'
import { auditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return cronResponse({ error: 'Unauthorized' }, 401)
  }

  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000)
  const now = new Date()

  // Find chatbot sessions that are stale (no activity for 30+ min, not escalated, ticket still in_progress)
  const staleSessions = await db
    .select({
      sessionId: helpdeskChatbotSessions.id,
      ticketId: helpdeskChatbotSessions.ticketId,
    })
    .from(helpdeskChatbotSessions)
    .innerJoin(helpdeskTickets, eq(helpdeskChatbotSessions.ticketId, helpdeskTickets.id))
    .where(
      and(
        eq(helpdeskChatbotSessions.wasEscalated, false),
        eq(helpdeskTickets.status, 'in_progress'),
        eq(helpdeskTickets.source, 'chatbot'),
        lt(helpdeskChatbotSessions.updatedAt, thirtyMinAgo),
      )
    )

  let closed = 0

  for (const s of staleSessions) {
    await db
      .update(helpdeskTickets)
      .set({
        status: 'resolved',
        resolvedAt: now,
        resolvedBy: 'chatbot',
        updatedAt: now,
      })
      .where(eq(helpdeskTickets.id, s.ticketId))

    await auditLog({
      entityType: 'ticket',
      entityId: s.ticketId,
      action: 'auto_resolved',
      userId: 'system',
      afterData: { resolvedBy: 'chatbot', reason: 'inactivity_30min' },
    })

    closed++
  }

  return cronResponse({ checked: staleSessions.length, closed })
}
