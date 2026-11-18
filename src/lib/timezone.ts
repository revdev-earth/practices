import { cookies } from 'next/headers'
import { cache } from 'react'

import { DEFAULT_TIME_ZONE, TIME_ZONE_COOKIE } from '+/lib/dates'

const isValidTimeZone = (value: string) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return true
  } catch {
    return false
  }
}

// The zone the browser left in the cookie. Null on the first visit, before the cookie exists.
export const getBrowserTimeZone = cache(async () => {
  const value = (await cookies()).get(TIME_ZONE_COOKIE)?.value
  return value && isValidTimeZone(value) ? value : null
})

// Time zone of whoever is looking at the page. On the first visit the cookie is still missing and the default zone is used.
export const getTimeZone = cache(async () => (await getBrowserTimeZone()) ?? DEFAULT_TIME_ZONE)
