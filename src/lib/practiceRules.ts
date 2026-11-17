import { z } from 'zod'

// Practice rules shared by the form (browser) and the actions (server).
export const PRACTICE_LIMITS = {
  title: { min: 3, max: 80 },
  description: { max: 1000 },
  location: { max: 200 },
  // The group size counts the organizer too.
  participants: { min: 2, max: 50 },
} as const

export const DURATION_OPTIONS = [30, 45, 60, 90, 120, 180]

export const PRACTICE_MODES = ['ONLINE', 'IN_PERSON'] as const
export type PracticeMode = (typeof PRACTICE_MODES)[number]

export const MODE_LABELS: Record<PracticeMode, string> = {
  ONLINE: 'Online',
  IN_PERSON: 'In person',
}

const { title, description, location, participants } = PRACTICE_LIMITS

const participantCount = (label: string) =>
  z.coerce
    .number({ error: `Enter the ${label} number of people` })
    .int('It has to be a whole number')
    .min(participants.min, `The ${label} has to be at least ${participants.min}`)
    .max(participants.max, `The ${label} has to be at most ${participants.max}`)

export const practiceSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(title.min, `The title needs at least ${title.min} characters`)
      .max(title.max, `The title can have up to ${title.max} characters`),
    description: z.string().trim().max(description.max, `The description can have up to ${description.max} characters`),
    // The browser sends an exact instant in UTC, so the server time zone never shifts the hour.
    startsAt: z.iso.datetime({ error: 'Pick a date and a time' }).transform((value) => new Date(value)),
    durationMin: z.coerce.number().refine((value) => DURATION_OPTIONS.includes(value), 'Pick a duration from the list'),
    mode: z.enum(PRACTICE_MODES, { error: 'Pick online or in person' }),
    // "yes" when the online practice uses a room of the video service.
    videoRoom: z
      .string()
      .optional()
      .transform((value) => value === 'yes'),
    location: z.string().trim().max(location.max, `It can have up to ${location.max} characters`),
    minParticipants: participantCount('minimum'),
    maxParticipants: participantCount('maximum'),
  })
  .refine((practice) => practice.maxParticipants >= practice.minParticipants, {
    path: ['maxParticipants'],
    message: 'The maximum has to be at least the minimum',
  })

export type PracticeInput = z.infer<typeof practiceSchema>

export type PracticeStatus = 'open' | 'confirmed' | 'full' | 'past'

// open: the minimum is still missing. confirmed: it happens and spots remain. full: every spot is taken, the rest is waitlist.
export const practiceStatus = (confirmed: number, minParticipants: number, maxParticipants: number, hasEnded: boolean): PracticeStatus => {
  if (hasEnded) return 'past'
  if (confirmed >= maxParticipants) return 'full'
  if (confirmed >= minParticipants) return 'confirmed'
  return 'open'
}

// Only http(s) links are shown as a link. Any other text is shown as written.
export const isWebLink = (text: string) => /^https?:\/\/\S+$/i.test(text)
