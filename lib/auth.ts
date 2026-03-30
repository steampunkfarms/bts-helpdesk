import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { db } from './db'
import { helpdeskUsers } from './schema'
import { eq } from 'drizzle-orm'

const COOKIE_NAME = 'helpdesk-session'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

function getSecret() {
  const secret = process.env.NEXTAUTH_SECRET?.trim()
  if (!secret) throw new Error('NEXTAUTH_SECRET not set')
  return new TextEncoder().encode(secret)
}

export interface Session {
  userId: string
  email: string
  name: string
  role: 'client' | 'tech' | 'admin'
  clientId?: string
}

export async function createSession(user: {
  id: string
  email: string
  name: string
  role: string
  clientId: string | null
}): Promise<string> {
  const token = await new SignJWT({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    clientId: user.clientId ?? undefined,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret())

  const jar = await cookies()
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })

  // Update last login
  await db
    .update(helpdeskUsers)
    .set({ lastLoginAt: new Date() })
    .where(eq(helpdeskUsers.id, user.id))

  return token
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies()
  const token = jar.get(COOKIE_NAME)?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload as unknown as Session
  } catch {
    return null
  }
}

export async function requireAuth(): Promise<Session> {
  const session = await getSession()
  if (!session) redirect('/login')
  return session
}

export async function requireRole(...roles: string[]): Promise<Session> {
  const session = await requireAuth()
  if (!roles.includes(session.role)) {
    throw new Error('Forbidden')
  }
  return session
}

export async function requireClient(): Promise<Session & { clientId: string }> {
  const session = await requireAuth()
  if (session.role !== 'client' || !session.clientId) {
    throw new Error('Forbidden')
  }
  return session as Session & { clientId: string }
}

export async function destroySession(): Promise<void> {
  const jar = await cookies()
  jar.delete(COOKIE_NAME)
}
