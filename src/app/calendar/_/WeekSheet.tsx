import Link from 'next/link'

import { HIGHLIGHT, statusText } from '+/components/StatusMark'
import { dayKey, formatDayKeyHeading, formatTime, formatWeekdayAndDay, minutesIntoDay } from '+/lib/dates'
import type { PracticeView } from '+/lib/practices'
import { calendarPath } from '+/lib/redirects'

import PracticeMark from './PracticeMark'
import WeekHours from './WeekHours'

// Height of one hour on the sheet.
const HOUR_REM = 3.25
// Where the hours open when the week has no practices.
const DEFAULT_START_HOUR = 8
// A short practice still gets room for its time and title, on one line.
const SHORTEST_BLOCK_MIN = 30
const ONE_LINE_BELOW_MIN = 60
const DAY_MIN = 24 * 60

type PracticeOnTheSheet = {
  practice: PracticeView
  // Minutes since midnight on the wall clock of the viewer. A practice that runs past midnight stops at the end of its day,
  // and a short one is drawn long enough to read.
  startMin: number
  endMin: number
  // Practices at the same time share the width of the day, each in its own lane.
  lane: number
  lanes: number
}

// Places each practice of one day in a lane. Practices that overlap, directly or through others, split the width between them.
const placeInLanes = (practices: PracticeView[], timeZone: string): PracticeOnTheSheet[] => {
  const placed: PracticeOnTheSheet[] = []
  let group: PracticeOnTheSheet[] = []
  let groupEndMin = -1
  const laneEnds: number[] = []

  const closeGroup = () => {
    for (const item of group) item.lanes = laneEnds.length
    group = []
    laneEnds.length = 0
  }

  const items = practices
    .map((practice) => {
      const startMin = minutesIntoDay(practice.startsAt, timeZone)
      const sameDay = dayKey(practice.endsAt, timeZone) === dayKey(practice.startsAt, timeZone)
      const endMin = sameDay ? minutesIntoDay(practice.endsAt, timeZone) : DAY_MIN
      return { practice, startMin, endMin, drawnEndMin: Math.min(Math.max(endMin, startMin + SHORTEST_BLOCK_MIN), DAY_MIN) }
    })
    .sort((first, second) => first.startMin - second.startMin || second.drawnEndMin - first.drawnEndMin)

  for (const { practice, startMin, drawnEndMin } of items) {
    if (group.length > 0 && startMin >= groupEndMin) closeGroup()
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= startMin)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = drawnEndMin
    const item = { practice, startMin, endMin: drawnEndMin, lane, lanes: 1 }
    group.push(item)
    placed.push(item)
    groupEndMin = Math.max(groupEndMin, drawnEndMin)
  }
  closeGroup()
  return placed
}

// About twelve hours fit in view. The sheet opens on the twelve hours that hold the most practices of the week,
// the one closest to the usual morning start when several hold the same.
const HOURS_IN_VIEW = 12
const busiestStartHour = (startMinutes: number[]) => {
  const candidates = Array.from({ length: 24 - HOURS_IN_VIEW + 1 }, (_, hour) => ({
    hour,
    practices: startMinutes.filter((minute) => minute >= hour * 60 && minute < (hour + HOURS_IN_VIEW) * 60).length,
  }))
  candidates.sort(
    (first, second) => second.practices - first.practices || Math.abs(first.hour - DEFAULT_START_HOUR) - Math.abs(second.hour - DEFAULT_START_HOUR)
  )
  return candidates[0].hour
}

const hourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`

const viewerPlaceText = (place: PracticeView['viewer']['place']) =>
  place === 'confirmed' ? ', you are in' : place === 'waiting' ? ', you are on the waitlist' : ''

type WeekSheetProps = {
  // Monday to Sunday, each day as "2026-11-19".
  days: string[]
  today: string
  selectedDay: string
  practicesByDay: Map<string, PracticeView[]>
  timeZone: string
  now: Date
}

// The week as a planner page: one column per day and one row per hour, each practice a stroke of highlighter as long as it lasts.
// On a phone the columns do not fit, so the week becomes a list of days.
export default function WeekSheet({ days, today, selectedDay, practicesByDay, timeZone, now }: WeekSheetProps) {
  const placedByDay = new Map(days.map((day) => [day, placeInLanes(practicesByDay.get(day) ?? [], timeZone)]))
  const startMinutes = [...placedByDay.values()].flat().map((item) => item.startMin)
  const startHour = busiestStartHour(startMinutes)
  const hours = Array.from({ length: 24 }, (_, hour) => hour)
  const toRem = (minutes: number) => (minutes / 60) * HOUR_REM
  const nowMin = minutesIntoDay(now, timeZone)

  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-line bg-sheet md:block">
        <div className="week-grid week-scroll-gutter border-b border-line">
          <span />
          {days.map((day) => (
            <Link
              key={day}
              href={calendarPath({ view: 'week', day })}
              scroll={false}
              aria-label={formatDayKeyHeading(day, today)}
              aria-current={day === selectedDay ? 'date' : undefined}
              className={`week-day-heading ${day === selectedDay ? 'week-day-heading-selected' : ''}`}
            >
              <span className={day === today ? 'text-pen' : day < today ? 'text-muted' : ''}>{formatWeekdayAndDay(day)}</span>
            </Link>
          ))}
        </div>

        <WeekHours startHour={startHour} hourRem={HOUR_REM}>
          <div className="week-grid">
            <ol aria-hidden="true" className="relative" style={{ height: `${hours.length * HOUR_REM}rem` }}>
              {hours.map((hour) => (
                <li key={hour} className="week-hour-label" style={{ top: `${hour * HOUR_REM}rem` }}>
                  {hourLabel(hour)}
                </li>
              ))}
            </ol>

            {days.map((day) => (
              <div
                key={day}
                className={`week-day ${day < today ? 'week-day-past' : ''}`}
                style={{ height: `${hours.length * HOUR_REM}rem`, backgroundSize: `100% ${HOUR_REM}rem` }}
              >
                <ul aria-label={formatDayKeyHeading(day, today)}>
                  {(placedByDay.get(day) ?? []).map(({ practice, startMin, endMin, lane, lanes }) => (
                    <li
                      key={practice.id}
                      className="week-block-slot"
                      style={{
                        top: `${toRem(startMin)}rem`,
                        height: `${toRem(endMin) - toRem(startMin)}rem`,
                        left: `${(lane / lanes) * 100}%`,
                        width: `${100 / lanes}%`,
                      }}
                    >
                      <Link
                        href={`/practices/${practice.id}`}
                        title={practice.title}
                        className={`week-block ${endMin - startMin < ONE_LINE_BELOW_MIN ? 'week-block-one-line' : ''} ${HIGHLIGHT[practice.status]}`}
                      >
                        <span className="flex items-center gap-1 font-semibold tabular-nums">
                          {practice.viewer.place && (
                            <span
                              aria-hidden="true"
                              className={`calendar-pen-dot ${practice.viewer.place === 'waiting' ? 'calendar-pen-dot-waiting' : ''}`}
                            />
                          )}
                          {formatTime(practice.startsAt, timeZone)}
                        </span>
                        <span className="week-block-title">{practice.title}</span>
                        <span className="sr-only">
                          , until {formatTime(practice.endsAt, timeZone)}, {statusText(practice)}
                          {viewerPlaceText(practice.viewer.place)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {day === today && <span aria-hidden="true" className="week-now" style={{ top: `${toRem(nowMin)}rem` }} />}
              </div>
            ))}
          </div>
        </WeekHours>
      </div>

      <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-sheet md:hidden">
        {days.map((day) => {
          const practices = practicesByDay.get(day) ?? []
          return (
            <li key={day} className={`px-4 py-3 ${day === selectedDay ? 'bg-desk/50' : ''}`}>
              <Link
                href={calendarPath({ view: 'week', day })}
                scroll={false}
                aria-current={day === selectedDay ? 'date' : undefined}
                className={`text-sm font-semibold ${day === today ? 'text-pen' : day < today ? 'text-muted' : ''}`}
              >
                {formatDayKeyHeading(day, today)}
              </Link>
              {practices.length === 0 ? (
                <p className="mt-1 text-xs text-muted">Nothing scheduled</p>
              ) : (
                <ul className="mt-1.5 space-y-1">
                  {practices.map((practice) => (
                    <li key={practice.id}>
                      <PracticeMark practice={practice} timeZone={timeZone} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ol>
    </>
  )
}
