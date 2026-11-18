import 'server-only'

import { cookies } from 'next/headers'

// A browser without an account gets a random id in this cookie the first time it answers a poll or takes a spot.
// It is what makes those answers and that spot theirs. The name stays from the first deploy, when only polls used it.
const GUEST_COOKIE = 'poll_voter'
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60

// The guest id of this browser, or null when it never answered nor took a spot.
export const readGuestKey = async () => (await cookies()).get(GUEST_COOKIE)?.value ?? null

// The guest id of this browser, created on the spot when it has none. Only server actions can write the cookie.
export const ensureGuestKey = async () => {
  const cookieStore = await cookies()
  const existing = cookieStore.get(GUEST_COOKIE)?.value
  if (existing) return existing
  const guestKey = crypto.randomUUID()
  cookieStore.set(GUEST_COOKIE, guestKey, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: ONE_YEAR_SECONDS,
    path: '/',
  })
  return guestKey
}
