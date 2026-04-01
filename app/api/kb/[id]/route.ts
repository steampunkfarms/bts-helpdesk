import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { helpdeskKbArticles } from '@/lib/schema'
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
  const articles = await db
    .select()
    .from(helpdeskKbArticles)
    .where(eq(helpdeskKbArticles.id, id))
    .limit(1)

  if (!articles[0]) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(articles[0])
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session || session.role === 'client') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (body.title !== undefined) updates.title = body.title
  if (body.slug !== undefined) updates.slug = body.slug
  if (body.content !== undefined) updates.content = body.content
  if (body.excerpt !== undefined) updates.excerpt = body.excerpt
  if (body.category !== undefined) updates.category = body.category
  if (body.clientId !== undefined) updates.clientId = body.clientId || null
  if (body.isPublished !== undefined) updates.isPublished = body.isPublished
  if (body.tags !== undefined) updates.tags = body.tags
  updates.updatedByUserId = session.userId

  const [updated] = await db
    .update(helpdeskKbArticles)
    .set(updates)
    .where(eq(helpdeskKbArticles.id, id))
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
    .delete(helpdeskKbArticles)
    .where(eq(helpdeskKbArticles.id, id))
    .returning()

  if (!deleted) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
