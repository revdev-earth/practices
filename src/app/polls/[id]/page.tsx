import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

import AppShell from '+/components/AppShell'
import Wordmark from '+/components/Wordmark'
import { formatDuration, formatLongDate, formatShortDateTime, formatTime, formatZone, formatZoneCity } from '+/lib/dates'
import { prisma } from '+/lib/prisma'
import { absoluteUrl, authModalPath, pollPath, shareablePracticePath } from '+/lib/redirects'
import { getTimeZone } from '+/lib/timezone'
import { currentPollVoter, getTimePoll, type PollOptionView } from '+/lib/timePollReads'
import { ANSWER_LABELS, type PollAnswer } from '+/lib/timePolls'

import PollAnswers from './_/PollAnswers'
import PollHostTools from './_/PollHostTools'

type PollPageProps = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PollPageProps): Promise<Metadata> {
  const { id } = await params
  const poll = await prisma.timePoll.findUnique({ where: { id }, select: { title: true } })
  return { title: poll ? `When: ${poll.title}` : 'Poll' }
}

const ANSWER_MARK: Record<PollAnswer, string> = {
  YES: 'bg-highlight-green',
  IF_NEEDED: 'bg-highlight-yellow',
  NO: 'bg-desk text-muted',
}

const tallyText = ({ tally }: PollOptionView) =>
  tally.yes + tally.ifNeeded === 0
    ? 'No yes yet'
    : [`${tally.yes} yes`, tally.ifNeeded > 0 && `${tally.ifNeeded} if needed`].filter(Boolean).join(', ')

// People with an account see the poll inside the app. Anyone else gets the page alone, with a way to log in.
function PollFrame({ signedIn, pollId, children }: { signedIn: boolean; pollId: string; children: ReactNode }) {
  if (signedIn) return <AppShell>{children}</AppShell>
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 sm:px-6">
      <header className="flex items-center justify-between py-5">
        <Wordmark href="/" />
        <Link
          href={authModalPath('login', { next: pollPath(pollId) })}
          className="text-sm font-semibold underline decoration-line underline-offset-4 hover:decoration-ink"
        >
          Log in
        </Link>
      </header>
      <main className="pb-16">{children}</main>
    </div>
  )
}

