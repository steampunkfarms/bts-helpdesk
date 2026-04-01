import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { helpdeskKbArticles } from '@/lib/schema'
import { eq, and, or, isNull, desc, ilike } from 'drizzle-orm'
import { requireClient } from '@/lib/auth'

// SAFE columns — no sourceTicketId, no createdByUserId, no updatedByUserId
const SAFE_KB_COLUMNS = {
  id: helpdeskKbArticles.id,
  title: helpdeskKbArticles.title,
  slug: helpdeskKbArticles.slug,
  excerpt: helpdeskKbArticles.excerpt,
  category: helpdeskKbArticles.category,
  tags: helpdeskKbArticles.tags,
  viewCount: helpdeskKbArticles.viewCount,
  helpfulCount: helpdeskKbArticles.helpfulCount,
  createdAt: helpdeskKbArticles.createdAt,
} as const

export async function GET(req: NextRequest) {
  const session = await requireClient()

  const url = new URL(req.url)
  const search = url.searchParams.get('q')

  let query = db
    .select(SAFE_KB_COLUMNS)
    .from(helpdeskKbArticles)
    .where(
      and(
        eq(helpdeskKbArticles.isPublished, true),
        or(
          isNull(helpdeskKbArticles.clientId),
          eq(helpdeskKbArticles.clientId, session.clientId),
        ),
      )
    )
    .orderBy(desc(helpdeskKbArticles.updatedAt))
    .$dynamic()

  if (search) {
    query = query.where(
      and(
        eq(helpdeskKbArticles.isPublished, true),
        or(
          isNull(helpdeskKbArticles.clientId),
          eq(helpdeskKbArticles.clientId, session.clientId),
        ),
        or(
          ilike(helpdeskKbArticles.title, `%${search}%`),
          ilike(helpdeskKbArticles.content, `%${search}%`),
        ),
      )
    )
  }

  const articles = await query.limit(50)
  return NextResponse.json(articles)
}
