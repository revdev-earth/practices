import { z } from 'zod'

import { DURATION_OPTIONS, GUEST_NAME_LIMITS, PRACTICE_LIMITS } from '+/lib/practiceRules'

// Rules of the polls that find the best time for a practice, shared by the forms (browser) and the actions (server).

export const POLL_OPTION_LIMITS = { min: 2, max: 10 } as const

export const POLL_ANSWERS = ['YES', 'IF_NEEDED', 'NO'] as const
export type PollAnswer = (typeof POLL_ANSWERS)[number]

export const ANSWER_LABELS: Record<PollAnswer, string> = { YES: 'Yes', IF_NEEDED: 'If needed', NO: 'No' }

// The cookie that keeps the answers of someone without an account, so they can change them from the same browser.
export const POLL_VOTER_COOKIE = 'poll_voter'

const { title, description } = PRACTICE_LIMITS

export const timePollSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(title.min, `The title needs at least ${title.min} characters`)
      .max(title.max, `The title can have up to ${title.max} characters`),
    description: z.string().trim().max(description.max, `The description can have up to ${description.max} characters`),
    durationMin: z.coerce.number().refine((value) => DURATION_OPTIONS.includes(value), 'Pick a duration from the list'),
    // Each time arrives as an exact instant in UTC, as in the practice form.
    options: z
      .array(z.iso.datetime({ error: 'Pick a date and a time' }).transform((value) => new Date(value)))
      .min(POLL_OPTION_LIMITS.min, `Propose at least ${POLL_OPTION_LIMITS.min} times`)
      .max(POLL_OPTION_LIMITS.max, `Propose at most ${POLL_OPTION_LIMITS.max} times`),
  })
  .refine((poll) => new Set(poll.options.map((option) => option.getTime())).size === poll.options.length, {
    path: ['options'],
    message: 'Each time can only be proposed once',
  })
  .refine((poll) => poll.options.every((option) => option.getTime() > Date.now()), {
    path: ['options'],
    message: 'Every time has to be in the future',
  })

export const pollVoterNameSchema = z
  .string()
  .trim()
  .min(GUEST_NAME_LIMITS.min, `Type at least ${GUEST_NAME_LIMITS.min} characters`)
  .max(GUEST_NAME_LIMITS.max, `The name can have up to ${GUEST_NAME_LIMITS.max} characters`)

export const isPollAnswer = (value: unknown): value is PollAnswer => POLL_ANSWERS.includes(value as PollAnswer)

type Tally = { yes: number; ifNeeded: number }

// The best time has the most yes answers, then the most if needed. Every time tied with it is among the best.
export const bestOptionIds = (options: { id: string; tally: Tally }[]) => {
  const answered = options.filter((option) => option.tally.yes + option.tally.ifNeeded > 0)
  if (answered.length === 0) return new Set<string>()
  const compare = (first: Tally, second: Tally) => second.yes - first.yes || second.ifNeeded - first.ifNeeded
  const best = [...answered].sort((first, second) => compare(first.tally, second.tally))[0].tally
  return new Set(answered.filter((option) => compare(option.tally, best) === 0).map((option) => option.id))
}
