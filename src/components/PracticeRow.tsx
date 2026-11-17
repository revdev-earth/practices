import Link from 'next/link'

import SeatTrack from '+/components/SeatTrack'
import StatusMark from '+/components/StatusMark'
import { formatDuration, formatTime, formatZone } from '+/lib/dates'
import type { PracticeView } from '+/lib/practices'
import { MODE_LABELS } from '+/lib/practiceRules'

const viewerPlaceText = (place: PracticeView['viewer']['place']) => {
  if (place === 'confirmed') return 'You are in'
  if (place === 'waiting') return 'You are on the waitlist'
  return null
}

type PracticeRowProps = {
  practice: PracticeView
  timeZone: string
}

// One line of the agenda: the time in the viewer's zone, what it is, how full it is and whether it happens.
export default function PracticeRow({ practice, timeZone }: PracticeRowProps) {
  const host = practice.viewer.isOrganizer ? 'you' : practice.organizer.name
  const viewerPlace = viewerPlaceText(practice.viewer.place)
  const isInProgress = practice.hasStarted && practice.status !== 'past'
  const taken = practice.confirmed.length
  const waiting = practice.waiting.length

  return (
    <li>
      <Link
        href={`/practices/${practice.id}`}
        className="grid grid-cols-[4.25rem_minmax(0,1fr)] gap-x-4 gap-y-3 px-4 py-4 transition-colors hover:bg-desk/50 sm:grid-cols-[5.5rem_minmax(0,1fr)_auto] sm:px-5"
      >
        <div>
          <p className="font-display text-2xl leading-none font-semibold tabular-nums">{formatTime(practice.startsAt, timeZone)}</p>
          <p className="mt-1.5 text-xs text-muted">{formatZone(practice.startsAt, timeZone)}</p>
          {isInProgress && <p className="mt-1 text-xs font-semibold text-pen">In progress</p>}
        </div>

        <div className="min-w-0">
          <h3 className="leading-snug font-semibold">{practice.title}</h3>
          <p className="mt-0.5 text-sm text-muted">
            {MODE_LABELS[practice.mode]}, {formatDuration(practice.durationMin)}, hosted by {host}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <SeatTrack taken={taken} minimum={practice.minParticipants} maximum={practice.maxParticipants} />
            <p className="text-sm text-muted tabular-nums">
              {taken} of {practice.maxParticipants}
              {waiting > 0 && `, ${waiting} waiting`}
            </p>
          </div>
        </div>

        <div className="col-start-2 sm:col-start-3 sm:text-right">
          <StatusMark practice={practice} />
          {viewerPlace && <p className="mt-1.5 text-sm font-semibold text-pen">{viewerPlace}</p>}
        </div>
      </Link>
    </li>
  )
}
