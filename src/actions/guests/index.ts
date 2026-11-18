'use server'

import { z } from 'zod'

import { createGuestPass, ROOM_OPENS_MINUTES_BEFORE, roomStateOf, VIDEO_ROOM_URL } from '+/lib/livekit'
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

// Someone with no account enters the room of a public practice by typing a name. Every rule is checked here,
// on the server, because the page only decides what to show.
export const enterAsGuestAction = async (practiceId: string, _previousState: GuestEntryState, formData: FormData): Promise<GuestEntryState> => {
  const name = nameSchema.safeParse(String(formData.get('name') ?? ''))
  if (!name.success) return { success: false, error: name.error.issues[0].message }

  // A guest has no spot in the practice, so the practice is read for nobody in particular.
  const practice = await getPractice(practiceId, '')
  if (!practice || !practice.isPublic || !practice.roomAvailable) return { success: false, error: 'This practice has no open room for guests.' }
  const roomState = await roomStateOf(practice)
  if (roomState === 'closed') return { success: false, error: 'The call already ended.' }
  if (roomState === 'waiting') return { success: false, error: `The room opens ${ROOM_OPENS_MINUTES_BEFORE} minutes before the start.` }

  try {
    const token = await createGuestPass({ practiceId, maxParticipants: practice.maxParticipants, endsAt: practice.endsAt, name: name.data })
    if (!token) return { success: false, error: 'The places for guests are taken. Create an account to join the practice.' }
    return { success: true, entry: { serverUrl: VIDEO_ROOM_URL, token } }
  } catch (error) {
    console.error('Entering the room as a guest failed:', error)
    return { success: false, error: 'The room could not be opened. Try again.' }
  }
}
