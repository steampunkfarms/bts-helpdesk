import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { helpdeskUsers, helpdeskTokens } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { getResendClient, FROM_ADDRESS } from '@/lib/resend'

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 })
  }

  const normalized = email.toLowerCase().trim()

  const users = await db
    .select()
    .from(helpdeskUsers)
    .where(and(eq(helpdeskUsers.email, normalized), eq(helpdeskUsers.isActive, true)))
    .limit(1)

  // Always return success to prevent email enumeration
  if (!users[0]) {
    return NextResponse.json({ ok: true })
  }

  const user = users[0]
  const token = randomUUID()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

  await db.insert(helpdeskTokens).values({
    userId: user.id,
    token,
    expiresAt,
  })

  const siteUrl = process.env.SITE_URL?.trim() ?? 'https://helpdesk.tronboll.us'
  const loginPath = user.role === 'client' ? '/portal/login' : '/login'
  const verifyUrl = `${siteUrl}/api/auth/verify?token=${token}&redirect=${loginPath}`

  try {
    const resend = getResendClient()
    await resend.emails.send({
      from: FROM_ADDRESS,
      to: normalized,
      subject: 'BTS Helpdesk — Sign In Link',
      html: `
        <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
          <h2 style="color:#1b1b1b;margin:0 0 16px">Sign in to BTS Helpdesk</h2>
          <p style="color:#4b5563;line-height:1.6">Click the link below to sign in. This link expires in 24 hours.</p>
          <a href="${verifyUrl}" style="display:inline-block;margin:24px 0;padding:12px 32px;background:#c2410c;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Sign In</a>
          <p style="color:#9ca3af;font-size:0.75rem">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    })
  } catch (e) {
    console.error('[magic-link] Failed to send:', e)
  }

  return NextResponse.json({ ok: true })
}
