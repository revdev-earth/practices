import type { Metadata } from 'next'
import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google'
import type { ReactNode } from 'react'

import TimezoneSync from '+/components/TimezoneSync'

import './globals.css'

const displayFont = Bricolage_Grotesque({ variable: '--font-bricolage', subsets: ['latin'] })
const textFont = Instrument_Sans({ variable: '--font-instrument', subsets: ['latin'] })

export const metadata: Metadata = {
  title: { default: 'Practices', template: '%s | Practices' },
  description: 'Post a practice session, set how many people it needs and how many fit, and let everyone see it in their own time zone.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${displayFont.variable} ${textFont.variable}`}>
      <body className="min-h-dvh antialiased">
        <TimezoneSync />
        {children}
      </body>
    </html>
  )
}
