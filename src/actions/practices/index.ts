'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { getUser } from '+/lib/auth'
import { noticeCancellation, noticePollDecision, noticeSheetChanges, readSheet, rememberTimeZone } from '+/lib/practiceNotices'
import { practiceSchema } from '+/lib/practiceRules'
import { prisma } from '+/lib/prisma'
import { HOME_PATH, sharePath } from '+/lib/redirects'

export type PracticeFormState = {
  success: boolean
  errors?: Record<string, string[]>
}

export type PracticeActionResult = {
  success: boolean
  error?: string
}

const SESSION_ENDED = 'Your session ended. Log in again.'

const parsePracticeForm = (formData: FormData) => {
  const text = (name: string) => String(formData.get(name) ?? '')
  return practiceSchema.safeParse({
    title: text('title'),
    description: text('description'),
    startsAt: text('startsAt'),
    durationMin: text('durationMin'),
    mode: text('mode'),
    videoRoom: text('videoRoom'),
    visibility: text('visibility'),
    location: text('location'),
    minParticipants: text('minParticipants'),
    maxParticipants: text('maxParticipants'),
  })
}

const endOf = (startsAt: Date, durationMin: number) => new Date(startsAt.getTime() + durationMin * 60000)

// A change shows up in the list, in the practice itself and on the calendar.
const refreshPractices = () => {
  revalidatePath('/practices', 'layout')
  revalidatePath('/calendar')
}

// A practice posted from a poll names the poll and the time the host chose. The people who said yes to that time
// take the next spots, in the order they answered. Null when the form does not come from a poll.
type PollArrival = { kind: 'member'; userId: string } | { kind: 'guest'; guestKey: string; name: string }

const chosenPollTime = async (formData: FormData, organizerId: string) => {
  const pollId = String(formData.get('pollId') ?? '')
  const optionId = String(formData.get('pollOptionId') ?? '')
  if (!pollId) return null

  const option = await prisma.timePollOption.findFirst({
    where: { id: optionId, poll: { id: pollId, organizerId, practiceId: null } },
    select: {
      votes: { where: { answer: 'YES' }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { userId: true, voterKey: true, name: true } },
    },
  })
  if (!option) return { usable: false, error: 'This poll was already used or is not yours.' } as const
  // A person with an account, or a browser without one, with the name they answered with.
  const yesVoters = option.votes
    .filter((vote) => vote.userId !== organizerId)
    .map((vote): PollArrival =>
      vote.userId ? { kind: 'member', userId: vote.userId } : { kind: 'guest', guestKey: vote.voterKey.replace(/^guest:/, ''), name: vote.name }
    )
  return { usable: true, pollId, optionId, yesVoters } as const
}

export const createPracticeAction = async (_prevState: PracticeFormState, formData: FormData): Promise<PracticeFormState> => {
  const user = await getUser()
  if (!user) return { success: false, errors: { form: [SESSION_ENDED] } }

  const parsed = parsePracticeForm(formData)
  if (!parsed.success) return { success: false, errors: z.flattenError(parsed.error).fieldErrors }

  const { durationMin, visibility, ...practice } = parsed.data
  if (practice.startsAt.getTime() < Date.now()) return { success: false, errors: { startsAt: ['That time has already passed'] } }

  const fromPoll = await chosenPollTime(formData, user.id)
  if (fromPoll && !fromPoll.usable) return { success: false, errors: { form: [fromPoll.error] } }

  let practiceId: string
  try {
    // Whoever posts takes the first spot on the list. The yes answers of a poll come right after, a second apart to keep their order.
    const now = Date.now()
    // People without an account only get a spot on a public practice, the only kind they can open.
    const yesVoters = (fromPoll?.yesVoters ?? []).filter((voter) => voter.kind === 'member' || visibility)
    const arrivals: PollArrival[] = [{ kind: 'member', userId: user.id }, ...yesVoters]
    const joinedAt = (index: number) => new Date(now + index * 1000)
    const signups = arrivals.flatMap((arrival, index) => (arrival.kind === 'member' ? [{ userId: arrival.userId, joinedAt: joinedAt(index) }] : []))
    const guestSignups = arrivals.flatMap((arrival, index) =>
      arrival.kind === 'guest' ? [{ guestKey: arrival.guestKey, name: arrival.name, joinedAt: joinedAt(index) }] : []
    )
    const created = await prisma.practice.create({
      data: {
        ...practice,
        isPublic: visibility,
        endsAt: endOf(practice.startsAt, durationMin),
        organizerId: user.id,
        signups: { create: signups },
        guestSignups: { create: guestSignups },
        ...(fromPoll ? { timePoll: { connect: { id: fromPoll.pollId } } } : {}),
      },
      select: { id: true },
    })
    practiceId = created.id
    await rememberTimeZone(user.id)
    if (fromPoll) await noticePollDecision(practiceId, fromPoll.optionId, user.id)
  } catch (error) {
    console.error('Posting the practice failed:', error)
    return { success: false, errors: { form: ['The practice could not be posted. Try again.'] } }
  }

  refreshPractices()
  redirect(`/practices/${practiceId}`)
}

