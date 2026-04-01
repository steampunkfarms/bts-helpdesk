import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { helpdeskKbArticles } from '@/lib/schema'
import { eq, sql } from 'drizzle-orm'
import { requireClient } from '@/lib/auth'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireClient()
  const { id } = await params

  const body = await req.json()
  const helpful = body.helpful === true

  if (helpful) {
    await db
      .update(helpdeskKbArticles)
      .set({ helpfulCount: sql`${helpdeskKbArticles.helpfulCount} + 1` })
      .where(eq(helpdeskKbArticles.id, id))
  }

  return NextResponse.json({ ok: true })
}
