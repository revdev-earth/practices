'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// The same practices seen two ways: laid out on the month, or as a list with filters.
const DESTINATIONS = [
  { href: '/calendar', label: 'Calendar' },
  { href: '/practices', label: 'List' },
]

export default function AppNav({ className = '' }: { className?: string }) {
  const pathname = usePathname()

  return (
    <nav aria-label="Main" className={`flex items-center gap-5 ${className}`}>
      {DESTINATIONS.map((destination) => {
        const isCurrent = pathname === destination.href
        return (
          <Link
            key={destination.href}
            href={destination.href}
            aria-current={isCurrent ? 'page' : undefined}
            className={`border-b-2 py-1 text-sm font-semibold ${isCurrent ? 'border-pen text-ink' : 'border-transparent text-muted hover:text-ink'}`}
          >
            {destination.label}
          </Link>
        )
      })}
    </nav>
  )
}
