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
  formatWeekHeading,
  formatZone,
  formatZoneCity,
  isDayKey,
  isMonthKey,
  monthKey,
  shiftDayKey,
  shiftMonthKey,
  utcWindowCoveringDays,
  weekDayKeys,
} from '+/lib/dates'
import { getPracticesStartingBetween, type PracticeView } from '+/lib/practices'
import { calendarPath, type CalendarView } from '+/lib/redirects'
import { getTimeZone } from '+/lib/timezone'

import MonthSheet from './_/MonthSheet'
import WeekSheet from './_/WeekSheet'

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
  searchParams: Promise<{ view?: string; month?: string; day?: string }>
}

// The page in one of its two views: what it shows, its heading and where the arrows lead.
type CalendarPage = {
  days: string[]
  heading: string
  previous: { href: string; label: string }
  following: { href: string; label: string }
}

const weekPage = (day: string): CalendarPage => {
  const days = weekDayKeys(day)
  const previousWeek = weekDayKeys(shiftDayKey(day, -7))
  const followingWeek = weekDayKeys(shiftDayKey(day, 7))
  return {
    days,
    heading: formatWeekHeading(days[0], days[6]),
    previous: {
      href: calendarPath({ view: 'week', day: shiftDayKey(day, -7) }),
      label: `Previous week, ${formatWeekHeading(previousWeek[0], previousWeek[6])}`,
    },
    following: {
      href: calendarPath({ view: 'week', day: shiftDayKey(day, 7) }),
      label: `Next week, ${formatWeekHeading(followingWeek[0], followingWeek[6])}`,
    },
  }
}

const monthPage = (month: string): CalendarPage => {
  const previousMonth = shiftMonthKey(month, -1)
  const followingMonth = shiftMonthKey(month, 1)
  return {
    days: calendarWeeks(month).flat(),
    heading: formatMonthHeading(month),
    previous: { href: calendarPath({ month: previousMonth }), label: `Previous month, ${formatMonthHeading(previousMonth)}` },
    following: { href: calendarPath({ month: followingMonth }), label: `Next month, ${formatMonthHeading(followingMonth)}` },
  }
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const user = await requireUser()
  const [{ view: requestedView, month: requestedMonth, day: requestedDay }, timeZone] = await Promise.all([searchParams, getTimeZone()])

  const now = new Date()
  const today = dayKey(now, timeZone)

  const view: CalendarView = requestedView === 'week' ? 'week' : 'month'

  // A day in the address selects that day and its month or week. A month alone opens that month. With neither, the calendar opens on today.
  const month = isDayKey(requestedDay) ? monthKey(requestedDay) : isMonthKey(requestedMonth) ? requestedMonth : monthKey(today)
  const page = view === 'week' ? weekPage(isDayKey(requestedDay) ? requestedDay : today) : monthPage(month)
  const daysOnThePage = page.days

  const { from, to } = utcWindowCoveringDays(daysOnThePage[0], daysOnThePage[daysOnThePage.length - 1])
  const practicesByDay = groupByStartDay(await getPracticesStartingBetween(user.id, from, to), timeZone)

  const firstDayWithPractices = daysOnThePage.find((day) => monthKey(day) === month && practicesByDay.has(day))
  const selectedDay = isDayKey(requestedDay)
    ? requestedDay
    : view === 'week' || monthKey(today) === month
      ? today
      : (firstDayWithPractices ?? `${month}-01`)
  const selectedDayPractices = practicesByDay.get(selectedDay) ?? []
  const canPostOnSelectedDay = selectedDay >= today

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight">{page.heading}</h1>
          <p className="mt-2 text-sm text-muted">
            Times are shown in your time zone, {formatZoneCity(timeZone)} ({formatZone(now, timeZone)}).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          {/* Switching keeps the selected day, so the week opens on the day picked in the month and the other way around. */}
          <nav aria-label="Calendar view" className="flex rounded-lg border border-line bg-sheet p-0.5 text-sm font-semibold">
            {(['month', 'week'] as const).map((option) => (
              <Link
                key={option}
                href={calendarPath({ view: option, day: selectedDay })}
                aria-current={option === view ? 'page' : undefined}
                className={`rounded-md px-3 py-1.5 ${option === view ? 'bg-ink text-sheet' : 'text-muted hover:text-ink'}`}
              >
                {option === 'month' ? 'Month' : 'Week'}
              </Link>
            ))}
          </nav>

          <nav aria-label={view === 'week' ? 'Weeks' : 'Months'} className="flex items-center gap-2">
            <Link href={page.previous.href} aria-label={page.previous.label} className="button button-quiet px-2.5">
              <ChevronLeft className="size-5" aria-hidden="true" />
            </Link>
            <Link href={calendarPath({ view })} className="button button-quiet">
              Today
            </Link>
            <Link href={page.following.href} aria-label={page.following.label} className="button button-quiet px-2.5">
              <ChevronRight className="size-5" aria-hidden="true" />
            </Link>
          </nav>
        </div>
      </div>

      <div className="mt-6">
        {view === 'week' ? (
          <WeekSheet days={page.days} today={today} selectedDay={selectedDay} practicesByDay={practicesByDay} timeZone={timeZone} now={now} />
        ) : (
          <MonthSheet
            month={month}
            weeks={calendarWeeks(month)}
            today={today}
            selectedDay={selectedDay}
            practicesByDay={practicesByDay}
            timeZone={timeZone}
          />
        )}
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
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <Link href={`/practices/new?day=${selectedDay}`} className="button button-primary">
                  Post a practice on this day
                </Link>
                <Link href="/polls/new" className="button button-quiet">
                  Find a time with a poll
                </Link>
              </div>
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
