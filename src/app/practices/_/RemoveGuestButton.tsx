'use client'

import { X } from 'lucide-react'
import { useState, useTransition } from 'react'

import { removeGuestSpotAction } from '+/actions/practices'

// The host takes someone without an account off the sheet. A second click confirms, so one slip removes nobody.
export default function RemoveGuestButton({ practiceId, guestSignupId, name }: { practiceId: string; guestSignupId: string; name: string }) {
  const [isConfirming, setIsConfirming] = useState(false)
  const [isPending, startTransition] = useTransition()

  if (!isConfirming) {
    return (
      <button
        type="button"
        onClick={() => setIsConfirming(true)}
        aria-label={`Take ${name} off the sheet`}
        title="Take off the sheet"
        className="ml-auto grid size-7 shrink-0 place-items-center rounded-md text-muted hover:bg-desk hover:text-danger"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    )
  }

  return (
    <span className="ml-auto flex shrink-0 items-center gap-2 text-xs">
      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(async () => void (await removeGuestSpotAction(practiceId, guestSignupId)))}
        className="font-semibold text-danger underline underline-offset-2"
      >
        {isPending ? 'Removing…' : 'Remove'}
      </button>
      <button type="button" onClick={() => setIsConfirming(false)} className="text-muted underline underline-offset-2">
        Keep
      </button>
    </span>
  )
}
