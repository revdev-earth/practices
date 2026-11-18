'use client'

import { useLocalParticipant, useParticipants, useRoomInfo } from '@livekit/components-react'
import { useState, useTransition } from 'react'

import { closeCallGroupsAction, moveToCallGroupAction, openCallGroupsAction, type CallGroupsResult } from '+/actions/calls'
import { MIN_GROUP_SIZE, parseAnnouncement } from '+/lib/callGroups'

const groupName = (group: number) => (group === 0 ? 'Main room' : `Group ${group}`)

type Person = { identity: string; name: string; isHost: boolean }

type CallGroupsPanelProps = {
  practiceId: string
  // The room the host is in right now. Group 0 is the main room.
  currentGroup: number
}

// The host's panel: split the people into groups, move them, visit a group and bring everyone back.
export default function CallGroupsPanel({ practiceId, currentGroup }: CallGroupsPanelProps) {
  const { metadata } = useRoomInfo()
  const { localParticipant } = useLocalParticipant()
  const participantsHere = useParticipants()
  const [groupSize, setGroupSize] = useState(3)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const announcement = parseAnnouncement(metadata)
  const groupsOpen = announcement.groupCount > 0

  // Everyone the host knows about: the assignments, the people in the room the host is in and the host.
  const people = new Map<string, Person & { group: number }>()
  for (const [identity, { name, group }] of Object.entries(announcement.assignments)) people.set(identity, { identity, name, group, isHost: false })
  for (const participant of participantsHere) {
    if (!people.has(participant.identity)) {
      people.set(participant.identity, {
        identity: participant.identity,
        name: participant.name || participant.identity,
        group: currentGroup,
        isHost: false,
      })
    }
  }
  people.set(localParticipant.identity, {
    identity: localParticipant.identity,
    name: localParticipant.name ?? 'You',
    group: currentGroup,
    isHost: true,
  })

  const run = (action: () => Promise<CallGroupsResult>) =>
    startTransition(async () => {
      setError(null)
      const result = await action()
      if (!result.success) setError(result.error ?? 'Something went wrong. Try again.')
    })

  const groups = Array.from({ length: announcement.groupCount + 1 }, (_, group) => ({
    group,
    people: [...people.values()].filter((person) => person.group === group),
  }))

  return (
    <aside aria-label="Groups" className="practice-groups-panel">
      <h2 className="text-base font-semibold">Groups</h2>

      {!groupsOpen ? (
        <form
          className="mt-3 space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            run(() => openCallGroupsAction(practiceId, groupSize))
          }}
        >
          <label className="flex items-center justify-between gap-3">
            People per group
            <input
              type="number"
              min={MIN_GROUP_SIZE}
              max={20}
              value={groupSize}
              onChange={(event) => setGroupSize(Number(event.target.value))}
              className="practice-groups-input"
            />
          </label>
          <p className="text-xs opacity-70">
            The people left over join a group one each, so nobody is alone. You stay in the main room and can visit any group.
          </p>
          <button type="submit" className="lk-button w-full justify-center" disabled={isPending}>
            {isPending ? 'Splitting…' : 'Split into groups'}
          </button>
        </form>
      ) : (
        <>
          <ol className="mt-3 space-y-4">
            {groups.map(({ group, people: members }) => (
              <li key={group} aria-label={groupName(group)}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">
                    {groupName(group)} <span className="font-normal opacity-70">({members.length})</span>
                  </h3>
                  {group !== currentGroup && (
                    <button
                      type="button"
                      className="lk-button practice-groups-small"
                      disabled={isPending}
                      onClick={() =>
                        run(() =>
                          moveToCallGroupAction(practiceId, { identity: localParticipant.identity, name: localParticipant.name ?? '' }, group)
                        )
                      }
                    >
                      {group === 0 ? 'Go back' : 'Visit'}
                    </button>
                  )}
                </div>
                <ul className="mt-1.5 space-y-1">
                  {members.map((person) => (
                    <li key={person.identity} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate">{person.isHost ? `${person.name} (you)` : person.name}</span>
                      {!person.isHost && (
                        <select
                          aria-label={`Move ${person.name}`}
                          value={group}
                          disabled={isPending}
                          onChange={(event) => run(() => moveToCallGroupAction(practiceId, person, Number(event.target.value)))}
                          className="practice-groups-select"
                        >
                          {groups.map((option) => (
                            <option key={option.group} value={option.group}>
                              {groupName(option.group)}
                            </option>
                          ))}
                        </select>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
          <button
            type="button"
            className="lk-button mt-4 w-full justify-center"
            disabled={isPending}
            onClick={() => run(() => closeCallGroupsAction(practiceId))}
          >
            Bring everyone back
          </button>
        </>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-300">
          {error}
        </p>
      )}
    </aside>
  )
}
