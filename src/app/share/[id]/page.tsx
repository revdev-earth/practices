import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import AddToCalendar from '+/components/AddToCalendar'
import ShareButton from '+/components/ShareButton'
import StatusMark from '+/components/StatusMark'
import Wordmark from '+/components/Wordmark'
import { getUser } from '+/lib/auth'
import { publicPracticePreview } from '+/lib/linkPreview'
import { readGuestKey } from '+/lib/guests'
import { formatDuration, formatLongDate, formatTime, formatZone, formatZoneCity } from '+/lib/dates'
import { ROOM_OPENS_MINUTES_BEFORE, roomOpensAt, roomStateOf } from '+/lib/livekit'
import { getPractice, withPublicNames } from '+/lib/practices'
import { isWebLink, MODE_LABELS } from '+/lib/practiceRules'
import { absoluteUrl, authModalPath, sharePath } from '+/lib/redirects'
import { getTimeZone } from '+/lib/timezone'

import Roster from '../../practices/_/Roster'

import GuestRoom from './_/GuestRoom'
import GuestSpot from './_/GuestSpot'

type SharePageProps = {
  params: Promise<{ id: string }>
}

// What a chat app shows under a pasted link: the title, the time in the zone of the host, the place and the free spots.
export async function generateMetadata({ params }: SharePageProps): Promise<Metadata> {
  const { id } = await params
  const preview = await publicPracticePreview(id)
  if (!preview) return { title: 'Practice' }
  return {
    title: preview.title,
    description: preview.description,
    openGraph: { title: preview.title, description: preview.description, url: sharePath(id), type: 'website', siteName: 'Practices' },
    twitter: { card: 'summary_large_image', title: preview.title, description: preview.description },
  }
}

