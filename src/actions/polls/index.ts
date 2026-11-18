'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { getUser } from '+/lib/auth'
import { takeAttempts, tryAgainLater, visitorAddress } from '+/lib/attemptLimits'
import { prisma } from '+/lib/prisma'
import { pollPath } from '+/lib/redirects'
import { isPollAnswer, POLL_VOTER_COOKIE, pollVoterNameSchema, timePollSchema } from '+/lib/timePolls'

export type PollFormState = {
  success: boolean
  errors?: Record<string, string[]>
}

const SESSION_ENDED = 'Your session ended. Log in again.'
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60

// The host proposes the times. Each one arrives as an exact instant, like the start of a practice.
export const createTimePollAction = async (_prevState: PollFormState, formData: FormData): Promise<PollFormState> => {
  const user = await getUser()
  if (!user) return { success: false, errors: { form: [SESSION_ENDED] } }

  const parsed = timePollSchema.safeParse({
    title: String(formData.get('title') ?? ''),
    description: String(formData.get('description') ?? ''),
    durationMin: String(formData.get('durationMin') ?? ''),
    options: formData.getAll('options').map(String),
  })
  if (!parsed.success) return { success: false, errors: z.flattenError(parsed.error).fieldErrors }

  let pollId: string
  try {
    const { options, ...poll } = parsed.data
    const created = await prisma.timePoll.create({
      data: { ...poll, organizerId: user.id, options: { create: options.map((startsAt) => ({ startsAt })) } },
      select: { id: true },
    })
    pollId = created.id
  } catch (error) {
    console.error('Creating the poll failed:', error)
    return { success: false, errors: { form: ['The poll could not be created. Try again.'] } }
  }

  revalidatePath('/polls')
  redirect(pollPath(pollId))
}

// Saves the answers of one person to every time of the poll. With an account the name is the one of the account.
// Without one the person types a name and a cookie keeps their answers theirs, so they can change them later.
export const answerTimePollAction = async (pollId: string, _prevState: PollFormState, formData: FormData): Promise<PollFormState> => {
  const poll = await prisma.timePoll.findUnique({ where: { id: pollId }, select: { practiceId: true, options: { select: { id: true } } } })
  if (!poll) return { success: false, errors: { form: ['This poll no longer exists.'] } }
  if (poll.practiceId) return { success: false, errors: { form: ['The host already chose the time. The poll is closed.'] } }

  const user = await getUser()
  let voter: { key: string; userId: string | null; name: string }

  if (user) {
    voter = { key: `user:${user.id}`, userId: user.id, name: user.name }
  } else {
    const name = pollVoterNameSchema.safeParse(String(formData.get('name') ?? ''))
    if (!name.success) return { success: false, errors: { name: [name.error.issues[0].message] } }

    const verdict = await takeAttempts([['pollAnswersFromAddress', await visitorAddress()]])
    if (!verdict.allowed) return { success: false, errors: { form: [tryAgainLater(verdict.retryInMinutes)] } }

    const cookieStore = await cookies()
    let guestId = cookieStore.get(POLL_VOTER_COOKIE)?.value
    if (!guestId) {
      guestId = crypto.randomUUID()
      cookieStore.set(POLL_VOTER_COOKIE, guestId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: ONE_YEAR_SECONDS,
        path: '/',
      })
    }
    voter = { key: `guest:${guestId}`, userId: null, name: name.data }
  }

  // A time with no answer counts as no.
  const answers = poll.options.map((option) => {
    const value = formData.get(`answer-${option.id}`)
    return { optionId: option.id, answer: isPollAnswer(value) ? value : 'NO' }
  })

  try {
    await prisma.$transaction(
      answers.map(({ optionId, answer }) =>
        prisma.timePollVote.upsert({
          where: { optionId_voterKey: { optionId, voterKey: voter.key } },
          create: { optionId, voterKey: voter.key, userId: voter.userId, name: voter.name, answer },
          update: { answer, name: voter.name },
        })
      )
    )
  } catch (error) {
    console.error('Saving the poll answers failed:', error)
    return { success: false, errors: { form: ['Your answers could not be saved. Try again.'] } }
  }

  revalidatePath(pollPath(pollId))
  return { success: true }
}

export const deleteTimePollAction = async (pollId: string): Promise<{ success: boolean; error?: string }> => {
  const user = await getUser()
  if (!user) return { success: false, error: SESSION_ENDED }

  const deleted = await prisma.timePoll.deleteMany({ where: { id: pollId, organizerId: user.id } })
  if (deleted.count === 0) return { success: false, error: 'Only the host can delete this poll.' }

  revalidatePath('/polls')
  redirect('/polls')
}
