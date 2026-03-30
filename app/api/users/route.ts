import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { helpdeskUsers } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import bcrypt from 'bcryptjs'

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const users = await db
    .select({
      id: helpdeskUsers.id,
      email: helpdeskUsers.email,
      name: helpdeskUsers.name,
      role: helpdeskUsers.role,
      isActive: helpdeskUsers.isActive,
      lastLoginAt: helpdeskUsers.lastLoginAt,
      createdAt: helpdeskUsers.createdAt,
    })
    .from(helpdeskUsers)
    .orderBy(helpdeskUsers.name)

  return NextResponse.json({ users })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { email, name, phone, role, password, clientId } = body

  if (!email || !name || !role) {
    return NextResponse.json({ error: 'Email, name, and role required' }, { status: 400 })
  }

  let passwordHash: string | null = null
  if (password && role !== 'client') {
    passwordHash = await bcrypt.hash(password, 12)
  }

  const [user] = await db
    .insert(helpdeskUsers)
    .values({
      email: email.toLowerCase().trim(),
      name,
      phone,
      role,
      passwordHash,
      clientId: clientId ?? null,
    })
    .returning()

  return NextResponse.json({ user }, { status: 201 })
}
