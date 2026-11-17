import Link from 'next/link'

import { HOME_PATH } from '+/lib/redirects'

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-16">
      <h1 className="font-display text-4xl font-bold tracking-tight">This page does not exist</h1>
      <p className="mt-3 text-muted">The link may be mistyped, or the practice was deleted by its host.</p>
      <div className="mt-6">
        <Link href={HOME_PATH} className="button button-primary">
          Open the calendar
        </Link>
      </div>
    </main>
  )
}
