import 'server-only'

import { after } from 'next/server'

import { formatLongDate, formatTime, formatZone } from '+/lib/dates'
import { sendPracticeNotice } from '+/lib/email'
import { sheetOrder } from '+/lib/practices'
import { prisma } from '+/lib/prisma'
import { absoluteUrl, practicePath } from '+/lib/redirects'
import { getBrowserTimeZone } from '+/lib/timezone'

// Emails to the people of a practice when something changes for them:
// the practice reached its minimum, someone moved up from the waitlist, the host moved the time or cancelled it.
// Each action reads the sheet before and after its change and these functions compare both.

// A guest without an account has no email, so the notices leave them out. They still count for the order of the sheet.
type Person = { id: string; name: string; email: string | null; timeZone: string | null }

export type SheetSnapshot = {
  id: string
  title: string
  startsAt: Date
  endsAt: Date
  minParticipants: number
  // By arrival order, as on the sheet.
  confirmed: Person[]
  waiting: Person[]
}

// The people a notice can reach: the ones with an email.
const withEmail = (people: Person[]) => people.filter((person): person is Person & { email: string } => Boolean(person.email))

const personSelect = { id: true, name: true, email: true, timeZone: true } as const

export const readSheet = async (practiceId: string): Promise<SheetSnapshot | null> => {
  const practice = await prisma.practice.findUnique({
    where: { id: practiceId },
    select: {
      id: true,
      title: true,
      startsAt: true,
      endsAt: true,
      minParticipants: true,
      maxParticipants: true,
      signups: { orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }], select: { id: true, joinedAt: true, user: { select: personSelect } } },
      guestSignups: { select: { id: true, joinedAt: true, name: true } },
    },
  })
  if (!practice) return null

  const members = practice.signups.map(({ id, joinedAt, user }) => ({ id, joinedAt, person: user as Person }))
  const guests = practice.guestSignups.map(({ id, joinedAt, name }) => ({
    id,
    joinedAt,
    person: { id: `guest:${id}`, name, email: null, timeZone: null } as Person,
  }))
  const people = sheetOrder(members, guests).map((entry) => entry.person)
  return {
    id: practice.id,
    title: practice.title,
    startsAt: practice.startsAt,
    endsAt: practice.endsAt,
    minParticipants: practice.minParticipants,
    confirmed: people.slice(0, practice.maxParticipants),
    waiting: people.slice(practice.maxParticipants),
  }
}

// Emails are built with no browser. A person who never left a zone gets the time in UTC, written as such.
const whenFor = (sheet: Pick<SheetSnapshot, 'startsAt' | 'endsAt'>, person: Person) => {
  const timeZone = person.timeZone ?? 'UTC'
  return `${formatLongDate(sheet.startsAt, timeZone)}, ${formatTime(sheet.startsAt, timeZone)} to ${formatTime(sheet.endsAt, timeZone)} (${formatZone(sheet.startsAt, timeZone)})`
}

const openPractice = (sheet: SheetSnapshot) => ({ label: 'Open the practice', href: absoluteUrl(practicePath(sheet.id)) })

const isNewlyConfirmed = (before: SheetSnapshot, after: SheetSnapshot) =>
  before.confirmed.length < before.minParticipants && after.confirmed.length >= after.minParticipants

// Compares the sheet before and after a change and emails each person it concerns. The person who made the change sees the result
// on screen and gets no email about it. The emails go out after the answer, so nobody waits for them.
export const noticeSheetChanges = (before: SheetSnapshot | null, after_: SheetSnapshot | null, changedBy: string) => {
  if (!before || !after_) return

  const confirmedBefore = new Set(before.confirmed.map((person) => person.id))
  const movedUp = after_.confirmed.filter((person) => !confirmedBefore.has(person.id) && before.waiting.some((waiting) => waiting.id === person.id))
  const practiceConfirmed = isNewlyConfirmed(before, after_)
  const timeMoved = before.startsAt.getTime() !== after_.startsAt.getTime() || before.endsAt.getTime() !== after_.endsAt.getTime()

  const notices: (() => Promise<void>)[] = []

  for (const person of withEmail(movedUp)) {
    if (person.id === changedBy) continue
    notices.push(() =>
      sendPracticeNotice({
        kind: 'spot freed',
        to: person.email,
        subject: `You have a spot in ${after_.title}`,
        heading: 'A spot freed up for you',
        paragraphs: [
          `Someone left ${after_.title} and you moved up from the waitlist. You have a spot now.`,
          whenFor(after_, person),
          'If you can no longer make it, leave the practice so the next person on the waitlist gets the spot.',
        ],
        action: openPractice(after_),
      })
    )
  }

  if (practiceConfirmed) {
    const movedUpIds = new Set(movedUp.map((person) => person.id))
    for (const person of withEmail(after_.confirmed)) {
      if (person.id === changedBy || movedUpIds.has(person.id)) continue
      notices.push(() =>
        sendPracticeNotice({
          kind: 'practice confirmed',
          to: person.email,
          subject: `${after_.title} is confirmed`,
          heading: 'The practice is happening',
          paragraphs: [`${after_.title} reached its minimum of ${after_.minParticipants} people, so it is confirmed.`, whenFor(after_, person)],
          action: openPractice(after_),
        })
      )
    }
  }

  if (timeMoved) {
    for (const person of withEmail([...after_.confirmed, ...after_.waiting])) {
      if (person.id === changedBy) continue
      notices.push(() =>
        sendPracticeNotice({
          kind: 'practice moved',
          to: person.email,
          subject: `${after_.title} has a new time`,
          heading: 'The time changed',
          paragraphs: [`The host moved ${after_.title}.`, `It was ${whenFor(before, person)}.`, `It is now ${whenFor(after_, person)}.`],
          action: openPractice(after_),
        })
      )
    }
  }

  sendAfterAnswer(notices)
}

