'use server'

import { getUser } from '+/lib/auth'
import { MIN_GROUP_SIZE, NO_GROUPS, groupOf, splitIntoGroups, storedGroups, type CallGroupsAnnouncement } from '+/lib/callGroups'
import {
  announceGroups,
  createGroupPass,
  endCall,
  MAX_CALL_GROUPS,
  peopleInMainRoom,
  readRoomPass,
  roomStateOf,
  videoRoomsConfigured,
} from '+/lib/livekit'
import { prisma } from '+/lib/prisma'

export type CallGroupsResult = { success: boolean; error?: string }

// The practice of a call that is running now, if the person asking is its host.
const runningCallHostedBy = async (practiceId: string) => {
  const user = await getUser()
  if (!user) return { error: 'Your session ended. Log in again.' } as const
  const practice = await prisma.practice.findUnique({
    where: { id: practiceId },
    select: { id: true, organizerId: true, startsAt: true, endsAt: true, roomClosedAt: true, mode: true, videoRoom: true, callGroups: true },
  })
  if (!practice || practice.mode !== 'ONLINE' || !practice.videoRoom || !videoRoomsConfigured) return { error: 'This practice has no room.' } as const
  if (practice.organizerId !== user.id) return { error: 'Only the host can arrange the groups.' } as const
  if ((await roomStateOf(practice)) !== 'open') return { error: 'The room is closed.' } as const
  return { practice, user } as const
}

const saveAndAnnounce = async (practiceId: string, announcement: CallGroupsAnnouncement, previousGroupCount: number) => {
  const assignments = JSON.stringify(announcement.assignments)
  await prisma.callGroups.upsert({
    where: { practiceId },
    create: { practiceId, groupCount: announcement.groupCount, assignments },
    update: { groupCount: announcement.groupCount, assignments },
  })
  await announceGroups(practiceId, Math.max(announcement.groupCount, previousGroupCount), JSON.stringify(announcement))
}

// Splits the people of the main room into groups of the chosen size. The host stays in the main room and can visit any group.
export const openCallGroupsAction = async (practiceId: string, groupSize: number): Promise<CallGroupsResult> => {
  const call = await runningCallHostedBy(practiceId)
  if ('error' in call) return { success: false, error: call.error }
  if (!Number.isInteger(groupSize) || groupSize < MIN_GROUP_SIZE) return { success: false, error: `A group has at least ${MIN_GROUP_SIZE} people.` }

  try {
    const people = (await peopleInMainRoom(practiceId)).filter((person) => person.identity !== call.user.id)
    // Groups that are too small for a very large call grow until the call fits in the rooms a practice can have.
    const announcement = splitIntoGroups(people, Math.max(groupSize, Math.ceil(people.length / MAX_CALL_GROUPS)))
    if (!announcement) {
      const others = people.length === 1 ? 'Only 1 person is' : `${people.length} people are`
      return { success: false, error: `${others} here besides you, not enough for groups of ${groupSize}.` }
    }
    await saveAndAnnounce(practiceId, announcement, call.practice.callGroups?.groupCount ?? 0)
    return { success: true }
  } catch (error) {
    console.error('Opening the call groups failed:', error)
    return { success: false, error: 'The groups could not be opened. Try again.' }
  }
}

// Moves one person to a group, or to the main room with group 0. The host can move themselves to visit a group.
export const moveToCallGroupAction = async (
  practiceId: string,
  person: { identity: string; name: string },
  group: number
): Promise<CallGroupsResult> => {
  const call = await runningCallHostedBy(practiceId)
  if ('error' in call) return { success: false, error: call.error }

  const current = call.practice.callGroups
  if (!current) return { success: false, error: 'The groups are closed.' }
  if (!Number.isInteger(group) || group < 0 || group > current.groupCount) return { success: false, error: 'That group does not exist.' }

  try {
    const announcement = storedGroups(current)
    announcement.assignments[person.identity] = { name: announcement.assignments[person.identity]?.name ?? person.name, group }
    await saveAndAnnounce(practiceId, announcement, current.groupCount)
    return { success: true }
  } catch (error) {
    console.error('Moving someone between call groups failed:', error)
    return { success: false, error: 'The move did not work. Try again.' }
  }
}

// Closes the groups and brings everyone back to the main room.
export const closeCallGroupsAction = async (practiceId: string): Promise<CallGroupsResult> => {
  const call = await runningCallHostedBy(practiceId)
  if ('error' in call) return { success: false, error: call.error }

  try {
    const previousGroupCount = call.practice.callGroups?.groupCount ?? 0
    await prisma.callGroups.deleteMany({ where: { practiceId } })
    await announceGroups(practiceId, previousGroupCount, JSON.stringify(NO_GROUPS))
    return { success: true }
  } catch (error) {
    console.error('Closing the call groups failed:', error)
    return { success: false, error: 'The groups could not be closed. Try again.' }
  }
}

export type RoomSwitch = { success: true; token: string; group: number } | { success: false; error: string }

// A browser in the call asks for a pass to the room its person belongs to now. It proves who it is with the pass it already has,
// which works the same for members and for guests, and the server reads the group from the database, never from the browser.
export const switchCallRoomAction = async (currentPass: string): Promise<RoomSwitch> => {
  const pass = await readRoomPass(currentPass)
  if (!pass) return { success: false, error: 'This pass is no longer valid.' }

  const practice = await prisma.practice.findUnique({
    where: { id: pass.practiceId },
    select: { id: true, startsAt: true, endsAt: true, roomClosedAt: true, callGroups: true },
  })
  if (!practice || (await roomStateOf(practice)) !== 'open') return { success: false, error: 'The call ended.' }

  const group = groupOf(storedGroups(practice.callGroups), pass.identity)
  const token = await createGroupPass({ practiceId: pass.practiceId, group, endsAt: practice.endsAt, person: { id: pass.identity, name: pass.name } })
  return { success: true, token, group }
}

// The host ends the call for everyone. Every room of the practice closes and nobody can enter again.
export const endCallAction = async (practiceId: string): Promise<CallGroupsResult> => {
  const call = await runningCallHostedBy(practiceId)
  if ('error' in call) return { success: false, error: call.error }

  try {
    await prisma.$transaction([
      prisma.practice.update({ where: { id: practiceId }, data: { roomClosedAt: new Date() } }),
      prisma.callGroups.deleteMany({ where: { practiceId } }),
    ])
    await endCall(practiceId)
    return { success: true }
  } catch (error) {
    console.error('Ending the call failed:', error)
    return { success: false, error: 'The call could not be ended. Try again.' }
  }
}
