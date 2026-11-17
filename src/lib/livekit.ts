import 'server-only'

import { AccessToken, RoomServiceClient } from 'livekit-server-sdk'

const apiKey = process.env.LIVEKIT_API_KEY
const apiSecret = process.env.LIVEKIT_API_SECRET
const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL

// The video rooms need the three values. Without them practices still work and the room button says it is not available.
export const videoRoomsConfigured = Boolean(apiKey && apiSecret && serverUrl)

export const VIDEO_ROOM_URL = serverUrl ?? ''

// People can enter this long before the practice starts and until it ends.
export const ROOM_OPENS_MINUTES_BEFORE = 15

const MINUTE_MS = 60 * 1000

export const roomOpensAt = (startsAt: Date) => new Date(startsAt.getTime() - ROOM_OPENS_MINUTES_BEFORE * MINUTE_MS)

export const isRoomOpen = (startsAt: Date) => roomOpensAt(startsAt).getTime() <= Date.now()

// A room is named after its practice, so one practice has exactly one room.
const roomNameFor = (practiceId: string) => `practice-${practiceId}`

// LiveKit's REST API answers on the https twin of the wss address.
const httpUrl = () => (serverUrl ?? '').replace(/^ws/, 'http')

// Creates the room with its size limit before anybody enters. LiveKit enforces the limit, so nine people
// pressing the button at once cannot overfill a room of eight. Calling it again for an existing room changes nothing.
const ensureRoom = async (practiceId: string, maxParticipants: number) => {
  if (!apiKey || !apiSecret) return
  const rooms = new RoomServiceClient(httpUrl(), apiKey, apiSecret)
  await rooms.createRoom({
    name: roomNameFor(practiceId),
    maxParticipants,
    // The room closes by itself a few minutes after the last person leaves.
    emptyTimeout: 10 * 60,
    departureTimeout: 60,
  })
}

type RoomEntry = {
  practiceId: string
  maxParticipants: number
  endsAt: Date
  person: { id: string; name: string }
}

// A pass for one person to one room. It carries their name, lets them use camera, microphone and screen,
// and stops working when the practice is over.
export const createRoomPass = async ({ practiceId, maxParticipants, endsAt, person }: RoomEntry) => {
  if (!apiKey || !apiSecret) throw new Error('LIVEKIT_API_KEY or LIVEKIT_API_SECRET is not set')

  await ensureRoom(practiceId, maxParticipants)

  const secondsUntilEnd = Math.max(Math.ceil((endsAt.getTime() - Date.now()) / 1000), 60)
  const pass = new AccessToken(apiKey, apiSecret, { identity: person.id, name: person.name, ttl: secondsUntilEnd })
  pass.addGrant({ room: roomNameFor(practiceId), roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true })
  return pass.toJwt()
}
