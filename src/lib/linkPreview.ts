import 'server-only'

import { statusText } from '+/components/StatusMark'
import { formatDuration, formatLongDate, formatShortDateTime, formatShortDayKey, formatTime, formatZone } from '+/lib/dates'
import { getPractice } from '+/lib/practices'
import { MODE_LABELS, type PracticeStatus } from '+/lib/practiceRules'
import { prisma } from '+/lib/prisma'

// What a chat app shows when someone pastes a link. The app fetches the page from its own server, with no time zone
// of the reader, so the times are written in the zone of the host with the zone spelled out.

const zoneOfUser = async (userId: string) => (await prisma.user.findUnique({ where: { id: userId }, select: { timeZone: true } }))?.timeZone ?? 'UTC'

export type PracticePreview = {
  title: string
  status: PracticeStatus
  statusLabel: string
  // "Thursday, November 19"
  day: string
  // "19:00 to 20:00 (GMT+1), 1 h"
  time: string
  // "Online, hosted by Revi"
  place: string
  taken: number
  maxParticipants: number
  minParticipants: number
  // One sentence with all of the above, for the description of the link.
  description: string
}

// The preview of a public practice. Null for a practice that does not exist or is private, so its link gives nothing away.
export const publicPracticePreview = async (practiceId: string): Promise<PracticePreview | null> => {
  const practice = await getPractice(practiceId, '')
  if (!practice || !practice.isPublic) return null

  const timeZone = await zoneOfUser(practice.organizer.id)
  const day = formatLongDate(practice.startsAt, timeZone)
  const time = `${formatTime(practice.startsAt, timeZone)} to ${formatTime(practice.endsAt, timeZone)} (${formatZone(practice.startsAt, timeZone)}), ${formatDuration(practice.durationMin)}`
  const place = `${MODE_LABELS[practice.mode]}, hosted by ${practice.organizer.name}`
  const taken = practice.confirmed.length
  const spots =
    practice.status === 'past'
      ? 'It already took place.'
      : practice.status === 'full'
        ? `All ${practice.maxParticipants} spots are taken. The waitlist is open.`
        : `${taken} of ${practice.maxParticipants} spots taken${practice.missing > 0 ? `, ${practice.missing} more needed to confirm it` : ', confirmed'}.`

  return {
    title: practice.title,
    status: practice.status,
    statusLabel: statusText(practice),
    day,
    time,
    place,
    taken,
    maxParticipants: practice.maxParticipants,
    minParticipants: practice.minParticipants,
    description: `${day}, ${time}. ${place}. ${spots} Open it to see it in your own time zone.`,
  }
}

export type PollPreview = {
  title: string
  // "3 days to choose from, from Thu, Nov 26"
  choices: string
  host: string
  isClosed: boolean
  description: string
}

export const pollPreview = async (pollId: string): Promise<PollPreview | null> => {
  const poll = await prisma.timePoll.findUnique({
    where: { id: pollId },
    select: {
      title: true,
      kind: true,
      practiceId: true,
      organizer: { select: { id: true, name: true } },
      options: { orderBy: { startsAt: 'asc' }, select: { startsAt: true, day: true } },
    },
  })
  if (!poll) return null

  const timeZone = await zoneOfUser(poll.organizer.id)
  const first = poll.options[0]
  const noun = poll.kind === 'DAYS' ? 'days' : 'times'
  const from = first
    ? first.day
      ? formatShortDayKey(first.day)
      : `${formatShortDateTime(first.startsAt, timeZone)} (${formatZone(first.startsAt, timeZone)})`
    : ''
  const choices = `${poll.options.length} ${noun} to choose from${from ? `, from ${from}` : ''}`

  return {
    title: poll.title,
    choices,
    host: poll.organizer.name,
    isClosed: Boolean(poll.practiceId),
    description: poll.practiceId
      ? `${poll.organizer.name} already chose the ${poll.kind === 'DAYS' ? 'day' : 'time'}. Open it to see the practice.`
      : `${poll.organizer.name} asks which ${noun} work for you. ${choices}. Answer yes, if needed or no, with or without an account.`,
  }
}