// A poll to find the time of a practice. Anyone with the link answers. The host sees which time works best and posts the practice there.
export default async function PollPage({ params }: PollPageProps) {
  const { id } = await params
  const [voter, timeZone] = await Promise.all([currentPollVoter(), getTimeZone()])
  const poll = await getTimePoll(id, voter)
  if (!poll) notFound()

  const practice = poll.practiceId
    ? await prisma.practice.findUnique({ where: { id: poll.practiceId }, select: { id: true, isPublic: true, startsAt: true, endsAt: true } })
    : null
  const isOpen = !practice
  const viewerRow = poll.voters.find((row) => row.isViewer)
  const optionLabel = (option: { startsAt: Date; endsAt: Date }) =>
    `${formatLongDate(option.startsAt, timeZone)}, ${formatTime(option.startsAt, timeZone)} to ${formatTime(option.endsAt, timeZone)} (${formatZone(option.startsAt, timeZone)})`

  return (
    <PollFrame signedIn={Boolean(voter.user)} pollId={poll.id}>
      <div className="mx-auto max-w-3xl">
        {voter.user && (
          <Link href="/polls" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
            <ArrowLeft className="size-4" aria-hidden="true" />
            All polls
          </Link>
        )}

        <article className="mt-5 rounded-xl border border-line bg-sheet p-6 sm:p-8">
          <p className="text-sm font-semibold text-muted">Finding a time</p>
          <h1 className="mt-1 font-display text-4xl leading-tight font-bold tracking-tight text-balance">{poll.title}</h1>
          <p className="mt-3 text-sm text-muted">
            {formatDuration(poll.durationMin)}, hosted by {poll.isOrganizer ? `${poll.organizer.name} (you)` : poll.organizer.name}. Times are shown
            in your time zone, {formatZoneCity(timeZone)}.
          </p>
          {poll.description && <p className="mt-5 max-w-prose leading-relaxed whitespace-pre-wrap">{poll.description}</p>}

          {practice && (
            <div className="mt-6 rounded-xl border border-line bg-desk/60 p-4">
              <p className="font-semibold">The host chose {optionLabel(practice)}.</p>
              <Link href={shareablePracticePath(practice)} className="text-link mt-1 inline-block text-sm">
                See the practice
              </Link>
            </div>
          )}

          {poll.isOrganizer && (
            <div className="mt-6">
              <PollHostTools pollId={poll.id} shareUrl={absoluteUrl(pollPath(poll.id))} />
            </div>
          )}

          <section aria-labelledby="poll-times-heading" className="mt-8 border-t border-line pt-6">
            <h2 id="poll-times-heading" className="font-display text-xl font-semibold">
              The times
            </h2>
            <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
              {poll.options.map((option) => (
                <li key={option.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
                  <div>
                    <p className="font-medium tabular-nums">{optionLabel(option)}</p>
                    <p className="text-sm text-muted">
                      {tallyText(option)}
                      {option.isBest && poll.voters.length > 0 && <span className="highlight highlight-green ml-2 text-xs">Works best</span>}
                    </p>
                  </div>
                  {poll.isOrganizer && isOpen && option.startsAt > new Date() && (
                    <Link
                      href={`/practices/new?poll=${poll.id}&option=${option.id}`}
                      className={`button ${option.isBest ? 'button-primary' : 'button-quiet'}`}
                    >
                      Post at this time
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {poll.voters.length > 0 && (
            <section aria-labelledby="poll-people-heading" className="mt-8">
              <h2 id="poll-people-heading" className="font-display text-xl font-semibold">
                {poll.voters.length === 1 ? '1 person answered' : `${poll.voters.length} people answered`}
              </h2>
              <div className="mt-3 overflow-x-auto rounded-xl border border-line">
                <table className="w-full min-w-max border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line">
                      <th scope="col" className="px-3 py-2 text-left font-semibold">
                        Name
                      </th>
                      {poll.options.map((option) => (
                        <th key={option.id} scope="col" className="px-3 py-2 text-left font-semibold whitespace-nowrap tabular-nums">
                          {formatShortDateTime(option.startsAt, timeZone)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {poll.voters.map((row) => (
                      <tr key={row.key} className="border-b border-line last:border-b-0">
                        <th scope="row" className="px-3 py-2 text-left font-medium whitespace-nowrap text-pen">
                          {row.name}
                          {row.isViewer && <span className="ml-1.5 text-xs font-normal text-muted">you</span>}
                        </th>
                        {poll.options.map((option) => {
                          const answer = row.answers[option.id]
                          return (
                            <td key={option.id} className="px-3 py-2">
                              {answer ? (
                                <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${ANSWER_MARK[answer]}`}>
                                  {ANSWER_LABELS[answer]}
                                </span>
                              ) : (
                                <span className="text-muted">·</span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {isOpen && (
            <section aria-labelledby="poll-answer-heading" className="mt-8 border-t border-line pt-6">
              <h2 id="poll-answer-heading" className="font-display text-xl font-semibold">
                {viewerRow ? 'Your answers' : 'Which times work for you?'}
              </h2>
              {!voter.user && (
                <p className="mt-1 text-sm text-muted">
                  You can answer with just a name.{' '}
                  <Link href={authModalPath('login', { next: pollPath(poll.id) })} className="text-link">
                    Log in
                  </Link>{' '}
                  to take a spot on your own when the practice is posted at a time you said yes to.
                </p>
              )}
              <div className="mt-4">
                <PollAnswers
                  pollId={poll.id}
                  options={poll.options.map((option) => ({ id: option.id, label: optionLabel(option) }))}
                  answers={poll.viewerAnswers}
                  asGuest={!voter.user}
                  guestName={viewerRow?.name ?? ''}
                />
              </div>
            </section>
          )}
        </article>
      </div>
    </PollFrame>
  )
}
