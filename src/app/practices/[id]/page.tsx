import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import AddToCalendar from '+/components/AddToCalendar'
import StatusMark from '+/components/StatusMark'
import { updatePracticeAction } from '+/actions/practices'
import { requireUser } from '+/lib/auth'
import { dayKey, formatDuration, formatLongDate, formatTime, formatZone, formatZoneCity, toDateTimeLocal } from '+/lib/dates'
import { roomStateOf } from '+/lib/livekit'
import { getPractice, type PracticeView } from '+/lib/practices'
import { isWebLink, MODE_LABELS } from '+/lib/practiceRules'
import { absoluteUrl, calendarPath, roomPath, shareablePracticePath } from '+/lib/redirects'
import { getTimeZone } from '+/lib/timezone'

import CopySummaryButton from '../_/CopySummaryButton'
import EditablePractice from '../_/EditablePractice'
import type { PracticeFormDefaults } from '../_/PracticeForm'
import MembershipButton from '../_/MembershipButton'
import Roster from '../_/Roster'

export const metadata: Metadata = { title: 'Practice' }

// On a phone the label sits right above its value. From tablet up they share a line.
const DETAIL_ROW = 'grid gap-1 sm:grid-cols-[5rem_minmax(0,1fr)] sm:gap-6'
const DETAIL_LABEL = 'text-sm font-semibold text-muted sm:pt-0.5'

const timeRange = (practice: PracticeView, timeZone: string) =>
  `${formatTime(practice.startsAt, timeZone)} to ${formatTime(practice.endsAt, timeZone)} (${formatZone(practice.startsAt, timeZone)})`

// The room of the practice in lives when it has one, else what the host typed.
const where = (practice: PracticeView) => (practice.roomAvailable ? absoluteUrl(roomPath(practice.id)) : practice.location)

// Text for the group chat. The time carries the zone of whoever copies it and the link shows it to each person in their own.
const shareableSummary = (practice: PracticeView, timeZone: string) =>
  [
    practice.title,
    `${formatLongDate(practice.startsAt, timeZone)}, ${timeRange(practice, timeZone)}`,
    where(practice) ? `${MODE_LABELS[practice.mode]}: ${where(practice)}` : MODE_LABELS[practice.mode],
    `Group (${practice.confirmed.length} of ${practice.maxParticipants}): ${practice.confirmed.map((person) => person.name).join(', ')}`,
    `See it in your own time zone: ${absoluteUrl(shareablePracticePath(practice))}`,
  ].join('\n')

const viewerPlaceText = (practice: PracticeView) => {
  if (practice.viewer.place === 'confirmed') return 'You have a spot.'
  if (practice.viewer.place === 'waiting') return 'You are on the waitlist. You move up when a spot frees up.'
  if (practice.status === 'full') return 'Every spot is taken. Joining puts you on the waitlist.'
  return null
}

type PracticePageProps = {
  params: Promise<{ id: string }>
}

