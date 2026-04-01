import { NextRequest, NextResponse } from 'next/server'
import { destroySession } from '@/lib/auth'

export async function POST() {
  await destroySession()
  return NextResponse.json({ ok: true })
}

export async function GET(req: NextRequest) {
  await destroySession()
  return NextResponse.redirect(new URL('/login', req.url))
}
