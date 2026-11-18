import 'server-only'

import { AccessToken, RoomServiceClient, TokenVerifier } from 'livekit-server-sdk'

const apiKey = process.env.LIVEKIT_API_KEY
const apiSecret = process.env.LIVEKIT_API_SECRET
const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL

// The video rooms need the three values. Without them practices still work and the room button says it is not available.
export const videoRoomsConfigured = Boolean(apiKey && apiSecret && serverUrl)

export const VIDEO_ROOM_URL = serverUrl ?? ''

// People can enter this long before the practice starts. The room does not close when the time is up:
// it stays while people are in it, until the host ends the call or a few minutes after the last person leaves.
export const ROOM_OPENS_MINUTES_BEFORE = 15
export const ROOM_CLOSES_AFTER_LAST_LEAVES_MINUTES = 5

// A call never has more groups than this. It bounds the rooms a practice can have.
export const MAX_CALL_GROUPS = 25

const MINUTE_MS = 60 * 1000

export const roomOpensAt = (startsAt: Date) => new Date(startsAt.getTime() - ROOM_OPENS_MINUTES_BEFORE * MINUTE_MS)

// A room is named after its practice, so one practice has exactly one main room. Group 0 is the main room.
// The groups the host opens during the call are rooms of their own, named after the practice and the group.
const roomNameFor = (practiceId: string, group = 0) => (group === 0 ? `practice-${practiceId}` : `practice-${practiceId}-group-${group}`)

const ROOM_NAME = /^practice-(.+?)(?:-group-(\d+))?$/

// The practice and the group of a room, read from its name.
export const roomOfName = (name: string) => {
  const match = ROOM_NAME.exec(name)
  return match ? { practiceId: match[1], group: Number(match[2] ?? 0) } : null
}

// The main room and every room a group of the call could have.
const allRoomNamesOf = (practiceId: string) => Array.from({ length: MAX_CALL_GROUPS + 1 }, (_, group) => roomNameFor(practiceId, group))

// LiveKit's REST API answers on the https twin of the wss address.
const httpUrl = () => (serverUrl ?? '').replace(/^ws/, 'http')

// Guests are people without an account who entered a public practice with just a name. They never take the place of someone
// with a confirmed spot: the room has the maximum of the practice for members and this many extra places for guests.
export const GUEST_SEATS = 10

const IDENTITY_OF_GUESTS = 'guest-'

const roomService = () => new RoomServiceClient(httpUrl(), apiKey ?? '', apiSecret ?? '')

// Creates the room with its size limit before anybody enters. LiveKit enforces the limit, so nine people
// pressing the button at once cannot overfill a room of eight. Calling it again for an existing room changes nothing.
const ensureRoom = async (practiceId: string, maxParticipants: number, withGuests: boolean) => {
  await roomService().createRoom({
    name: roomNameFor(practiceId),
    maxParticipants: maxParticipants + (withGuests ? GUEST_SEATS : 0),
    // The room closes by itself if nobody comes, and a few minutes after the last person leaves.
    emptyTimeout: 10 * 60,
    departureTimeout: ROOM_CLOSES_AFTER_LAST_LEAVES_MINUTES * 60,
  })
}

type RoomEntry = {
  practiceId: string
  maxParticipants: number
  // Whether the practice is public, and so the room has places for guests.
  isPublic: boolean
  endsAt: Date
  person: { id: string; name: string }
}

const PASS_VALID_AFTER_END_SECONDS = 2 * 60 * 60

const signPass = (practiceId: string, endsAt: Date, person: { id: string; name: string }, group = 0) => {
  if (!apiKey || !apiSecret) throw new Error('LIVEKIT_API_KEY or LIVEKIT_API_SECRET is not set')

  // The call can run past the end, so a pass stays valid a while longer. The pages decide who gets one.
  const secondsUntilEnd = Math.max(Math.ceil((endsAt.getTime() - Date.now()) / 1000), 0) + PASS_VALID_AFTER_END_SECONDS
  const pass = new AccessToken(apiKey, apiSecret, { identity: person.id, name: person.name, ttl: secondsUntilEnd })
  pass.addGrant({ room: roomNameFor(practiceId, group), roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true })
  return pass.toJwt()
}

// A pass for one person to one room. It carries their name, lets them use camera, microphone and screen,
// and stops working when the practice is over.
export const createRoomPass = async ({ practiceId, maxParticipants, isPublic, endsAt, person }: RoomEntry) => {
  await ensureRoom(practiceId, maxParticipants, isPublic)
  return signPass(practiceId, endsAt, person)
}

