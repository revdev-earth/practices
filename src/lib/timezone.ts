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

// Time zone of whoever is looking at the page. On the first visit the cookie is still missing and the default zone is used.
export const getTimeZone = cache(async () => {
  const value = (await cookies()).get(TIME_ZONE_COOKIE)?.value
  return value && isValidTimeZone(value) ? value : DEFAULT_TIME_ZONE
})
