import type { ReactNode } from 'react'

import AppShell from '+/components/AppShell'

export default function PracticesLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <AppShell>{children}</AppShell>
}
