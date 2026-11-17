'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import { TIME_ZONE_COOKIE } from '+/lib/dates'

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60

const storedTimeZone = () => {
  const entry = document.cookie.split('; ').find((cookie) => cookie.startsWith(`${TIME_ZONE_COOKIE}=`))
  return entry ? decodeURIComponent(entry.slice(TIME_ZONE_COOKIE.length + 1)) : null
}

// Leaves the browser time zone in a cookie so the server formats every date for whoever is looking.
// When the zone changes (first visit or a trip) the page is refreshed with the right times.
export default function TimezoneSync() {
  const router = useRouter()

  useEffect(() => {
    const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (!browserTimeZone || browserTimeZone === storedTimeZone()) return

    document.cookie = `${TIME_ZONE_COOKIE}=${encodeURIComponent(browserTimeZone)}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`
    router.refresh()
  }, [router])

  return null
}
