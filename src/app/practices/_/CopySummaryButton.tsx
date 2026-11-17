'use client'

import { Check, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'

type CopyOutcome = 'idle' | 'copied' | 'failed'

const OUTCOME_VISIBLE_MS = 2500

// Copies the text someone pastes into the group chat: what, when, where, who and the link.
export default function CopySummaryButton({ summary }: { summary: string }) {
  const [outcome, setOutcome] = useState<CopyOutcome>('idle')

  useEffect(() => {
    if (outcome === 'idle') return
    const timer = setTimeout(() => setOutcome('idle'), OUTCOME_VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [outcome])

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summary)
      setOutcome('copied')
    } catch {
      setOutcome('failed')
    }
  }

  return (
    <button type="button" onClick={copySummary} className="button button-quiet">
      {outcome === 'copied' ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
      <span aria-live="polite">
        {outcome === 'copied' ? 'Summary copied' : outcome === 'failed' ? 'This browser blocked the copy' : 'Copy summary'}
      </span>
    </button>
  )
}
