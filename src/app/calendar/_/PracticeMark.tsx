import Link from 'next/link'

import { HIGHLIGHT, statusText } from '+/components/StatusMark'
import { formatTime } from '+/lib/dates'
import type { PracticeView } from '+/lib/practices'

const viewerPlaceText = (place: PracticeView['viewer']['place']) => {
  if (place === 'confirmed') return ', you are in'
  if (place === 'waiting') return ', you are on the waitlist'
  return ''
}

type PracticeMarkProps = {
  practice: PracticeView
  timeZone: string
}

// A practice on the month sheet: one stroke of highlighter in the color of its status, with the start time and the title.
// The pen dot marks the practices the viewer signed up for. It is hollow while the viewer waits for a spot.
export default function PracticeMark({ practice, timeZone }: PracticeMarkProps) {
  const place = practice.viewer.place

  return (
    <Link href={`/practices/${practice.id}`} title={practice.title} className={`calendar-mark ${HIGHLIGHT[practice.status]}`}>
      {place && <span aria-hidden="true" className={`calendar-pen-dot ${place === 'waiting' ? 'calendar-pen-dot-waiting' : ''}`} />}
      <span className="font-semibold tabular-nums">{formatTime(practice.startsAt, timeZone)}</span>
      <span className="truncate">{practice.title}</span>
      <span className="sr-only">
        , {statusText(practice)}
        {viewerPlaceText(place)}
      </span>
    </Link>
  )
}
