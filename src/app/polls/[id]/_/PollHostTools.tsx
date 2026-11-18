'use client'

import { Check, Copy, Trash2 } from 'lucide-react'
import { useState, useTransition } from 'react'

import { deleteTimePollAction } from '+/actions/polls'

// What the host does with the poll besides choosing the time: share the link and delete the poll.
export default function PollHostTools({ pollId, shareUrl }: { pollId: string; shareUrl: string }) {
  const [copied, setCopied] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setError('This browser blocked the copy. The link is the address of this page.')
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={copyLink} className="button button-quiet">
        {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
        <span aria-live="polite">{copied ? 'Link copied' : 'Copy the link to share'}</span>
      </button>

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
