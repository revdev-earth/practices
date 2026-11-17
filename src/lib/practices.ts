import type { Prisma } from '+/generated/prisma/client'
import { practiceStatus, type PracticeMode, type PracticeStatus } from '+/lib/practiceRules'
import { prisma } from '+/lib/prisma'

const practiceInclude = {
  organizer: { select: { id: true, name: true } },
  signups: {
    orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
    select: { user: { select: { id: true, name: true } } },
  },
} satisfies Prisma.PracticeInclude

type PracticeRecord = Prisma.PracticeGetPayload<{ include: typeof practiceInclude }>

export type Participant = {
  id: string
  name: string
  isViewer: boolean
  isOrganizer: boolean
}

export type PracticeView = {
  id: string
  title: string
  description: string
  startsAt: Date
  endsAt: Date
  durationMin: number
  mode: PracticeMode
  location: string
  minParticipants: number
  maxParticipants: number
  organizer: { id: string; name: string }
  // By arrival order: the first maxParticipants have a spot, the rest wait.
  confirmed: Participant[]
  waiting: Participant[]
  status: PracticeStatus
  hasStarted: boolean
  missing: number
  spotsLeft: number
  viewer: {
    isOrganizer: boolean
    place: 'confirmed' | 'waiting' | null
  }
}

const toPracticeView = (practice: PracticeRecord, viewerId: string, now: Date): PracticeView => {
  const participants = practice.signups.map(({ user }) => ({
    id: user.id,
    name: user.name,
    isViewer: user.id === viewerId,
    isOrganizer: user.id === practice.organizerId,
  }))
  const confirmed = participants.slice(0, practice.maxParticipants)
  const waiting = participants.slice(practice.maxParticipants)

  return {
    id: practice.id,
    title: practice.title,
    description: practice.description,
    startsAt: practice.startsAt,
    endsAt: practice.endsAt,
    durationMin: Math.round((practice.endsAt.getTime() - practice.startsAt.getTime()) / 60000),
    mode: practice.mode,
    location: practice.location,
    minParticipants: practice.minParticipants,
    maxParticipants: practice.maxParticipants,
    organizer: practice.organizer,
    confirmed,
    waiting,
    status: practiceStatus(confirmed.length, practice.minParticipants, practice.maxParticipants, practice.endsAt < now),
    hasStarted: practice.startsAt <= now,
    missing: Math.max(practice.minParticipants - confirmed.length, 0),
    spotsLeft: Math.max(practice.maxParticipants - confirmed.length, 0),
    viewer: {
      isOrganizer: practice.organizerId === viewerId,
      place: confirmed.some((person) => person.isViewer) ? 'confirmed' : waiting.some((person) => person.isViewer) ? 'waiting' : null,
    },
  }
}

export const getUpcomingPractices = async (viewerId: string): Promise<PracticeView[]> => {
  const now = new Date()
  const practices = await prisma.practice.findMany({
    where: { endsAt: { gte: now } },
    orderBy: { startsAt: 'asc' },
    include: practiceInclude,
    take: 200,
  })
  return practices.map((practice) => toPracticeView(practice, viewerId, now))
}

export const getPastPractices = async (viewerId: string): Promise<PracticeView[]> => {
  const now = new Date()
  const practices = await prisma.practice.findMany({
    where: { endsAt: { lt: now } },
    orderBy: { startsAt: 'desc' },
    include: practiceInclude,
    take: 50,
  })
  return practices.map((practice) => toPracticeView(practice, viewerId, now))
}

// Practices that start inside a stretch of time, past and upcoming together, for the calendar.
export const getPracticesStartingBetween = async (viewerId: string, from: Date, to: Date): Promise<PracticeView[]> => {
  const now = new Date()
  const practices = await prisma.practice.findMany({
    where: { startsAt: { gte: from, lt: to } },
    orderBy: { startsAt: 'asc' },
    include: practiceInclude,
    take: 500,
  })
  return practices.map((practice) => toPracticeView(practice, viewerId, now))
}

export const countPastPractices = () => prisma.practice.count({ where: { endsAt: { lt: new Date() } } })

export const getPractice = async (id: string, viewerId: string): Promise<PracticeView | null> => {
  const practice = await prisma.practice.findUnique({ where: { id }, include: practiceInclude })
  return practice ? toPracticeView(practice, viewerId, new Date()) : null
}
