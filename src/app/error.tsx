'use client'

import { useEffect } from 'react'

type ErrorPageProps = {
  error: unknown
  retry: () => void
}

export default function ErrorPage({ error, retry }: ErrorPageProps) {
  useEffect(() => {
    console.error('Page failed to render:', error)
  }, [error])

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-16">
      <h1 className="font-display text-4xl font-bold tracking-tight">This page failed to load</h1>
      <p className="mt-3 text-muted">Something went wrong on our side. Your data is safe. Loading the page again usually fixes it.</p>
      <div className="mt-6">
        {/* retry fetches the data again and renders the page again. */}
        <button type="button" onClick={() => retry()} className="button button-primary">
          Load the page again
        </button>
      </div>
    </main>
  )
}