// The page of a public practice for anyone with the link. People with an account are sent to the full page.
export default async function SharePage({ params }: SharePageProps) {
  const { id } = await params

  if (await getUser()) redirect(`/practices/${id}`)

  const [practice, timeZone] = await Promise.all([getPractice(id, { guestKey: await readGuestKey() }), getTimeZone()])
  // A private practice answers like one that does not exist, so its link gives nothing away.
  if (!practice || !practice.isPublic) notFound()

  const isPast = practice.status === 'past'
  const next = `/practices/${id}`
  // The call can go on past the end of the practice, so guests can still enter while it runs.
  const roomState = practice.roomAvailable ? await roomStateOf(practice) : 'closed'

  // The spot this browser took without an account, if any.
  const ownSpot = [...practice.confirmed, ...practice.waiting].find((person) => person.isViewer && person.isGuest)
  const spot = ownSpot ? { name: ownSpot.name, place: practice.viewer.place ?? 'waiting' } : null
  const hasSeat = spot?.place === 'confirmed'

  const guestRoom = roomState !== 'closed' && (
    <div className="mt-6 border-t border-line pt-6">
      <h2 className="font-display text-xl font-semibold">{isPast ? 'The call is still going' : hasSeat ? 'The room' : 'Or just visit the room'}</h2>
      <p className="mt-1 text-sm text-muted">
        {hasSeat ? 'Your spot has a place in the call.' : 'Type a name and you are in the call as a visitor, without a spot on the sheet.'}
      </p>
      {roomState === 'open' ? (
        <GuestRoom practiceId={id} leaveHref={`/share/${id}`} listedName={hasSeat ? (spot?.name ?? null) : null} />
      ) : (
        <p className="mt-3 text-sm font-medium">
          The room opens at {formatTime(roomOpensAt(practice.startsAt), timeZone)} ({formatZone(roomOpensAt(practice.startsAt), timeZone)}),{' '}
          {ROOM_OPENS_MINUTES_BEFORE} minutes before the start.
        </p>
      )}
    </div>
  )

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 sm:px-6">
      <header className="flex items-center justify-between py-5">
        <Wordmark href="/" />
        <Link
          href={authModalPath('login', { next })}
          className="text-sm font-semibold underline decoration-line underline-offset-4 hover:decoration-ink"
        >
          Log in
        </Link>
      </header>

      {/* As on the page for members: the practice, and the sheet beside it on a wide screen or below it on a phone. */}
      <main className="grid gap-6 pb-16 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <article className="rounded-xl border border-line bg-sheet p-6 sm:p-8">
          <StatusMark practice={practice} drawn />
          <h1 className="mt-4 font-display text-4xl leading-tight font-bold tracking-tight text-balance">{practice.title}</h1>

          <dl className="mt-7 space-y-5">
            <div className="grid gap-1 sm:grid-cols-[5rem_minmax(0,1fr)] sm:gap-6">
              <dt className="text-sm font-semibold text-muted sm:pt-0.5">When</dt>
              <dd>
                <p className="font-semibold">{formatLongDate(practice.startsAt, timeZone)}</p>
                <p className="tabular-nums">
                  {formatTime(practice.startsAt, timeZone)} to {formatTime(practice.endsAt, timeZone)} ({formatZone(practice.startsAt, timeZone)}),{' '}
                  {formatDuration(practice.durationMin)}
                </p>
                <p className="mt-1 text-sm text-muted">Shown in your time zone, {formatZoneCity(timeZone)}.</p>
              </dd>
            </div>

            <div className="grid gap-1 sm:grid-cols-[5rem_minmax(0,1fr)] sm:gap-6">
              <dt className="text-sm font-semibold text-muted sm:pt-0.5">Where</dt>
              <dd>
                <p className="font-semibold">{MODE_LABELS[practice.mode]}</p>
                {practice.videoRoom ? (
                  <p className="text-sm text-muted">In a Practices room, with cameras and voice.</p>
                ) : isWebLink(practice.location) ? (
                  <a href={practice.location} target="_blank" rel="noopener noreferrer" className="text-link break-all">
                    {practice.location}
                  </a>
                ) : (
                  practice.location && <p className="wrap-break-word">{practice.location}</p>
                )}
              </dd>
            </div>

            <div className="grid gap-1 sm:grid-cols-[5rem_minmax(0,1fr)] sm:gap-6">
              <dt className="text-sm font-semibold text-muted sm:pt-0.5">Host</dt>
              <dd>{practice.organizer.name}</dd>
            </div>

            <div className="grid gap-1 sm:grid-cols-[5rem_minmax(0,1fr)] sm:gap-6">
              <dt className="text-sm font-semibold text-muted sm:pt-0.5">Spots</dt>
              <dd className="tabular-nums">
                {practice.confirmed.length} of {practice.maxParticipants} taken
                {practice.waiting.length > 0 && `, ${practice.waiting.length} waiting`}
              </dd>
            </div>
          </dl>

          {practice.description && (
            <p className="mt-7 max-w-prose border-t border-line pt-6 leading-relaxed whitespace-pre-wrap">{practice.description}</p>
          )}

          <div className="mt-7 border-t border-line pt-6">
            {isPast ? (
              <>
                <p className="text-muted">This practice already ended.</p>
                {guestRoom}
              </>
            ) : (
              <>
                <GuestSpot practiceId={id} spot={spot} isFull={practice.status === 'full'} />
                <p className="mt-5 text-sm text-muted">
                  With an account you get an email when the practice is confirmed or a spot frees up for you.{' '}
                  <Link href={authModalPath('register', { next })} className="text-link">
                    Create an account
                  </Link>{' '}
                  or{' '}
                  <Link href={authModalPath('login', { next })} className="text-link">
                    log in
                  </Link>
                  .
                </p>

                <AddToCalendar practice={practice} audience="guest" icsHref={`/share/${id}/event.ics`} className="mt-5" />
                <ShareButton
                  url={absoluteUrl(sharePath(id))}
                  title={practice.title}
                  label="Share with someone"
                  className="button button-quiet mt-4"
                />

                {guestRoom}
              </>
            )}
          </div>
        </article>

        {/* Who is going, with short names, since anyone with the link can open this page. */}
        <Roster practice={withPublicNames(practice)} />
      </main>
    </div>
  )
}
