import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import PracticeRow from '+/components/PracticeRow'
import { requireUser } from '+/lib/auth'
import {
  calendarWeeks,
  dayKey,
  formatDayKeyHeading,
  formatMonthHeading,
  formatZone,
  formatZoneCity,
  isDayKey,
  isMonthKey,
  monthKey,
  shiftMonthKey,
  utcWindowCoveringDays,
} from '+/lib/dates'
import { getPracticesStartingBetween, type PracticeView } from '+/lib/practices'
import { calendarPath } from '+/lib/redirects'
import { getTimeZone } from '+/lib/timezone'

import MonthSheet from './_/MonthSheet'

export const metadata: Metadata = { title: 'Calendar' }

// What each mark on the sheet means, in the order a practice goes through them.
const LEGEND = [
  { mark: 'calendar-stroke highlight-yellow', text: 'Needs people' },
  { mark: 'calendar-stroke highlight-green', text: 'Confirmed' },
  { mark: 'calendar-stroke highlight-pink', text: 'Full' },
  { mark: 'calendar-stroke highlight-plain', text: 'Ended' },
  { mark: 'calendar-pen-dot', text: 'You signed up' },
]

// A practice belongs to the day it starts on, in the viewer's zone. They arrive sorted by start, so each day keeps that order.
const groupByStartDay = (practices: PracticeView[], timeZone: string) => {
  const practicesByDay = new Map<string, PracticeView[]>()
  for (const practice of practices) {
    const day = dayKey(practice.startsAt, timeZone)
    practicesByDay.set(day, [...(practicesByDay.get(day) ?? []), practice])
  }
  return practicesByDay
}

type CalendarPageProps = {
  searchParams: Promise<{ month?: string; day?: string }>
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const user = await requireUser()
  const [{ month: requestedMonth, day: requestedDay }, timeZone] = await Promise.all([searchParams, getTimeZone()])

  const now = new Date()
  const today = dayKey(now, timeZone)

  // A day in the address selects that day and its month. A month alone opens that month. With neither, the calendar opens on today.
  const month = isDayKey(requestedDay) ? monthKey(requestedDay) : isMonthKey(requestedMonth) ? requestedMonth : monthKey(today)
  const weeks = calendarWeeks(month)
  const daysOnThePage = weeks.flat()

  const { from, to } = utcWindowCoveringDays(daysOnThePage[0], daysOnThePage[daysOnThePage.length - 1])
  const practicesByDay = groupByStartDay(await getPracticesStartingBetween(user.id, from, to), timeZone)

  const firstDayWithPractices = daysOnThePage.find((day) => monthKey(day) === month && practicesByDay.has(day))
  const selectedDay = isDayKey(requestedDay) ? requestedDay : monthKey(today) === month ? today : (firstDayWithPractices ?? `${month}-01`)
  const selectedDayPractices = practicesByDay.get(selectedDay) ?? []
  const canPostOnSelectedDay = selectedDay >= today

  const previousMonth = shiftMonthKey(month, -1)
  const followingMonth = shiftMonthKey(month, 1)

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight">{formatMonthHeading(month)}</h1>
          <p className="mt-2 text-sm text-muted">
            Times are shown in your time zone, {formatZoneCity(timeZone)} ({formatZone(now, timeZone)}).
          </p>
        </div>

        <nav aria-label="Months" className="flex items-center gap-2">
          <Link
            href={calendarPath({ month: previousMonth })}
            aria-label={`Previous month, ${formatMonthHeading(previousMonth)}`}
            className="button button-quiet px-2.5"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </Link>
          <Link href={calendarPath()} className="button button-quiet">
            Today
          </Link>
          <Link
            href={calendarPath({ month: followingMonth })}
            aria-label={`Next month, ${formatMonthHeading(followingMonth)}`}
            className="button button-quiet px-2.5"
          >
            <ChevronRight className="size-5" aria-hidden="true" />
          </Link>
        </nav>
      </div>

      <div className="mt-6">
        <MonthSheet month={month} weeks={weeks} today={today} selectedDay={selectedDay} practicesByDay={practicesByDay} timeZone={timeZone} />
      </div>

      <ul aria-label="What the marks mean" className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted">
        {LEGEND.map((entry) => (
          <li key={entry.text} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={entry.mark} />
            {entry.text}
          </li>
        ))}
      </ul>

      <section aria-labelledby="selected-day-heading" className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 id="selected-day-heading" className="font-display text-xl font-semibold">
            {formatDayKeyHeading(selectedDay, today)}
          </h2>
          {canPostOnSelectedDay && selectedDayPractices.length > 0 && (
            <Link href={`/practices/new?day=${selectedDay}`} className="text-link text-sm">
              Post a practice on this day
            </Link>
          )}
        </div>

        {selectedDayPractices.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-muted/50 px-6 py-10 text-center">
            <p className="mx-auto max-w-md">
              {canPostOnSelectedDay ? 'Nothing is scheduled on this day yet.' : 'Nothing was scheduled on this day.'}
            </p>
            {canPostOnSelectedDay && (
              <Link href={`/practices/new?day=${selectedDay}`} className="button button-primary mt-5">
                Post a practice on this day
              </Link>
            )}
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-sheet">
            {selectedDayPractices.map((practice) => (
              <PracticeRow key={practice.id} practice={practice} timeZone={timeZone} />
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
