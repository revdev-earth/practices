import 'server-only'

import { headers } from 'next/headers'

import { prisma } from '+/lib/prisma'

const MINUTE_MS = 60 * 1000

// How many tries each action allows inside its window. The email limits slow down guessing one password.
// The address limits slow down one machine going through many emails.
const ATTEMPT_RULES = {
  login: { limit: 10, windowMinutes: 15 },
  loginFromAddress: { limit: 50, windowMinutes: 15 },
  passwordReset: { limit: 3, windowMinutes: 60 },
  passwordResetFromAddress: { limit: 10, windowMinutes: 60 },
  registerFromAddress: { limit: 10, windowMinutes: 60 },
  // Someone without an account answering polls. Each save counts once, whatever the number of times answered.
  pollAnswersFromAddress: { limit: 30, windowMinutes: 60 },
} as const

export type AttemptKind = keyof typeof ATTEMPT_RULES

export type AttemptVerdict = { allowed: true } | { allowed: false; retryInMinutes: number }

// Windows older than a day no longer limit anything.
const STALE_AFTER_MS = 24 * 60 * MINUTE_MS

// Counts one try and says whether it may go ahead. A try over the limit is not counted, so the window ends on time.
export const takeAttempt = async (kind: AttemptKind, subject: string): Promise<AttemptVerdict> => {
  const { limit, windowMinutes } = ATTEMPT_RULES[kind]
  const key = `${kind}:${subject}`
  const now = Date.now()
  const windowMs = windowMinutes * MINUTE_MS

  await prisma.attemptCounter.deleteMany({ where: { windowStartsAt: { lt: new Date(now - STALE_AFTER_MS) } } })

  const counter = await prisma.attemptCounter.findUnique({ where: { key } })
  if (!counter || counter.windowStartsAt.getTime() + windowMs <= now) {
    await prisma.attemptCounter.upsert({
      where: { key },
      create: { key, count: 1, windowStartsAt: new Date(now) },
      update: { count: 1, windowStartsAt: new Date(now) },
    })
    return { allowed: true }
  }

  if (counter.count >= limit) {
    return { allowed: false, retryInMinutes: Math.max(Math.ceil((counter.windowStartsAt.getTime() + windowMs - now) / MINUTE_MS), 1) }
  }

  await prisma.attemptCounter.update({ where: { key }, data: { count: { increment: 1 } } })
  return { allowed: true }
}

// A successful login starts the count of that email over.
export const clearAttempts = async (kind: AttemptKind, subject: string) => {
  await prisma.attemptCounter.deleteMany({ where: { key: `${kind}:${subject}` } })
}

// The address of the visitor, from the first entry of x-forwarded-for, which Vercel fills in.
// Null on a local server with no proxy in front, where the address limits do not apply.
export const visitorAddress = async () => {
  const requestHeaders = await headers()
  const forwarded = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || requestHeaders.get('x-real-ip') || null
}

// Takes one try from each limit that applies and stops at the first one that is used up.
export const takeAttempts = async (attempts: [AttemptKind, string | null][]): Promise<AttemptVerdict> => {
  for (const [kind, subject] of attempts) {
    if (!subject) continue
    const verdict = await takeAttempt(kind, subject)
    if (!verdict.allowed) return verdict
  }
  return { allowed: true }
}

export const tryAgainLater = (retryInMinutes: number) =>
  `Too many tries. Try again in ${retryInMinutes} ${retryInMinutes === 1 ? 'minute' : 'minutes'}.`
