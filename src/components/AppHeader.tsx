import { Plus } from 'lucide-react'
import Link from 'next/link'

import { logoutAction } from '+/actions/auth'
import AppNav from '+/components/AppNav'
import Wordmark from '+/components/Wordmark'
import type { SessionUser } from '+/lib/auth'
import { HOME_PATH } from '+/lib/redirects'

export default function AppHeader({ user }: { user: SessionUser }) {
  return (
    <header className="border-b border-line bg-sheet">
      {/* On a phone the two destinations drop to their own row under the wordmark and the actions. */}
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:gap-x-6 sm:px-6">
        <Wordmark href={HOME_PATH} />
        <AppNav className="order-last w-full sm:order-none sm:w-auto" />
        <div className="ml-auto flex items-center gap-3 sm:gap-5">
          <Link href="/practices/new" className="button button-primary px-3 py-2 text-sm sm:px-4">
            <Plus className="size-4" aria-hidden="true" />
            Post a practice
          </Link>
          <span className="hidden max-w-40 truncate text-sm text-muted md:block">{user.name}</span>
          <form action={logoutAction}>
            <button type="submit" className="text-sm font-semibold text-ink underline decoration-line underline-offset-4 hover:decoration-ink">
              Log out
            </button>
          </form>
        </div>
      </div>
    </header>
  )
}
