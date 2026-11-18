'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { takeAttempts, tryAgainLater, visitorAddress } from '+/lib/attemptLimits'
import { ensureGuestKey, readGuestKey } from '+/lib/guests'
import { noticeSheetChanges, readSheet } from '+/lib/practiceNotices'
import { prisma } from '+/lib/prisma'
import { sharePath } from '+/lib/redirects'

import { createGuestPass, createRoomPass, ROOM_OPENS_MINUTES_BEFORE, roomStateOf, VIDEO_ROOM_URL } from '+/lib/livekit'
import { GUEST_NAME_LIMITS } from '+/lib/practiceRules'
import { getPractice } from '+/lib/practices'

export type GuestEntryState = {
  success: boolean
  error?: string
  // What the call needs to connect. Present when success is true.
  entry?: { serverUrl: string; token: string }
}

const nameSchema = z
  .string()
  .trim()
  .min(GUEST_NAME_LIMITS.min, `Type at least ${GUEST_NAME_LIMITS.min} characters`)
  .max(GUEST_NAME_LIMITS.max, `The name can have up to ${GUEST_NAME_LIMITS.max} characters`)

// Someone with no account enters the room of a public practice. Every rule is checked here, on the server,
// because the page only decides what to show. A browser that holds a spot on the sheet enters with the name it took
// the spot with, in one of the places of the sheet. Anyone else types a name and takes one of the places for visitors.
export const enterAsGuestAction = async (practiceId: string, _previousState: GuestEntryState, formData: FormData): Promise<GuestEntryState> => {
  const practice = await getPractice(practiceId, { guestKey: await readGuestKey() })
  if (!practice || !practice.isPublic || !practice.roomAvailable) return { success: false, error: 'This practice has no open room for guests.' }
  const roomState = await roomStateOf(practice)
  if (roomState === 'closed') return { success: false, error: 'The call already ended.' }
  if (roomState === 'waiting') return { success: false, error: `The room opens ${ROOM_OPENS_MINUTES_BEFORE} minutes before the start.` }

  const ownSpot = practice.confirmed.find((person) => person.isViewer && person.isGuest)
  if (ownSpot) {
    try {
      const token = await createRoomPass({
        practiceId,
        maxParticipants: practice.maxParticipants,
        isPublic: true,
        endsAt: practice.endsAt,
        // The identity is not a visitor one, so the spot never counts against the places for visitors.
        person: { id: `listed-${ownSpot.id.replace(/^guest:/, '')}`, name: ownSpot.name },
      })
      return { success: true, entry: { serverUrl: VIDEO_ROOM_URL, token } }
    } catch (error) {
      console.error('Entering the room with a guest spot failed:', error)
      return { success: false, error: 'The room could not be opened. Try again.' }
    }
  }

  const name = nameSchema.safeParse(String(formData.get('name') ?? ''))
  if (!name.success) return { success: false, error: name.error.issues[0].message }

  try {
    const token = await createGuestPass({ practiceId, maxParticipants: practice.maxParticipants, endsAt: practice.endsAt, name: name.data })
    if (!token) return { success: false, error: 'The places for guests are taken. Create an account to join the practice.' }
    return { success: true, entry: { serverUrl: VIDEO_ROOM_URL, token } }
  } catch (error) {
    console.error('Entering the room as a guest failed:', error)
    return { success: false, error: 'The room could not be opened. Try again.' }
  }
}

export type GuestSpotState = { success: boolean; error?: string }

const refreshSheet = (practiceId: string) => {
  revalidatePath(sharePath(practiceId))
  revalidatePath('/practices', 'layout')
  revalidatePath('/calendar')
}

// Someone without an account takes a spot on a public practice with just a name. The sheet shows them as not registered.
// When the spots are taken they go on the waitlist, like anyone else.
export const takeGuestSpotAction = async (practiceId: string, _previousState: GuestSpotState, formData: FormData): Promise<GuestSpotState> => {
  const name = nameSchema.safeParse(String(formData.get('name') ?? ''))
  if (!name.success) return { success: false, error: name.error.issues[0].message }

  const practice = await prisma.practice.findUnique({ where: { id: practiceId }, select: { isPublic: true, endsAt: true } })
  if (!practice || !practice.isPublic) return { success: false, error: 'This practice takes no spots without an account.' }
  if (practice.endsAt < new Date()) return { success: false, error: 'This practice already ended.' }

  const verdict = await takeAttempts([['guestSpotsFromAddress', await visitorAddress()]])
  if (!verdict.allowed) return { success: false, error: tryAgainLater(verdict.retryInMinutes) }

  const guestKey = await ensureGuestKey()
  const before = await readSheet(practiceId)
  // Taking it twice changes nothing but the name: the place on the sheet is kept.
  await prisma.guestSignup.upsert({
    where: { practiceId_guestKey: { practiceId, guestKey } },
    create: { practiceId, guestKey, name: name.data },
    update: { name: name.data },
  })
  noticeSheetChanges(before, await readSheet(practiceId), '')

  refreshSheet(practiceId)
  return { success: true }
}

// The browser that took the spot gives it back.
export const leaveGuestSpotAction = async (practiceId: string): Promise<GuestSpotState> => {
  const guestKey = await readGuestKey()
  if (!guestKey) return { success: false, error: 'This browser holds no spot in this practice.' }

  const practice = await prisma.practice.findUnique({ where: { id: practiceId }, select: { endsAt: true } })
  if (!practice) return { success: false, error: 'This practice no longer exists.' }
  if (practice.endsAt < new Date()) return { success: false, error: 'This practice already ended.' }

  const before = await readSheet(practiceId)
  await prisma.guestSignup.deleteMany({ where: { practiceId, guestKey } })
  noticeSheetChanges(before, await readSheet(practiceId), '')

  refreshSheet(practiceId)
  return { success: true }
}
