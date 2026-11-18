'use client'

import { Check, Share2 } from 'lucide-react'
import { useEffect, useState } from 'react'

type ShareOutcome = 'idle' | 'copied' | 'failed'

const OUTCOME_VISIBLE_MS = 2500

type ShareButtonProps = {
  url: string
  title: string
  // Shown with the link in the apps that take a text, such as a chat.
  text?: string
  label?: string
  className?: string
}

// Shares a link. A phone opens its own share sheet with the chats and apps of the person. A computer copies the link.
export default function ShareButton({ url, title, text, label = 'Share', className = 'button button-quiet' }: ShareButtonProps) {
  const [outcome, setOutcome] = useState<ShareOutcome>('idle')

  useEffect(() => {
    if (outcome === 'idle') return
    const timer = setTimeout(() => setOutcome('idle'), OUTCOME_VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [outcome])

  const share = async () => {
    const data = { title, text, url }
    // Desktop browsers that offer the sheet open a small system window that is easy to miss, so they get the copy instead.
    const isTouchDevice = window.matchMedia('(pointer: coarse)').matches
    if (isTouchDevice && navigator.share && navigator.canShare?.(data) !== false) {
      try {
        await navigator.share(data)
        return
      } catch (error) {
        // Closing the sheet is not a failure.
        if (error instanceof DOMException && error.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setOutcome('copied')
    } catch {
      setOutcome('failed')
    }
  }

  return (
    <button type="button" onClick={share} className={className}>
      {outcome === 'copied' ? <Check className="size-4" aria-hidden="true" /> : <Share2 className="size-4" aria-hidden="true" />}
      <span aria-live="polite">{outcome === 'copied' ? 'Link copied' : outcome === 'failed' ? 'This browser blocked the copy' : label}</span>
    </button>
  )
}