export default async function PracticePage({ params }: PracticePageProps) {
  const user = await requireUser()
  const { id } = await params
  const [practice, timeZone] = await Promise.all([getPractice(id, user.id), getTimeZone()])
  if (!practice) notFound()

  const isPast = practice.status === 'past'
  // After the end the room only matters while the call goes on.
  const roomState = practice.roomAvailable && isPast ? await roomStateOf(practice) : null
  const placeText = viewerPlaceText(practice)
  const defaults: PracticeFormDefaults = {
    title: practice.title,
    description: practice.description,
    startsAtLocal: toDateTimeLocal(practice.startsAt, timeZone),
    durationMin: practice.durationMin,
    mode: practice.mode,
    location: practice.location,
    videoRoom: practice.videoRoom,
    isPublic: practice.isPublic,
    minParticipants: practice.minParticipants,
    maxParticipants: practice.maxParticipants,
  }

  return (
    <>
      {/* Back to the month, with the day of this practice selected. */}
      <Link
        href={calendarPath({ day: dayKey(practice.startsAt, timeZone) })}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to the calendar
      </Link>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <article className="rounded-xl border border-line bg-sheet p-6 sm:p-8">
          <EditablePractice
            practiceId={practice.id}
            canDelete={practice.viewer.isOrganizer}
            canEdit={practice.viewer.isOrganizer && !isPast}
            statusMark={<StatusMark practice={practice} drawn />}
            action={updatePracticeAction.bind(null, practice.id)}
            defaults={defaults}
            viewerZone={`${formatZoneCity(timeZone)} (${formatZone(practice.startsAt, timeZone)})`}
            details={
              <>
                <h1 className="mt-4 font-display text-4xl leading-tight font-bold tracking-tight text-balance">{practice.title}</h1>

                <dl className="mt-7 space-y-5">
                  <div className={DETAIL_ROW}>
                    <dt className={DETAIL_LABEL}>When</dt>
                    <dd>
                      <p className="font-semibold">{formatLongDate(practice.startsAt, timeZone)}</p>
                      <p className="tabular-nums">
                        {timeRange(practice, timeZone)}, {formatDuration(practice.durationMin)}
                      </p>
                      <p className="mt-1 text-sm text-muted">Shown in your time zone, {formatZoneCity(timeZone)}.</p>
                    </dd>
                  </div>

                  <div className={DETAIL_ROW}>
                    <dt className={DETAIL_LABEL}>Where</dt>
                    <dd>
                      <p className="font-semibold">{MODE_LABELS[practice.mode]}</p>
                      {practice.roomAvailable && roomState === 'closed' ? (
                        <p className="text-sm text-muted">{practice.roomClosedAt ? 'The host ended the call.' : 'The call ended.'}</p>
                      ) : practice.roomAvailable ? (
                        <>
                          {roomState === 'open' && <p className="text-sm font-medium">The time is up and the call is still going.</p>}
                          <Link href={`/practices/${practice.id}/room`} className="button button-primary mt-2">
                            Open the Practices room
                          </Link>
                        </>
                      ) : practice.videoRoom ? (
                        <p className="text-sm text-muted">The Practices room is not available right now.</p>
                      ) : isWebLink(practice.location) ? (
                        <a href={practice.location} target="_blank" rel="noopener noreferrer" className="text-link break-all">
                          {practice.location}
                        </a>
                      ) : practice.location ? (
                        <p className="wrap-break-word">{practice.location}</p>
                      ) : (
                        <p className="text-sm text-muted">
                          {practice.mode === 'ONLINE' ? 'The host has not added the call link yet.' : 'The host has not added the place yet.'}
                        </p>
                      )}
                    </dd>
                  </div>

                  <div className={DETAIL_ROW}>
                    <dt className={DETAIL_LABEL}>Access</dt>
                    <dd>
                      <p className="font-semibold">{practice.isPublic ? 'Public' : 'Private'}</p>
                      <p className="text-sm text-muted">
                        {practice.isPublic ? 'Anyone with the link can read it, with no account.' : 'Only people with an account can open it.'}
                      </p>
                    </dd>
                  </div>

                  <div className={DETAIL_ROW}>
                    <dt className={DETAIL_LABEL}>Host</dt>
                    <dd>{practice.viewer.isOrganizer ? `${practice.organizer.name} (you)` : practice.organizer.name}</dd>
                  </div>
                </dl>

                {practice.description && (
                  <p className="mt-7 max-w-prose border-t border-line pt-6 leading-relaxed whitespace-pre-wrap">{practice.description}</p>
                )}
              </>
            }
          />

          <div className="mt-7 border-t border-line pt-6">
            {isPast ? (
              <p className="text-muted">This practice already ended.</p>
            ) : (
              <>
                {placeText && <p className="mb-4 text-sm font-medium">{placeText}</p>}
                <div className="flex flex-wrap items-start gap-3">
                  <MembershipButton practiceId={practice.id} place={practice.viewer.place} isFull={practice.status === 'full'} />
                  <CopySummaryButton summary={shareableSummary(practice, timeZone)} />
                </div>
                <AddToCalendar practice={practice} audience="member" icsHref={`/practices/${practice.id}/event.ics`} className="mt-5" />
              </>
            )}
          </div>
        </article>

        <Roster practice={practice} />
      </div>
    </>
  )
}
