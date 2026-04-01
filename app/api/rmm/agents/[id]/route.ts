import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { helpdeskRmmAgentMap } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()
  const { rmmAgentId, hostname, clientId, machineLabel, isActive } = body

  const updates: Record<string, unknown> = {}
  if (rmmAgentId !== undefined) updates.rmmAgentId = rmmAgentId
  if (hostname !== undefined) updates.hostname = hostname
  if (clientId !== undefined) updates.clientId = clientId
  if (machineLabel !== undefined) updates.machineLabel = machineLabel || null
  if (isActive !== undefined) updates.isActive = isActive

  const [updated] = await db
    .update(helpdeskRmmAgentMap)
    .set(updates)
    .where(eq(helpdeskRmmAgentMap.id, id))
    .returning()

  if (!updated) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const [deleted] = await db
    .delete(helpdeskRmmAgentMap)
    .where(eq(helpdeskRmmAgentMap.id, id))
    .returning()

  if (!deleted) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
