import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { helpdeskKbArticles } from '@/lib/schema'
import { desc } from 'drizzle-orm'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session || session.role === 'client') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const articles = await db
    .select()
    .from(helpdeskKbArticles)
    .orderBy(desc(helpdeskKbArticles.updatedAt))
    .limit(200)

  return NextResponse.json(articles)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role === 'client') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { title, slug, content, excerpt, category, clientId, isPublished, tags, sourceTicketId } = body

  if (!title || !slug || !content) {
    return NextResponse.json({ error: 'title, slug, and content are required' }, { status: 400 })
  }

  const [article] = await db
    .insert(helpdeskKbArticles)
    .values({
      title,
      slug,
      content,
      excerpt: excerpt || null,
      category: category || null,
      clientId: clientId || null,
      isPublished: isPublished ?? false,
      tags: tags ?? [],
      sourceTicketId: sourceTicketId || null,
      createdByUserId: session.userId,
    })
    .returning()

  return NextResponse.json(article, { status: 201 })
}
