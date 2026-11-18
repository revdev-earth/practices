import { z } from 'zod'

import { DURATION_OPTIONS, GUEST_NAME_LIMITS, PRACTICE_LIMITS } from '+/lib/practiceRules'

// Rules of the polls that find the best time for a practice, shared by the forms (browser) and the actions (server).

export const POLL_OPTION_LIMITS = { min: 2, max: 10 } as const

export const POLL_ANSWERS = ['YES', 'IF_NEEDED', 'NO'] as const
export type PollAnswer = (typeof POLL_ANSWERS)[number]

export const ANSWER_LABELS: Record<PollAnswer, string> = { YES: 'Yes', IF_NEEDED: 'If needed', NO: 'No' }

const { title, description } = PRACTICE_LIMITS

// A poll asks for exact times, or only for days and the host picks the hour when posting the practice.
export const POLL_KINDS = ['TIMES', 'DAYS'] as const
export type PollKind = (typeof POLL_KINDS)[number]

const pollBasics = {
  title: z
    .string()
    .trim()
    .min(title.min, `The title needs at least ${title.min} characters`)
    .max(title.max, `The title can have up to ${title.max} characters`),
  description: z.string().trim().max(description.max, `The description can have up to ${description.max} characters`),
  durationMin: z.coerce.number().refine((value) => DURATION_OPTIONS.includes(value), 'Pick a duration from the list'),
}

const optionCount = <T extends z.ZodType>(item: T, noun: string) =>
  z
    .array(item)
    .min(POLL_OPTION_LIMITS.min, `Propose at least ${POLL_OPTION_LIMITS.min} ${noun}`)
    .max(POLL_OPTION_LIMITS.max, `Propose at most ${POLL_OPTION_LIMITS.max} ${noun}`)

const isCalendarDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())

// today is the day of the host, as "2026-11-19". A day poll can start on it.
export const timePollSchema = (today: string) =>
  z
    .discriminatedUnion('kind', [
      // Each time arrives as an exact instant in UTC, as in the practice form.
      z.object({ ...pollBasics, kind: z.literal('TIMES'), options: optionCount(z.iso.datetime({ error: 'Pick a date and a time' }), 'times') }),
      z.object({ ...pollBasics, kind: z.literal('DAYS'), options: optionCount(z.string().refine(isCalendarDay, 'Pick a day'), 'days') }),
    ])
    .superRefine((poll, context) => {
      const noun = poll.kind === 'TIMES' ? 'time' : 'day'
      const keys: (string | number)[] = poll.kind === 'TIMES' ? poll.options.map((option) => new Date(option).getTime()) : poll.options
      if (new Set(keys).size !== keys.length)
        context.addIssue({ code: 'custom', path: ['options'], message: `Each ${noun} can only be proposed once` })
      const inFuture =
        poll.kind === 'TIMES' ? poll.options.every((option) => new Date(option).getTime() > Date.now()) : poll.options.every((day) => day >= today)
      if (!inFuture)
        context.addIssue({
          code: 'custom',
          path: ['options'],
          message: poll.kind === 'TIMES' ? 'Every time has to be in the future' : 'Every day has to be today or later',
        })
    })

// A day of a day poll is kept at noon UTC, so the days sort in order next to the times of other polls.
export const dayAsInstant = (day: string) => new Date(`${day}T12:00:00Z`)

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
