import { NextResponse } from 'next/server'

// Password gate for the portal.
//
// Protection ONLY turns on when both PORTAL_PASSWORD and PORTAL_AUTH_TOKEN are
// set in the environment. If they're missing, the gate is disabled (fail-open),
// so deploying this code can never lock you out before you've configured it.
//
// These paths stay public even when protection is on:
//  - /login and /api/auth  → the login screen + the check itself
//  - /api/asana-webhook     → Asana calls this server-to-server; it can't log in
//  - /api/setup-webhook     → one-time webhook registration (guard with WEBHOOK_SETUP_KEY)
const PUBLIC_PATHS = ['/login', '/api/auth', '/api/asana-webhook', '/api/setup-webhook']

export function middleware(req) {
  const password = process.env.PORTAL_PASSWORD
  const expected = process.env.PORTAL_AUTH_TOKEN

  // Fail-open if not configured
  if (!password || !expected) return NextResponse.next()

  const { pathname, search } = req.nextUrl

  // Always allow framework internals, static assets, and public paths
  if (
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/')) ||
    /\.(svg|png|jpg|jpeg|gif|ico|otf|ttf|woff2?|css|js|map|webmanifest)$/.test(pathname)
  ) {
    return NextResponse.next()
  }

  // Authenticated?
  const token = req.cookies.get('portal_auth')?.value
  if (token === expected) return NextResponse.next()

  // Block API calls with 401; send page requests to the login screen
  if (pathname.startsWith('/api/')) {
    return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const loginUrl = req.nextUrl.clone()
  loginUrl.pathname = '/login'
  loginUrl.search = ''
  loginUrl.searchParams.set('next', pathname + (search || ''))
  return NextResponse.redirect(loginUrl)
}

export const config = {
  // Run on everything except Next's static output (assets handled above too)
  matcher: ['/((?!_next/static|_next/image).*)'],
}
