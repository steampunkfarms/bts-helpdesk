import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { helpdeskTokens, helpdeskUsers } from '@/lib/schema'
import { eq, and, isNull, gt } from 'drizzle-orm'
import { createSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  const redirectTo = req.nextUrl.searchParams.get('redirect') ?? '/dashboard'

  if (!token) {
    return NextResponse.redirect(new URL('/login?error=missing_token', req.url))
  }

  const tokens = await db
    .select()
    .from(helpdeskTokens)
    .where(
      and(
        eq(helpdeskTokens.token, token),
        isNull(helpdeskTokens.usedAt),
        gt(helpdeskTokens.expiresAt, new Date())
      )
    )
    .limit(1)

  if (!tokens[0]) {
    return NextResponse.redirect(new URL('/login?error=invalid_token', req.url))
  }

  // Mark token as used
  await db
    .update(helpdeskTokens)
    .set({ usedAt: new Date() })
    .where(eq(helpdeskTokens.id, tokens[0].id))

  // Get user
  const users = await db
    .select()
    .from(helpdeskUsers)
    .where(eq(helpdeskUsers.id, tokens[0].userId))
    .limit(1)

  if (!users[0]) {
    return NextResponse.redirect(new URL('/login?error=user_not_found', req.url))
  }

  await createSession(users[0])

  const dest = users[0].role === 'client' ? '/portal' : redirectTo
  return NextResponse.redirect(new URL(dest, req.url))
}
