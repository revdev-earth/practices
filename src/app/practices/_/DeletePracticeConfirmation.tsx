'use client'

import { useState, useTransition } from 'react'

import { deletePracticeAction } from '+/actions/practices'

type DeletePracticeConfirmationProps = {
  practiceId: string
  onKeep: () => void
}

// Deleting asks once more, because the practice disappears for everyone who signed up.
export default function DeletePracticeConfirmation({ practiceId, onKeep }: DeletePracticeConfirmationProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const deletePractice = () =>
    startTransition(async () => {
      // On success the action redirects to the calendar and nothing comes back here.
      const result = await deletePracticeAction(practiceId)
      if (result && !result.success) setError(result.error ?? 'The practice could not be deleted. Try again.')
    })

  return (
    <div className="modal-step mt-4 w-full rounded-lg border border-danger/40 bg-danger/5 p-4">
      <p className="font-semibold">Delete this practice for everyone?</p>
      <p className="mt-1 text-sm text-muted">The sign-up sheet and the waitlist are deleted with it.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={deletePractice} disabled={isPending} className="button button-danger">
          {isPending ? 'Deleting…' : 'Delete practice'}
        </button>
        <button type="button" onClick={onKeep} disabled={isPending} className="button button-quiet">
          Keep it
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
