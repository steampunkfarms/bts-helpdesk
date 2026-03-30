import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { helpdeskUsers } from '@/lib/schema'
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
  if (body.name !== undefined) updates.name = body.name
  if (body.email !== undefined) updates.email = body.email.toLowerCase().trim()
  if (body.role !== undefined) updates.role = body.role
  if (body.isActive !== undefined) updates.isActive = body.isActive
  if (body.phone !== undefined) updates.phone = body.phone || null

  const [updated] = await db
    .update(helpdeskUsers)
    .set(updates)
    .where(eq(helpdeskUsers.id, id))
    .returning()

  if (!updated) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ user: updated })
}
