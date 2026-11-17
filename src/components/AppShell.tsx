import type { ReactNode } from 'react'

import AppHeader from '+/components/AppHeader'
import { requireUser } from '+/lib/auth'

// The frame of every page that needs a session: the header on top and the page inside the desk margins.
export default async function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  const user = await requireUser()

  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto w-full max-w-5xl px-4 pt-8 pb-24 sm:px-6 sm:pt-10">{children}</main>
    </>
  )
}
