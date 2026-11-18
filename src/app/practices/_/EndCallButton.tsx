'use client'

import { useState, useTransition } from 'react'

import { endCallAction } from '+/actions/calls'

// The host ends the call for everyone. The time of the practice never does, so this is the way a call closes while people are in it.
export default function EndCallButton({ practiceId }: { practiceId: string }) {
  const [isConfirming, setIsConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (!isConfirming) {
    return (
      <button type="button" className="lk-button practice-end-call" onClick={() => setIsConfirming(true)}>
        End call
      </button>
    )
  }

  return (
    <div role="group" aria-label="End the call" className="practice-call-choice items-center">
      <span>{error ?? 'End it for everyone?'}</span>
      <button
        type="button"
        className="lk-button practice-end-call"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const result = await endCallAction(practiceId)
            if (!result.success) setError(result.error ?? 'The call could not be ended.')
          })
        }
      >
        {isPending ? 'Ending…' : 'End for everyone'}
      </button>
      <button type="button" className="lk-button" disabled={isPending} onClick={() => setIsConfirming(false)}>
        Keep going
      </button>
    </div>
  )
}
