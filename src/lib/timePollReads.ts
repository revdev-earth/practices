import 'server-only'

import { cookies } from 'next/headers'

import { getUser, type SessionUser } from '+/lib/auth'
import { prisma } from '+/lib/prisma'
import { bestOptionIds, POLL_VOTER_COOKIE, type PollAnswer, type PollKind } from '+/lib/timePolls'

// Who is answering: the account when there is a session, else the guest cookie of this browser. Null for a guest who never answered.
export const currentPollVoter = async (): Promise<{ key: string | null; user: SessionUser | null }> => {
  const user = await getUser()
  if (user) return { key: `user:${user.id}`, user }
  const guestId = (await cookies()).get(POLL_VOTER_COOKIE)?.value
  return { key: guestId ? `guest:${guestId}` : null, user: null }
}

export type PollOptionView = {
  id: string
  // The calendar date of an option of a day poll.
  day: string | null
  startsAt: Date
  endsAt: Date
  tally: { yes: number; ifNeeded: number; no: number }
  isBest: boolean
}

export type PollVoterRow = {
  key: string
  name: string
  hasAccount: boolean
  isViewer: boolean
  // By option id. A time the person did not answer is missing.
  answers: Record<string, PollAnswer>
}

export type TimePollView = {
  id: string
  title: string
  description: string
  durationMin: number
  kind: PollKind
  organizer: { id: string; name: string }
  isOrganizer: boolean
  // Sorted by time.
  options: PollOptionView[]
  // In the order they first answered.
  voters: PollVoterRow[]
  viewerAnswers: Record<string, PollAnswer>
  practiceId: string | null
  createdAt: Date
}

export const getTimePoll = async (pollId: string, viewer: { key: string | null; user: SessionUser | null }): Promise<TimePollView | null> => {
  const poll = await prisma.timePoll.findUnique({
    where: { id: pollId },
    include: {
      organizer: { select: { id: true, name: true } },
      options: {
        orderBy: { startsAt: 'asc' },
        include: { votes: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
      },
    },
  })
  if (!poll) return null

  const voters = new Map<string, PollVoterRow>()
  for (const option of poll.options) {
    for (const vote of option.votes) {
      const row = voters.get(vote.voterKey) ?? {
        key: vote.voterKey,
        name: vote.name,
        hasAccount: Boolean(vote.userId),
        isViewer: vote.voterKey === viewer.key,
        answers: {},
      }
      row.answers[option.id] = vote.answer
      voters.set(vote.voterKey, row)
    }
  }

  const options = poll.options.map((option) => {
    const count = (answer: PollAnswer) => option.votes.filter((vote) => vote.answer === answer).length
    return {
      id: option.id,
      day: option.day,
      startsAt: option.startsAt,
      endsAt: new Date(option.startsAt.getTime() + poll.durationMin * 60_000),
      tally: { yes: count('YES'), ifNeeded: count('IF_NEEDED'), no: count('NO') },
      isBest: false,
    }
  })
  const best = bestOptionIds(options)
  for (const option of options) option.isBest = best.has(option.id)

  return {
    id: poll.id,
    title: poll.title,
    description: poll.description,
    durationMin: poll.durationMin,
    kind: poll.kind,
    organizer: poll.organizer,
    isOrganizer: viewer.user?.id === poll.organizerId,
    options,
    voters: [...voters.values()],
    viewerAnswers: (viewer.key && voters.get(viewer.key)?.answers) || {},
    practiceId: poll.practiceId,
    createdAt: poll.createdAt,
  }
}

export type PollSummary = {
  id: string
  title: string
  optionCount: number
  voterCount: number
  isOrganizer: boolean
  practiceId: string | null
  kind: PollKind
  firstOption: { startsAt: Date; day: string | null } | null
}

// The polls a person hosts and the ones they answered, newest first.
export const getPollsOf = async (userId: string): Promise<PollSummary[]> => {
  const polls = await prisma.timePoll.findMany({
    where: { OR: [{ organizerId: userId }, { options: { some: { votes: { some: { userId } } } } }] },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { options: { orderBy: { startsAt: 'asc' }, select: { startsAt: true, day: true, votes: { select: { voterKey: true } } } } },
  })
  return polls.map((poll) => ({
    id: poll.id,
    title: poll.title,
    optionCount: poll.options.length,
    voterCount: new Set(poll.options.flatMap((option) => option.votes.map((vote) => vote.voterKey))).size,
    isOrganizer: poll.organizerId === userId,
    practiceId: poll.practiceId,
    kind: poll.kind,
    firstOption: poll.options[0] ?? null,
  }))
}
