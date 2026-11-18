import type { PracticeView } from '+/lib/practices'
import { MODE_LABELS } from '+/lib/practiceRules'
import { absoluteUrl, roomPath, shareablePracticePath, sharePath } from '+/lib/redirects'

// What a calendar app needs to show one practice. Times travel in UTC, so each calendar shows them in its own zone.
type CalendarEntry = {
  uid: string
  title: string
  details: string
  location: string
  startsAt: Date
  endsAt: Date
  url: string
}

// A member opens the room from the app. A guest of a public practice only has the shared page.
export type CalendarAudience = 'member' | 'guest'

const calendarEntryFor = (practice: PracticeView, audience: CalendarAudience): CalendarEntry => {
  const url = absoluteUrl(audience === 'guest' ? sharePath(practice.id) : shareablePracticePath(practice))
  const location = practice.videoRoom ? absoluteUrl(audience === 'guest' ? sharePath(practice.id) : roomPath(practice.id)) : practice.location
  const details = [practice.description, `${MODE_LABELS[practice.mode]} practice hosted by ${practice.organizer.name}.`, url].filter(Boolean)

  return {
    uid: `${practice.id}@practices`,
    title: practice.title,
    details: details.join('\n\n'),
    location,
    startsAt: practice.startsAt,
    endsAt: practice.endsAt,
    url,
  }
}

// "20261119T150000Z", the UTC form that iCalendar and Google Calendar both read.
const utcStamp = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')

// Text values escape backslashes, semicolons, commas and line breaks (RFC 5545, 3.3.11).
const escapeText = (text: string) => text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

const LINE_LIMIT_BYTES = 75
const encoder = new TextEncoder()

// Lines longer than 75 bytes continue on the next line after a space (RFC 5545, 3.1). Characters are never split in half.
const foldLine = (line: string) => {
  const pieces: string[] = []
  let piece = ''
  let pieceBytes = 0
  for (const character of line) {
    const bytes = encoder.encode(character).length
    // Every continuation line starts with a space, which counts toward its limit.
    const limit = pieces.length === 0 ? LINE_LIMIT_BYTES : LINE_LIMIT_BYTES - 1
    if (pieceBytes + bytes > limit) {
      pieces.push(piece)
      piece = ''
      pieceBytes = 0
    }
    piece += character
    pieceBytes += bytes
  }
  pieces.push(piece)
  return pieces.join('\r\n ')
}

// The .ics file that Apple Calendar, Outlook and most calendar apps import.
// The same uid every time, so downloading it again after a change updates the event instead of adding a second one.
export const practiceIcsFile = (practice: PracticeView, audience: CalendarAudience, now = new Date()) => {
  const entry = calendarEntryFor(practice, audience)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Practices//Practices//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${entry.uid}`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${utcStamp(entry.startsAt)}`,
    `DTEND:${utcStamp(entry.endsAt)}`,
    `SUMMARY:${escapeText(entry.title)}`,
    `DESCRIPTION:${escapeText(entry.details)}`,
    ...(entry.location ? [`LOCATION:${escapeText(entry.location)}`] : []),
    `URL:${entry.url}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return `${lines.map(foldLine).join('\r\n')}\r\n`
}

export const practiceIcsFileName = (practice: PracticeView) => {
  const slug = practice.title
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '-')
    .slice(0, 50)
  return `${slug || 'practice'}.ics`
}

// Opens Google Calendar with the event filled in, ready to save.
export const googleCalendarLink = (practice: PracticeView, audience: CalendarAudience) => {
  const entry = calendarEntryFor(practice, audience)
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: entry.title,
    dates: `${utcStamp(entry.startsAt)}/${utcStamp(entry.endsAt)}`,
    details: entry.details,
  })
  if (entry.location) params.set('location', entry.location)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
