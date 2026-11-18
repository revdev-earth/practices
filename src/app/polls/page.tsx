import { Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import AppShell from '+/components/AppShell'
import { requireUser } from '+/lib/auth'
import { formatShortDateTime, formatShortDayKey } from '+/lib/dates'
import { pollPath } from '+/lib/redirects'
import { getTimeZone } from '+/lib/timezone'
import { getPollsOf } from '+/lib/timePollReads'

export const metadata: Metadata = { title: 'Polls' }

// The polls a person hosts and the ones they answered with their account.
export default async function PollsPage() {
  const user = await requireUser()
  const [polls, timeZone] = await Promise.all([getPollsOf(user.id), getTimeZone()])

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight">Polls</h1>
          <p className="mt-2 text-muted">Find the time that works for the group before posting a practice.</p>
        </div>
        <Link href="/polls/new" className="button button-primary">
          <Plus className="size-4" aria-hidden="true" />
          New poll
        </Link>
      </div>

      {polls.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-muted/50 px-6 py-10 text-center">
          <p>No polls yet. Propose a few times and share the link with the group.</p>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-line overflow-hidden rounded-xl border border-line bg-sheet">
          {polls.map((poll) => (
            <li key={poll.id}>
              <Link href={pollPath(poll.id)} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-4 hover:bg-desk/40">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{poll.title}</p>
                  <p className="text-sm text-muted">
                    {poll.optionCount} {poll.kind === 'DAYS' ? 'days' : 'times'}
                    {poll.firstOption &&
                      `, from ${poll.firstOption.day ? formatShortDayKey(poll.firstOption.day) : formatShortDateTime(poll.firstOption.startsAt, timeZone)}`}
                    . {poll.voterCount === 1 ? '1 person answered' : `${poll.voterCount} people answered`}.{poll.isOrganizer ? ' You host it.' : ''}
                  </p>
                </div>
                <span className={`highlight text-sm ${poll.practiceId ? 'highlight-green' : 'highlight-yellow'}`}>
                  {poll.practiceId ? 'Time chosen' : 'Open'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  )
}
