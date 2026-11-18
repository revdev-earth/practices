'use client'

import { Trash2 } from 'lucide-react'
import { useState, useTransition } from 'react'

import { deleteTimePollAction } from '+/actions/polls'

// Deleting the poll, which only the host can do.
export default function PollHostTools({ pollId }: { pollId: string }) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  return (
    <div className="flex flex-wrap items-center gap-3">
      {isConfirmingDelete ? (
        <>
          <span className="text-sm font-semibold">Delete the poll and every answer?</span>
          <button
            type="button"
            className="button button-danger"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const result = await deleteTimePollAction(pollId)
                if (result && !result.success) setError(result.error ?? 'The poll could not be deleted.')
              })
            }
          >
            {isPending ? 'Deleting…' : 'Delete poll'}
          </button>
          <button type="button" className="button button-quiet" onClick={() => setIsConfirmingDelete(false)}>
            Keep it
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setIsConfirmingDelete(true)} className="button button-quiet" aria-label="Delete poll">
          <Trash2 className="size-4" aria-hidden="true" />
          Delete
        </button>
      )}

      {error && <p className="w-full text-sm font-medium text-danger">{error}</p>}
    </div>
  )
}
