'use client'

import '@livekit/components-styles'

import { LiveKitRoom, VideoConference } from '@livekit/components-react'
import { useRouter } from 'next/navigation'

type VideoRoomProps = {
  serverUrl: string
  token: string
  // Where the person goes after leaving the call.
  leaveHref: string
}

// The call: grid of cameras, microphone, camera, screen share and chat, all from the LiveKit components.
export default function VideoRoom({ serverUrl, token, leaveHref }: VideoRoomProps) {
  const router = useRouter()

  return (
    <LiveKitRoom
      serverUrl={serverUrl}
      token={token}
      connect
      audio
      video
      data-lk-theme="default"
      style={{ height: 'calc(100dvh - 11rem)', minHeight: '28rem' }}
      onDisconnected={() => router.push(leaveHref)}
    >
      <VideoConference />
    </LiveKitRoom>
  )
}