export const updatePracticeAction = async (practiceId: string, _prevState: PracticeFormState, formData: FormData): Promise<PracticeFormState> => {
  const user = await getUser()
  if (!user) return { success: false, errors: { form: [SESSION_ENDED] } }

  const parsed = parsePracticeForm(formData)
  if (!parsed.success) return { success: false, errors: z.flattenError(parsed.error).fieldErrors }

  const current = await prisma.practice.findUnique({ where: { id: practiceId }, select: { organizerId: true, startsAt: true, endsAt: true } })
  if (!current) return { success: false, errors: { form: ['This practice no longer exists.'] } }
  if (current.organizerId !== user.id) return { success: false, errors: { form: ['Only the organizer can edit this practice.'] } }
  if (current.endsAt < new Date()) return { success: false, errors: { form: ['This practice already ended and can no longer be edited.'] } }

  const { durationMin, visibility, ...practice } = parsed.data
  // A practice that already started keeps its time. Only moving the date into the past is rejected.
  const movedStart = practice.startsAt.getTime() !== current.startsAt.getTime()
  if (movedStart && practice.startsAt.getTime() < Date.now()) return { success: false, errors: { startsAt: ['That time has already passed'] } }

  try {
    const before = await readSheet(practiceId)
    await prisma.practice.update({
      where: { id: practiceId },
      data: { ...practice, isPublic: visibility, endsAt: endOf(practice.startsAt, durationMin) },
    })
    // A new maximum can move people up from the waitlist, a new minimum can confirm the practice, a new time concerns everyone.
    noticeSheetChanges(before, await readSheet(practiceId), user.id)
  } catch (error) {
    console.error('Saving the practice failed:', error)
    return { success: false, errors: { form: ['The changes could not be saved. Try again.'] } }
  }

  refreshPractices()
  // The sheet stays where it is. The form closes itself and the page shows the saved practice.
  return { success: true }
}

export const deletePracticeAction = async (practiceId: string): Promise<PracticeActionResult> => {
  const user = await getUser()
  if (!user) return { success: false, error: SESSION_ENDED }

  const before = await readSheet(practiceId)
  const deleted = await prisma.practice.deleteMany({ where: { id: practiceId, organizerId: user.id } })
  if (deleted.count === 0) return { success: false, error: 'Only the organizer can delete this practice.' }
  noticeCancellation(before, user.name, user.id)

  refreshPractices()
  redirect(HOME_PATH)
}

const findOpenPractice = async (practiceId: string): Promise<PracticeActionResult> => {
  const practice = await prisma.practice.findUnique({ where: { id: practiceId }, select: { endsAt: true } })
  if (!practice) return { success: false, error: 'This practice no longer exists.' }
  if (practice.endsAt < new Date()) return { success: false, error: 'This practice already ended.' }
  return { success: true }
}

export const joinPracticeAction = async (practiceId: string): Promise<PracticeActionResult> => {
  const user = await getUser()
  if (!user) return { success: false, error: SESSION_ENDED }

  const open = await findOpenPractice(practiceId)
  if (!open.success) return open

  const before = await readSheet(practiceId)
  // Joining twice changes nothing: the original place on the list is kept.
  await prisma.signup.upsert({
    where: { practiceId_userId: { practiceId, userId: user.id } },
    create: { practiceId, userId: user.id },
    update: {},
  })
  await rememberTimeZone(user.id)
  noticeSheetChanges(before, await readSheet(practiceId), user.id)

  refreshPractices()
  return { success: true }
}

export const leavePracticeAction = async (practiceId: string): Promise<PracticeActionResult> => {
  const user = await getUser()
  if (!user) return { success: false, error: SESSION_ENDED }

  const open = await findOpenPractice(practiceId)
  if (!open.success) return open

  const before = await readSheet(practiceId)
  await prisma.signup.deleteMany({ where: { practiceId, userId: user.id } })
  noticeSheetChanges(before, await readSheet(practiceId), user.id)

  refreshPractices()
  return { success: true }
}

// The host takes someone without an account off the sheet, for instance a name typed as a joke.
export const removeGuestSpotAction = async (practiceId: string, guestSignupId: string): Promise<PracticeActionResult> => {
  const user = await getUser()
  if (!user) return { success: false, error: SESSION_ENDED }

  const practice = await prisma.practice.findUnique({ where: { id: practiceId }, select: { organizerId: true } })
  if (!practice || practice.organizerId !== user.id) return { success: false, error: 'Only the host can take someone off the sheet.' }

  const before = await readSheet(practiceId)
  await prisma.guestSignup.deleteMany({ where: { id: guestSignupId, practiceId } })
  noticeSheetChanges(before, await readSheet(practiceId), user.id)

  refreshPractices()
  revalidatePath(sharePath(practiceId))
  return { success: true }
}
