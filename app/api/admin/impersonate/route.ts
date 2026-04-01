import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { helpdeskClients } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { getSession, createSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { clientId } = await req.json()
  if (!clientId) {
    return NextResponse.json({ error: 'clientId required' }, { status: 400 })
  }

  const clients = await db
    .select({ id: helpdeskClients.id, clientName: helpdeskClients.clientName })
    .from(helpdeskClients)
    .where(eq(helpdeskClients.id, clientId))
    .limit(1)

  if (!clients[0]) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  // Create a client session using the admin's identity but with client role
  await createSession({
    id: session.userId,
    email: session.email,
    name: `${session.name} (as ${clients[0].clientName})`,
    role: 'client',
    clientId: clients[0].id,
  })

  return NextResponse.json({ ok: true, clientName: clients[0].clientName })
}
