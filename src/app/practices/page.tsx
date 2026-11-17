import type { Metadata } from 'next'
import Link from 'next/link'

import PracticeRow from '+/components/PracticeRow'
import { requireUser } from '+/lib/auth'
import { dayKey, formatDayHeading, formatZone, formatZoneCity } from '+/lib/dates'
import { countPastPractices, getPastPractices, getUpcomingPractices, type PracticeView } from '+/lib/practices'
import { getTimeZone } from '+/lib/timezone'

export const metadata: Metadata = { title: 'Practices' }

const VIEWS = [
  { key: 'upcoming', label: 'Upcoming', emptyText: 'Nothing is scheduled yet. Post the first practice and share the link with your group.' },
  { key: 'open', label: 'Needs people', emptyText: 'Every upcoming practice already has the people it needs.' },
  { key: 'confirmed', label: 'Confirmed', emptyText: 'No upcoming practice has reached its minimum yet.' },
  { key: 'mine', label: 'Mine', emptyText: 'You have not joined or posted any upcoming practice.' },
  { key: 'past', label: 'Past', emptyText: 'No practice has ended yet.' },
] as const

type ViewKey = (typeof VIEWS)[number]['key']

type DayGroup = {
  day: string
  heading: string
  practices: PracticeView[]
}

// Practices arrive sorted by start time, so the ones of a same day in the viewer's zone are already next to each other.
const groupByDay = (practices: PracticeView[], timeZone: string, now: Date): DayGroup[] => {
  const groups: DayGroup[] = []
  for (const practice of practices) {
    const day = dayKey(practice.startsAt, timeZone)
    const lastGroup = groups.at(-1)
    if (lastGroup?.day === day) lastGroup.practices.push(practice)
    else groups.push({ day, heading: formatDayHeading(practice.startsAt, timeZone, now), practices: [practice] })
  }
  return groups
}

type PracticesPageProps = {
  searchParams: Promise<{ view?: string }>
}

export default async function PracticesPage({ searchParams }: PracticesPageProps) {
  const user = await requireUser()
  const { view: requestedView } = await searchParams
  const activeView = VIEWS.find((view) => view.key === requestedView) ?? VIEWS[0]

  const [timeZone, upcoming, pastCount] = await Promise.all([getTimeZone(), getUpcomingPractices(user.id), countPastPractices()])
  const past = activeView.key === 'past' ? await getPastPractices(user.id) : []

  const practicesByView: Record<ViewKey, PracticeView[]> = {
    upcoming,
    open: upcoming.filter((practice) => practice.status === 'open'),
    confirmed: upcoming.filter((practice) => practice.status === 'confirmed' || practice.status === 'full'),
    mine: upcoming.filter((practice) => practice.viewer.place !== null || practice.viewer.isOrganizer),
    past,
  }
  const countOf = (key: ViewKey) => (key === 'past' ? pastCount : practicesByView[key].length)

  const now = new Date()
  const dayGroups = groupByDay(practicesByView[activeView.key], timeZone, now)

  return (
    <>
      <h1 className="font-display text-4xl font-bold tracking-tight">Practices</h1>
      <p className="mt-2 text-sm text-muted">
        Times are shown in your time zone, {formatZoneCity(timeZone)} ({formatZone(now, timeZone)}).
      </p>

      <nav aria-label="Views" className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-b border-line">
        {VIEWS.map((view) => {
          const isActive = view.key === activeView.key
          return (
            <Link
              key={view.key}
              href={view.key === 'upcoming' ? '/practices' : `/practices?view=${view.key}`}
              aria-current={isActive ? 'page' : undefined}
              className={`-mb-px border-b-2 pb-2.5 font-semibold ${isActive ? 'border-pen text-ink' : 'border-transparent text-muted hover:text-ink'}`}
            >
              {view.label} <span className="font-normal text-muted tabular-nums">{countOf(view.key)}</span>
            </Link>
          )
        })}
      </nav>

      {dayGroups.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-muted/50 px-6 py-12 text-center">
          <p className="mx-auto max-w-md">{activeView.emptyText}</p>
          {activeView.key !== 'past' && (
            <Link href="/practices/new" className="button button-primary mt-5">
              Post a practice
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {dayGroups.map((group) => (
            <section key={group.day} aria-labelledby={`day-${group.day}`}>
              <h2 id={`day-${group.day}`} className="font-display text-lg font-semibold">
                {group.heading}
              </h2>
              <ul className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-sheet">
                {group.practices.map((practice) => (
                  <PracticeRow key={practice.id} practice={practice} timeZone={timeZone} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  )
}
