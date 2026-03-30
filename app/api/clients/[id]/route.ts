import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { helpdeskClients } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (body.clientName !== undefined) updates.clientName = body.clientName
  if (body.primaryEmail !== undefined) updates.primaryEmail = body.primaryEmail.toLowerCase().trim()
  if (body.phone !== undefined) updates.phone = body.phone || null
  if (body.slaTier !== undefined) updates.slaTier = body.slaTier
  if (body.isActive !== undefined) updates.isActive = body.isActive

  const [updated] = await db
    .update(helpdeskClients)
    .set(updates)
    .where(eq(helpdeskClients.id, id))
    .returning()

  if (!updated) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ client: updated })
}
