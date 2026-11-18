import type { Metadata } from 'next'

import { createPracticeAction } from '+/actions/practices'
import { requireUser } from '+/lib/auth'
import { prisma } from '+/lib/prisma'
import { dayKey, formatZone, formatZoneCity, isDayKey, shiftDayKey, toDateTimeLocal } from '+/lib/dates'
import { HOME_PATH, pollPath } from '+/lib/redirects'
import { getTimeZone } from '+/lib/timezone'

import PracticeForm, { type PracticeFormDefaults } from '../_/PracticeForm'

export const metadata: Metadata = { title: 'Post a practice' }

// An evening hour, a common time to meet.
const SUGGESTED_START_HOUR = 19

const asClockTime = (hour: number) => `${String(hour).padStart(2, '0')}:00`

// The form opens on the day picked in the calendar, or on tomorrow, at the suggested hour.
// For today the hour has to be still ahead, so late in the day the form moves to tomorrow.
const suggestedStart = (requestedDay: string | undefined, now: Date, timeZone: string) => {
  const today = dayKey(now, timeZone)
  const tomorrow = shiftDayKey(today, 1)
  const day = isDayKey(requestedDay) && requestedDay >= today ? requestedDay : tomorrow
  if (day !== today) return `${day}T${asClockTime(SUGGESTED_START_HOUR)}`

  const nextFullHour = Number(toDateTimeLocal(now, timeZone).slice(11, 13)) + 1
  if (nextFullHour > 23) return `${tomorrow}T${asClockTime(SUGGESTED_START_HOUR)}`
  return `${today}T${asClockTime(Math.max(nextFullHour, SUGGESTED_START_HOUR))}`
}

type NewPracticePageProps = {
  searchParams: Promise<{ day?: string; poll?: string; option?: string }>
}

// The time a host chose in one of their polls that has no practice yet.
const chosenPollTime = (pollId: string | undefined, optionId: string | undefined, organizerId: string) =>
  pollId && optionId
    ? prisma.timePollOption.findFirst({
        where: { id: optionId, poll: { id: pollId, organizerId, practiceId: null } },
        select: { id: true, startsAt: true, poll: { select: { id: true, title: true, description: true, durationMin: true } } },
      })
    : null

export default async function NewPracticePage({ searchParams }: NewPracticePageProps) {
  const user = await requireUser()
  const [{ day: requestedDay, poll: pollId, option: optionId }, timeZone] = await Promise.all([searchParams, getTimeZone()])
  const now = new Date()
  const fromPoll = await chosenPollTime(pollId, optionId, user.id)

  const defaults: PracticeFormDefaults = {
    title: fromPoll?.poll.title ?? '',
    description: fromPoll?.poll.description ?? '',
    startsAtLocal: fromPoll ? toDateTimeLocal(fromPoll.startsAt, timeZone) : suggestedStart(requestedDay, now, timeZone),
    durationMin: fromPoll?.poll.durationMin ?? 60,
    mode: 'ONLINE',
    videoRoom: true,
    isPublic: false,
    location: '',
    minParticipants: 3,
    maxParticipants: 6,
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-4xl font-bold tracking-tight">Post a practice</h1>
      <p className="mt-2 text-muted">
        {fromPoll
          ? 'You take the first spot on the sign-up sheet. The people with an account who said yes to this time take the next ones.'
          : 'You take the first spot on the sign-up sheet.'}
      </p>

      <div className="mt-8 rounded-xl border border-line bg-sheet p-6 sm:p-8">
        <PracticeForm
          action={createPracticeAction}
          defaults={defaults}
          viewerZone={`${formatZoneCity(timeZone)} (${formatZone(now, timeZone)})`}
          submitLabel="Post practice"
          pendingLabel="Posting…"
          cancelHref={fromPoll ? pollPath(fromPoll.poll.id) : HOME_PATH}
          hiddenFields={fromPoll ? { pollId: fromPoll.poll.id, pollOptionId: fromPoll.id } : undefined}
        />
      </div>
    </div>
  )
}
