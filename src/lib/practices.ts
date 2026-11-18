import type { Prisma } from '+/generated/prisma/client'
import { practiceStatus, type PracticeMode, type PracticeStatus } from '+/lib/practiceRules'
import { videoRoomsConfigured } from '+/lib/livekit'
import { prisma } from '+/lib/prisma'

const practiceInclude = {
  organizer: { select: { id: true, name: true } },
  signups: {
    orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
    select: { id: true, joinedAt: true, user: { select: { id: true, name: true } } },
  },
  guestSignups: {
    orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
    select: { id: true, joinedAt: true, name: true, guestKey: true },
  },
} satisfies Prisma.PracticeInclude

type PracticeRecord = Prisma.PracticeGetPayload<{ include: typeof practiceInclude }>

export type Participant = {
  // The user id, or "guest:<guest signup id>" for someone without an account.
  id: string
  name: string
  isViewer: boolean
  isOrganizer: boolean
  // Took the spot with just a name, without an account. The sheet shows them as not registered.
  isGuest: boolean
}

// Who is looking: a user id, the guest id of a browser without an account, or nobody in particular.
export type Viewer = { userId?: string | null; guestKey?: string | null }

// People with and without an account share one sheet in arrival order.
export const sheetOrder = <T extends { joinedAt: Date; id: string }>(first: T[], second: T[]) =>
  [...first, ...second].sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime() || a.id.localeCompare(b.id))

export type PracticeView = {
  id: string
  title: string
  description: string
  startsAt: Date
  endsAt: Date
  durationMin: number
  mode: PracticeMode
  location: string
  // Whether the video room can be offered: the host chose it and the video service is configured.
  roomAvailable: boolean
  // The host chose a room of the video service. It stays true even while the service is not configured.
  videoRoom: boolean
  isPublic: boolean
  // When the host ended the call for everyone.
  roomClosedAt: Date | null
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

const toPracticeView = (practice: PracticeRecord, viewer: Viewer, now: Date): PracticeView => {
  const members = practice.signups.map((signup) => ({
    id: signup.user.id,
    joinedAt: signup.joinedAt,
    name: signup.user.name,
    isViewer: Boolean(viewer.userId) && signup.user.id === viewer.userId,
    isOrganizer: signup.user.id === practice.organizerId,
    isGuest: false,
  }))
  const guests = practice.guestSignups.map((signup) => ({
    id: `guest:${signup.id}`,
    joinedAt: signup.joinedAt,
    name: signup.name,
    isViewer: Boolean(viewer.guestKey) && signup.guestKey === viewer.guestKey,
    isOrganizer: false,
    isGuest: true,
  }))
  const participants: Participant[] = sheetOrder(members, guests).map(({ id, name, isViewer, isOrganizer, isGuest }) => ({
    id,
    name,
    isViewer,
    isOrganizer,
    isGuest,
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
    videoRoom: practice.mode === 'ONLINE' && practice.videoRoom,
    isPublic: practice.isPublic,
    roomClosedAt: practice.roomClosedAt,
    roomAvailable: practice.mode === 'ONLINE' && practice.videoRoom && videoRoomsConfigured,
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
      isOrganizer: Boolean(viewer.userId) && practice.organizerId === viewer.userId,
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
  return practices.map((practice) => toPracticeView(practice, { userId: viewerId }, now))
}

export const getPastPractices = async (viewerId: string): Promise<PracticeView[]> => {
  const now = new Date()
  const practices = await prisma.practice.findMany({
    where: { endsAt: { lt: now } },
    orderBy: { startsAt: 'desc' },
    include: practiceInclude,
    take: 50,
  })
  return practices.map((practice) => toPracticeView(practice, { userId: viewerId }, now))
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
  return practices.map((practice) => toPracticeView(practice, { userId: viewerId }, now))
}

export const countPastPractices = () => prisma.practice.count({ where: { endsAt: { lt: new Date() } } })

// viewerId is the user looking, or a viewer with the guest id of a browser without an account.
export const getPractice = async (id: string, viewerId: string | Viewer): Promise<PracticeView | null> => {
  const practice = await prisma.practice.findUnique({ where: { id }, include: practiceInclude })
  const viewer = typeof viewerId === 'string' ? { userId: viewerId } : viewerId
  return practice ? toPracticeView(practice, viewer, new Date()) : null
}
