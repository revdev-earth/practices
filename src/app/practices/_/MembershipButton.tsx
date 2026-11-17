'use client'

import { useState, useTransition } from 'react'

import { joinPracticeAction, leavePracticeAction } from '+/actions/practices'
import type { PracticeView } from '+/lib/practices'

type MembershipButtonProps = {
  practiceId: string
  place: PracticeView['viewer']['place']
  isFull: boolean
}

// Joins or leaves the practice. The page refreshes itself with the new list after each change.
export default function MembershipButton({ practiceId, place, isFull }: MembershipButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const isSignedUp = place !== null
  const label = place === 'confirmed' ? 'Leave' : place === 'waiting' ? 'Leave the waitlist' : isFull ? 'Join the waitlist' : 'Join'

  const changeMembership = () =>
    startTransition(async () => {
      const result = await (isSignedUp ? leavePracticeAction(practiceId) : joinPracticeAction(practiceId))
      setError(result.success ? null : (result.error ?? 'The change could not be saved. Try again.'))
    })

  return (
    <div>
      <button type="button" onClick={changeMembership} disabled={isPending} className={`button ${isSignedUp ? 'button-quiet' : 'button-primary'}`}>
        {label}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
