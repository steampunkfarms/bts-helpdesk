import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'

export function verifyCronAuth(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim()
  const internalSecret = process.env.INTERNAL_SECRET?.trim()

  if (!cronSecret && !internalSecret) {
    return false
  }

  const authHeader = request.headers.get('authorization')
  const providedToken = authHeader?.replace('Bearer ', '') || ''

  if (cronSecret && providedToken.length === cronSecret.length) {
    try {
      return timingSafeEqual(Buffer.from(providedToken), Buffer.from(cronSecret))
    } catch {
      return false
    }
  }

  if (internalSecret && providedToken.length === internalSecret.length) {
    try {
      return timingSafeEqual(Buffer.from(providedToken), Buffer.from(internalSecret))
    } catch {
      return false
    }
  }

  return false
}

export function cronResponse(data: Record<string, unknown>, status = 200) {
  return NextResponse.json({ ...data, timestamp: new Date().toISOString() }, { status })
}
