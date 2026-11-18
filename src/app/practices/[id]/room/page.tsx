import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { requireUser } from '+/lib/auth'
import { formatTime, formatZone } from '+/lib/dates'
import { createRoomPass, ROOM_OPENS_MINUTES_BEFORE, roomOpensAt, roomStateOf, VIDEO_ROOM_URL } from '+/lib/livekit'
import { getPractice } from '+/lib/practices'
import { getTimeZone } from '+/lib/timezone'

import VideoRoom from '../../_/VideoRoom'

export const metadata: Metadata = { title: 'Practice room' }

type RoomPageProps = {
  params: Promise<{ id: string }>
}

function Closed({ practiceId, title, text }: { practiceId: string; title: string; text: string }) {
  return (
    <div className="mx-auto max-w-md">
      <Link href={`/practices/${practiceId}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to the practice
      </Link>
      <h1 className="mt-5 font-display text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-3 text-muted">{text}</p>
    </div>
  )
}

// The room of a practice. Only the people with a confirmed spot get in, from a few minutes before the start until the end.
export default async function PracticeRoomPage({ params }: RoomPageProps) {
  const user = await requireUser()
  const { id } = await params
  const [practice, timeZone] = await Promise.all([getPractice(id, user.id), getTimeZone()])
  if (!practice || practice.mode !== 'ONLINE' || !practice.videoRoom) notFound()

  if (!practice.roomAvailable) {
    return <Closed practiceId={id} title="The room is not available" text="The video service is not set up right now. Try again later." />
  }
  const roomState = await roomStateOf(practice)
  if (roomState === 'closed') {
    return practice.roomClosedAt ? (
      <Closed practiceId={id} title="The call ended" text="The host ended the call for everyone." />
    ) : (
      <Closed practiceId={id} title="This practice ended" text="The room closed after the last person left." />
    )
  }
  if (practice.viewer.place !== 'confirmed') {
    return (
      <Closed
        practiceId={id}
        title="The room is for people with a spot"
        text={
          practice.viewer.place === 'waiting' ? 'You are on the waitlist. You get in if a spot frees up.' : 'Join the practice to get into its room.'
        }
      />
    )
  }

  if (roomState === 'waiting') {
    const opensAt = roomOpensAt(practice.startsAt)
    return (
      <Closed
        practiceId={id}
        title="The room is not open yet"
        text={`It opens at ${formatTime(opensAt, timeZone)} (${formatZone(opensAt, timeZone)}), ${ROOM_OPENS_MINUTES_BEFORE} minutes before the start.`}
      />
    )
  }

  const token = await createRoomPass({
    practiceId: id,
    maxParticipants: practice.maxParticipants,
    isPublic: practice.isPublic,
    endsAt: practice.endsAt,
    person: { id: user.id, name: user.name },
  })

  return (
    <div className="-mx-4 sm:-mx-6">
      <div className="flex items-center justify-between gap-4 px-4 pb-3 sm:px-6">
        <Link href={`/practices/${id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to the practice
        </Link>
        <p className="truncate text-sm font-semibold">{practice.title}</p>
      </div>
      <VideoRoom serverUrl={VIDEO_ROOM_URL} token={token} leaveHref={`/practices/${id}`} practiceId={id} isHost={practice.viewer.isOrganizer} />
    </div>
  )
}