// A pass for someone with no account. Null when the places for guests are taken.
export const createGuestPass = async ({ practiceId, maxParticipants, endsAt, name }: Omit<RoomEntry, 'person' | 'isPublic'> & { name: string }) => {
  await ensureRoom(practiceId, maxParticipants, true)

  const inRoom = await roomService().listParticipants(roomNameFor(practiceId))
  const guestsInRoom = inRoom.filter((participant) => participant.identity.startsWith(IDENTITY_OF_GUESTS)).length
  if (guestsInRoom >= GUEST_SEATS) return null

  return signPass(practiceId, endsAt, { id: `${IDENTITY_OF_GUESTS}${crypto.randomUUID()}`, name })
}

// Reads a pass this app signed. Null when it is forged, expired or not for a room of a practice.
export const readRoomPass = async (token: string) => {
  if (!apiKey || !apiSecret) return null
  try {
    const claims = await new TokenVerifier(apiKey, apiSecret).verify(token)
    const room = roomOfName(claims.video?.room ?? '')
    if (!claims.sub || !room) return null
    return { identity: claims.sub, name: claims.name ?? '', ...room }
  } catch {
    return null
  }
}

// The people in the main room right now.
export const peopleInMainRoom = async (practiceId: string) => {
  const participants = await roomService().listParticipants(roomNameFor(practiceId))
  return participants.map((participant) => ({ identity: participant.identity, name: participant.name || participant.identity }))
}

// A pass to one group of the call, or to the main room for group 0. The group rooms are created on demand.
export const createGroupPass = async ({
  practiceId,
  group,
  endsAt,
  person,
}: {
  practiceId: string
  group: number
  endsAt: Date
  person: { id: string; name: string }
}) => {
  if (group > 0)
    await roomService().createRoom({
      name: roomNameFor(practiceId, group),
      emptyTimeout: 10 * 60,
      departureTimeout: ROOM_CLOSES_AFTER_LAST_LEAVES_MINUTES * 60,
    })
  return signPass(practiceId, endsAt, person, group)
}

// Writes the groups in the metadata of the main room and of every group room, so each browser sees where its person belongs.
// A room nobody is in yet is created first, since LiveKit only keeps metadata on rooms that exist.
export const announceGroups = async (practiceId: string, groupCount: number, metadata: string) => {
  const service = roomService()
  await Promise.all(
    Array.from({ length: groupCount + 1 }, async (_, group) => {
      const name = roomNameFor(practiceId, group)
      if (group > 0) await service.createRoom({ name, emptyTimeout: 10 * 60, departureTimeout: ROOM_CLOSES_AFTER_LAST_LEAVES_MINUTES * 60 })
      try {
        await service.updateRoomMetadata(name, metadata)
      } catch (error) {
        // The main room closes a minute after its last person leaves. Nobody is there to read it, so this is not an error.
        if (group > 0) throw error
      }
    })
  )
}

// waiting: it opens a few minutes before the start. open: people can enter. closed: the host ended the call,
// or the time is up and nobody is left in any room of the call.
export type RoomState = 'waiting' | 'open' | 'closed'

type RoomTimes = { id: string; startsAt: Date; endsAt: Date; roomClosedAt: Date | null }

// Whether a room of the call still exists. LiveKit keeps a room a few minutes after its last person leaves.
const isCallRunning = async (practiceId: string) => {
  if (!videoRoomsConfigured) return false
  const rooms = await roomService().listRooms(allRoomNamesOf(practiceId))
  return rooms.length > 0
}

export const roomStateOf = async ({ id, startsAt, endsAt, roomClosedAt }: RoomTimes): Promise<RoomState> => {
  if (roomClosedAt) return 'closed'
  const now = Date.now()
  if (roomOpensAt(startsAt).getTime() > now) return 'waiting'
  if (endsAt.getTime() > now) return 'open'
  return (await isCallRunning(id)) ? 'open' : 'closed'
}

// Ends the call for everyone: every room of the practice is deleted and LiveKit disconnects whoever is inside.
export const endCall = async (practiceId: string) => {
  const service = roomService()
  const rooms = await service.listRooms(allRoomNamesOf(practiceId))
  await Promise.all(rooms.map((room) => service.deleteRoom(room.name)))
}
