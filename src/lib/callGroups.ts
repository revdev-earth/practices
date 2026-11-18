// Groups inside a video call. The host splits the people of the main room into groups, each with a room of its own,
// moves people between them and brings everyone back. Group 0 is the main room.

export type GroupAssignments = Record<string, { name: string; group: number }>

// What the server writes in the metadata of every room of the call. A browser compares it with the room it is in.
export type CallGroupsAnnouncement = {
  groupCount: number
  assignments: GroupAssignments
}

export const NO_GROUPS: CallGroupsAnnouncement = { groupCount: 0, assignments: {} }

export const MIN_GROUP_SIZE = 2

export const parseAnnouncement = (metadata: string | undefined | null): CallGroupsAnnouncement => {
  if (!metadata) return NO_GROUPS
  try {
    const value = JSON.parse(metadata) as Partial<CallGroupsAnnouncement>
    if (typeof value.groupCount !== 'number' || typeof value.assignments !== 'object' || value.assignments === null) return NO_GROUPS
    return { groupCount: value.groupCount, assignments: value.assignments }
  } catch {
    return NO_GROUPS
  }
}

// The groups as the database keeps them, with the assignments written as JSON.
export const storedGroups = (stored: { groupCount: number; assignments: string } | null | undefined): CallGroupsAnnouncement =>
  stored ? parseAnnouncement(`{"groupCount":${stored.groupCount},"assignments":${stored.assignments}}`) : NO_GROUPS

export const groupOf = (announcement: CallGroupsAnnouncement, identity: string) => announcement.assignments[identity]?.group ?? 0

// The number of groups is the number of people divided by the group size, rounded down.
// Whoever is left over joins an existing group, one person each, so nobody is alone: 8 people in groups of 3 make two groups of 4.
// People are shuffled first, so the groups mix people who arrived together.
export const splitIntoGroups = (
  people: { identity: string; name: string }[],
  groupSize: number,
  random: () => number = Math.random
): CallGroupsAnnouncement | null => {
  const groupCount = Math.floor(people.length / groupSize)
  if (groupCount < 1) return null

  const shuffled = [...people]
  for (let index = shuffled.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]]
  }

  const assignments: GroupAssignments = {}
  shuffled.forEach((person, index) => {
    // Dealt one by one to group 1, 2 and so on: every group gets its size and the people left over get one each.
    const group = (index % groupCount) + 1
    assignments[person.identity] = { name: person.name, group }
  })
  return { groupCount, assignments }
}
