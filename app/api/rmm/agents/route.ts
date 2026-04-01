import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { helpdeskRmmAgentMap, helpdeskClients } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session || session.role === 'client') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const agents = await db
    .select({
      id: helpdeskRmmAgentMap.id,
      rmmAgentId: helpdeskRmmAgentMap.rmmAgentId,
      hostname: helpdeskRmmAgentMap.hostname,
      clientId: helpdeskRmmAgentMap.clientId,
      clientName: helpdeskClients.clientName,
      machineLabel: helpdeskRmmAgentMap.machineLabel,
      isActive: helpdeskRmmAgentMap.isActive,
      createdAt: helpdeskRmmAgentMap.createdAt,
    })
    .from(helpdeskRmmAgentMap)
    .leftJoin(helpdeskClients, eq(helpdeskRmmAgentMap.clientId, helpdeskClients.id))
    .orderBy(helpdeskRmmAgentMap.hostname)

  return NextResponse.json(agents)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { rmmAgentId, hostname, clientId, machineLabel } = body

  if (!rmmAgentId || !hostname || !clientId) {
    return NextResponse.json(
      { error: 'rmmAgentId, hostname, and clientId are required' },
      { status: 400 }
    )
  }

  const [agent] = await db
    .insert(helpdeskRmmAgentMap)
    .values({ rmmAgentId, hostname, clientId, machineLabel: machineLabel || null })
    .returning()

  return NextResponse.json(agent, { status: 201 })
}
