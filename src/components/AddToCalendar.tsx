import { CalendarPlus, Download } from 'lucide-react'

import { googleCalendarLink, type CalendarAudience } from '+/lib/calendarInvite'
import type { PracticeView } from '+/lib/practices'

type AddToCalendarProps = {
  practice: PracticeView
  audience: CalendarAudience
  // The address of the .ics file of this practice.
  icsHref: string
  className?: string
}

const LINK = 'inline-flex items-center gap-1.5 font-semibold underline decoration-line underline-offset-4 hover:decoration-ink'

// Puts the practice in the calendar someone already uses. The times travel in UTC and each calendar shows them in its own zone.
export default function AddToCalendar({ practice, audience, icsHref, className = '' }: AddToCalendarProps) {
  return (
    <p className={`flex flex-wrap items-center gap-x-5 gap-y-2 text-sm ${className}`}>
      <span className="text-muted">Add to your calendar</span>
      <a href={googleCalendarLink(practice, audience)} target="_blank" rel="noopener noreferrer" className={LINK}>
        <CalendarPlus className="size-4" aria-hidden="true" />
        Google Calendar
      </a>
      <a href={icsHref} download className={LINK}>
        <Download className="size-4" aria-hidden="true" />
        Apple, Outlook and others (.ics)
      </a>
    </p>
  )
}
