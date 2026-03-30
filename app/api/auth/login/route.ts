import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { helpdeskUsers } from '@/lib/schema'
import { eq, and, ne } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { createSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
  }

  const users = await db
    .select()
    .from(helpdeskUsers)
    .where(
      and(
        eq(helpdeskUsers.email, email.toLowerCase().trim()),
        eq(helpdeskUsers.isActive, true),
        ne(helpdeskUsers.role, 'client') // clients can't password-login
      )
    )
    .limit(1)

  const user = users[0]
  if (!user || !user.passwordHash) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  await createSession(user)
  return NextResponse.json({ ok: true, role: user.role })
}
