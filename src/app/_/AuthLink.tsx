'use client'

import Link from 'next/link'
import type { MouseEvent, ReactNode } from 'react'

import { authModalPath, type AuthView } from '+/lib/redirects'

type AuthLinkProps = {
  view: AuthView
  className?: string
  children: ReactNode
}

// Opens the account window on one of its steps. The address changes in the browser alone, so the window opens at once,
// with no trip to the server, and the back button closes it.
export default function AuthLink({ view, className, children }: AuthLinkProps) {
  const href = authModalPath(view)

  const openWindow = (event: MouseEvent<HTMLAnchorElement>) => {
    // A click that asks for a new tab keeps its normal behavior.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    window.history.pushState(null, '', href)
  }

  return (
    <Link href={href} prefetch={false} onClick={openWindow} className={className}>
      {children}
    </Link>
  )
}
