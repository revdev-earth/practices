import { getSessionCookie } from 'better-auth/cookies'
import { NextRequest, NextResponse } from 'next/server'

import { authModalPath } from '+/lib/redirects'

// The landing page, the pages of public practices (/share/…) and each poll (/polls/<id>) are open to anyone.
// Login, registration and password recovery open on top of the landing page.
// The preview image of a poll is public too, so chat apps can show it.
const isPollPage = (pathname: string) => /^\/polls\/[^/]+(\/opengraph-image[^/]*)?$/.test(pathname) && pathname !== '/polls/new'
const isPublicPath = (pathname: string) => pathname === '/' || pathname.startsWith('/share/') || isPollPage(pathname)

// Quick check by cookie: whoever reaches a private route without a session goes to the landing page with the login window open,
// and comes back to where they were going. The real session is validated in every page and every server action (see requireUser and getUser).
export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (isPublicPath(pathname) || getSessionCookie(request)) return NextResponse.next()

  // A server action without a session answers with its own error. Redirecting it would leave the form without a response.
  if (request.headers.has('next-action')) return NextResponse.next()

  return NextResponse.redirect(new URL(authModalPath('login', { next: `${pathname}${search}` }), request.url))
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.(?:png|svg|ico|webp)$).*)'],
}
