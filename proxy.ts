import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Public routes — no auth required
  if (
    pathname === '/api/health' ||
    pathname === '/api/email/inbound' ||
    pathname === '/api/twilio/inbound' ||
    pathname.startsWith('/api/webhooks/') ||
    pathname.startsWith('/api/cron/') ||
    pathname === '/login' ||
    pathname === '/portal/login' ||
    pathname.startsWith('/api/auth/') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/_next/')
  ) {
    return NextResponse.next()
  }

  const sessionCookie = req.cookies.get('helpdesk-session')?.value

  // Portal routes — client session required
  if (pathname.startsWith('/portal') || pathname.startsWith('/api/portal')) {
    if (!sessionCookie) {
      return NextResponse.redirect(new URL('/portal/login', req.url))
    }
    return NextResponse.next()
  }

  // Everything else — tech/admin session required
  if (!sessionCookie) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
