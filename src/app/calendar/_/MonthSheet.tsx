import Link from 'next/link'

import { HIGHLIGHT } from '+/components/StatusMark'
import { formatDayKeyHeading, formatMonthHeading, monthKey, WEEKDAYS } from '+/lib/dates'
import type { PracticeView } from '+/lib/practices'
import { calendarPath } from '+/lib/redirects'

import PracticeMark from './PracticeMark'

// A day box fits this many practices with their time and title. The rest are counted.
const MARKS_WRITTEN_PER_DAY = 3
// On a phone a day box only fits small strokes, one per practice.
const STROKES_DRAWN_PER_DAY = 4

const practiceCountText = (count: number) => (count === 0 ? 'no practices' : count === 1 ? '1 practice' : `${count} practices`)

type DayBoxProps = {
  day: string
  month: string
  today: string
  isSelected: boolean
  practices: PracticeView[]
  timeZone: string
}

function DayBox({ day, month, today, isSelected, practices, timeZone }: DayBoxProps) {
  const isOutsideMonth = monthKey(day) !== month
  const isToday = day === today
  const isFaded = isOutsideMonth || day < today
  const practicesNotWritten = practices.length - MARKS_WRITTEN_PER_DAY

  return (
    <td className={`calendar-day ${isOutsideMonth ? 'calendar-day-outside' : ''} ${isSelected ? 'calendar-day-selected' : ''}`}>
      {/* The link covers the whole box. The practice marks sit above it and keep their own links. */}
      <Link
        href={calendarPath({ day })}
        scroll={false}
        aria-label={`${formatDayKeyHeading(day, today)}, ${practiceCountText(practices.length)}`}
        aria-current={isSelected ? 'date' : undefined}
        className="calendar-day-link"
      >
        <span className={`calendar-day-number ${isToday ? 'calendar-today' : isFaded ? 'text-muted' : ''}`}>{Number(day.slice(8))}</span>
      </Link>

      {practices.length > 0 && (
        <>
          <div aria-hidden="true" className="mt-1 flex flex-wrap gap-0.5 px-0.5 md:hidden">
            {practices.slice(0, STROKES_DRAWN_PER_DAY).map((practice) => (
              <span
                key={practice.id}
                className={`calendar-stroke ${HIGHLIGHT[practice.status]} ${practice.viewer.place ? 'calendar-stroke-mine' : ''}`}
              />
            ))}
          </div>

          <ul className="mt-1 hidden space-y-1 md:block">
            {practices.slice(0, MARKS_WRITTEN_PER_DAY).map((practice) => (
              <li key={practice.id}>
                <PracticeMark practice={practice} timeZone={timeZone} />
              </li>
            ))}
            {practicesNotWritten > 0 && <li className="px-1.5 text-xs text-muted">{practicesNotWritten} more</li>}
          </ul>
        </>
      )}
    </td>
  )
}

type MonthSheetProps = {
  month: string
  // Weeks from Monday to Sunday, each day as "2026-11-19".
  weeks: string[][]
  today: string
  selectedDay: string
  practicesByDay: Map<string, PracticeView[]>
  timeZone: string
}

// The month as a wall planner: one sheet ruled into days, today circled in pen and every practice marked with highlighter.
export default function MonthSheet({ month, weeks, today, selectedDay, practicesByDay, timeZone }: MonthSheetProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-sheet">
      <table className="w-full table-fixed border-collapse">
        <caption className="sr-only">{formatMonthHeading(month)}</caption>
        <thead>
          <tr>
            {WEEKDAYS.map((weekday) => (
              <th key={weekday.long} scope="col" abbr={weekday.long} className="py-2.5 text-xs font-semibold text-muted">
                {weekday.short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0]}>
              {week.map((day) => (
                <DayBox
                  key={day}
                  day={day}
                  month={month}
                  today={today}
                  isSelected={day === selectedDay}
                  practices={practicesByDay.get(day) ?? []}
                  timeZone={timeZone}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
