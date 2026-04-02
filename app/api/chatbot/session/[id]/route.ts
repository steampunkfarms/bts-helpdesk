import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { helpdeskChatbotSessions } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session || session.role === 'client') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const sessions = await db
    .select()
    .from(helpdeskChatbotSessions)
    .where(eq(helpdeskChatbotSessions.id, id))
    .limit(1)

  if (!sessions[0]) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(sessions[0])
}