// The practice is gone, so the email carries everything and links to nothing.
export const noticeCancellation = (before: SheetSnapshot | null, organizerName: string, changedBy: string) => {
  if (!before || before.endsAt < new Date()) return

  const notices = withEmail([...before.confirmed, ...before.waiting])
    .filter((person) => person.id !== changedBy)
    .map(
      (person) => () =>
        sendPracticeNotice({
          kind: 'practice cancelled',
          to: person.email,
          subject: `${before.title} was cancelled`,
          heading: 'The practice was cancelled',
          paragraphs: [`${organizerName} cancelled ${before.title}.`, `It was planned for ${whenFor(before, person)}.`],
        })
    )

  sendAfterAnswer(notices)
}

const sendAfterAnswer = (notices: (() => Promise<void>)[]) => {
  if (notices.length === 0) return
  after(async () => {
    const results = await Promise.allSettled(notices.map((send) => send()))
    for (const result of results) if (result.status === 'rejected') console.error('A practice notice could not be sent:', result.reason)
  })
}

// Keeps the zone of the browser on the account, so the emails show times as the person sees them in the app.
export const rememberTimeZone = async (userId: string) => {
  const timeZone = await getBrowserTimeZone()
  if (!timeZone) return
  await prisma.user.updateMany({ where: { id: userId, OR: [{ timeZone: null }, { timeZone: { not: timeZone } }] }, data: { timeZone } })
}

// The host posted the practice at a time chosen in a poll. Whoever said yes with an account is already on the sheet,
// and whoever said if needed is told the time so they can join.
export const noticePollDecision = async (practiceId: string, optionId: string, organizerId: string) => {
  const [sheet, votes, option] = await Promise.all([
    readSheet(practiceId),
    prisma.timePollVote.findMany({
      where: { optionId, answer: 'IF_NEEDED', user: { isNot: null } },
      select: { user: { select: personSelect } },
    }),
    prisma.timePollOption.findUnique({ where: { id: optionId }, select: { day: true } }),
  ])
  if (!sheet) return
  // A poll of days asked for the day, a poll of times for the exact time.
  const choice = option?.day ? 'a day' : 'a time'

  const confirmedIds = new Set(sheet.confirmed.map((person) => person.id))
  const notices: (() => Promise<void>)[] = []

  for (const person of withEmail([...sheet.confirmed, ...sheet.waiting])) {
    if (person.id === organizerId) continue
    const hasSpot = confirmedIds.has(person.id)
    notices.push(() =>
      sendPracticeNotice({
        kind: 'poll decided',
        to: person.email,
        subject: `${sheet.title} is set for ${choice} you said yes to`,
        heading: 'The time is chosen',
        paragraphs: [
          `The host chose a time for ${sheet.title} and you said yes to it.`,
          whenFor(sheet, person),
          hasSpot
            ? 'You are already on the sign-up sheet. If you can no longer make it, leave the practice so someone else gets the spot.'
            : 'You are on the waitlist, because the spots filled up. You move up when someone leaves.',
        ],
        action: openPractice(sheet),
      })
    )
  }

  for (const { user } of votes) {
    if (!user || user.id === organizerId) continue
    notices.push(() =>
      sendPracticeNotice({
        kind: 'poll decided',
        to: user.email,
        subject: `${sheet.title} is set for ${choice} you could make`,
        heading: 'The time is chosen',
        paragraphs: [
          `The host chose a time for ${sheet.title}. You said it works if needed.`,
          whenFor(sheet, user),
          'Join the practice if you can come.',
        ],
        action: openPractice(sheet),
      })
    )
  }

  sendAfterAnswer(notices)
}
