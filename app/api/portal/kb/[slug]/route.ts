import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { helpdeskKbArticles } from '@/lib/schema'
import { eq, and, or, isNull, sql } from 'drizzle-orm'
import { requireClient } from '@/lib/auth'

// SAFE columns — includes content for detail view, no internal authorship info
const SAFE_KB_DETAIL_COLUMNS = {
  id: helpdeskKbArticles.id,
  title: helpdeskKbArticles.title,
  slug: helpdeskKbArticles.slug,
  content: helpdeskKbArticles.content,
  excerpt: helpdeskKbArticles.excerpt,
  category: helpdeskKbArticles.category,
  tags: helpdeskKbArticles.tags,
  viewCount: helpdeskKbArticles.viewCount,
  helpfulCount: helpdeskKbArticles.helpfulCount,
  createdAt: helpdeskKbArticles.createdAt,
  updatedAt: helpdeskKbArticles.updatedAt,
} as const

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await requireClient()
  const { slug } = await params

  const articles = await db
    .select(SAFE_KB_DETAIL_COLUMNS)
    .from(helpdeskKbArticles)
    .where(
      and(
        eq(helpdeskKbArticles.slug, slug),
        eq(helpdeskKbArticles.isPublished, true),
        or(
          isNull(helpdeskKbArticles.clientId),
          eq(helpdeskKbArticles.clientId, session.clientId),
        ),
      )
    )
    .limit(1)

  if (!articles[0]) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Increment view count
  await db
    .update(helpdeskKbArticles)
    .set({ viewCount: sql`${helpdeskKbArticles.viewCount} + 1` })
    .where(eq(helpdeskKbArticles.id, articles[0].id))

  return NextResponse.json(articles[0])
}
