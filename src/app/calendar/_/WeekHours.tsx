'use client'

import { useEffect, useRef, type ReactNode } from 'react'

type WeekHoursProps = {
  // The hour at the top of the visible part when the page opens.
  startHour: number
  hourRem: number
  children: ReactNode
}

// The hours of the week scroll inside the sheet and open on the first practice, so a day of 24 hours never makes the page that long.
export default function WeekHours({ startHour, hourRem, children }: WeekHoursProps) {
  const scrollArea = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const area = scrollArea.current
    if (!area) return
    const rootFontPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
    area.scrollTop = startHour * hourRem * rootFontPx
  }, [startHour, hourRem])

  return (
    <div ref={scrollArea} className="week-scroll">
      {children}
    </div>
  )
}
