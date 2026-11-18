import type { Metadata } from 'next'

import AppShell from '+/components/AppShell'
import { dayKey, formatZone, formatZoneCity, shiftDayKey } from '+/lib/dates'
import { getTimeZone } from '+/lib/timezone'

import PollForm from '../_/PollForm'

export const metadata: Metadata = { title: 'New poll' }

export default async function NewPollPage() {
  const timeZone = await getTimeZone()
  const now = new Date()
  const tomorrow = shiftDayKey(dayKey(now, timeZone), 1)

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-4xl font-bold tracking-tight">Find a time</h1>
        <p className="mt-2 text-muted">
          Propose a few times and share the link. Each person answers yes, if needed or no, with or without an account. Then you post the practice at
          the time that works.
        </p>

        <div className="mt-8 rounded-xl border border-line bg-sheet p-6 sm:p-8">
          <PollForm
            suggestedTimes={[`${tomorrow}T19:00`, `${shiftDayKey(tomorrow, 1)}T19:00`]}
            viewerZone={`${formatZoneCity(timeZone)} (${formatZone(now, timeZone)})`}
          />
        </div>
      </div>
    </AppShell>
  )
}
