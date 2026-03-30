import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

export async function GET() {
  const start = Date.now()
  const checks: { name: string; status: string; ms?: number }[] = []

  // DB check
  try {
    const dbStart = Date.now()
    await db.execute(sql`SELECT 1`)
    checks.push({ name: 'database', status: 'ok', ms: Date.now() - dbStart })
  } catch {
    checks.push({ name: 'database', status: 'error' })
  }

  // Resend check
  const resendKey = process.env.RESEND_API_KEY?.trim()
  checks.push({ name: 'resend', status: resendKey ? 'ok' : 'missing_key' })

  // Anthropic check
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim()
  checks.push({ name: 'anthropic', status: anthropicKey ? 'ok' : 'missing_key' })

  const allOk = checks.every((c) => c.status === 'ok')

  return NextResponse.json(
    {
      status: allOk ? 'ok' : 'degraded',
      site: 'bts-helpdesk',
      checks,
      response_time_ms: Date.now() - start,
      timestamp: new Date().toISOString(),
    },
    { status: allOk ? 200 : 503 }
  )
}
