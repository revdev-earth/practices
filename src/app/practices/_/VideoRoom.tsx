'use client'

import '@livekit/components-styles'

import { LiveKitRoom, useLocalParticipant, useRoomInfo } from '@livekit/components-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import { switchCallRoomAction } from '+/actions/calls'
import { groupOf, parseAnnouncement } from '+/lib/callGroups'

import CallGroupsPanel from './CallGroupsPanel'
import EndCallButton from './EndCallButton'
import PracticeCall from './PracticeCall'

type VideoRoomProps = {
  serverUrl: string
  token: string
  // Where the person goes after leaving the call.
  leaveHref: string
  practiceId: string
  // The host arranges the groups of the call.
  isHost: boolean
}

// Watches the groups announced in the room and asks to move when this person belongs somewhere else.
function GroupFollower({ currentGroup, onMoved }: { currentGroup: number; onMoved: () => void }) {
  const { metadata } = useRoomInfo()
  const { localParticipant } = useLocalParticipant()
  const assignedGroup = groupOf(parseAnnouncement(metadata), localParticipant.identity)

  useEffect(() => {
    if (assignedGroup !== currentGroup) onMoved()
  }, [assignedGroup, currentGroup, onMoved])

  return null
}

// The connection to the room of the practice. PracticeCall draws the call inside it.
// When the host splits the call into groups, the person moves to the room of their group with a new pass, and back again.
export default function VideoRoom({ serverUrl, token, leaveHref, practiceId, isHost }: VideoRoomProps) {
  const router = useRouter()
  const [pass, setPass] = useState({ token, group: 0 })
  const [showGroups, setShowGroups] = useState(false)
  // A move between rooms disconnects from the old one. That disconnection is not the person leaving the call.
  const isMoving = useRef(false)

  const move = useCallback(async () => {
    if (isMoving.current) return
    isMoving.current = true
    const next = await switchCallRoomAction(pass.token)
    if (next.success && next.group !== pass.group) setPass({ token: next.token, group: next.group })
    else isMoving.current = false
  }, [pass])

  return (
    <LiveKitRoom
      key={pass.group}
      serverUrl={serverUrl}
      token={pass.token}
      connect
      audio
      video
      data-lk-theme="default"
      style={{ height: 'calc(100dvh - 11rem)', minHeight: '28rem' }}
      onConnected={() => {
        isMoving.current = false
      }}
      onDisconnected={() => {
        if (!isMoving.current) router.push(leaveHref)
      }}
    >
      <GroupFollower currentGroup={pass.group} onMoved={move} />
      <PracticeCall
        currentGroup={pass.group}
        groupsPanel={isHost ? <CallGroupsPanel practiceId={practiceId} currentGroup={pass.group} /> : null}
        showGroups={showGroups}
        onToggleGroups={() => setShowGroups(!showGroups)}
        endCall={isHost ? <EndCallButton practiceId={practiceId} /> : null}
      />
    </LiveKitRoom>
  )
}
