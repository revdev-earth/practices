import { redirect } from 'next/navigation'
import { Suspense } from 'react'

import Wordmark from '+/components/Wordmark'
import { CONFIRMATION_CODE_LENGTH, CONFIRMATION_CODE_VALID_MINUTES, getUser, MIN_PASSWORD_LENGTH } from '+/lib/auth'
import { HOME_PATH, parseAuthView, safeNextPath } from '+/lib/redirects'

import AuthLink from './_/AuthLink'
import AuthModal from './_/AuthModal'

// A filled in sheet, so the first thing a visitor sees is how a practice looks while it gathers people.
const SAMPLE_SHEET = {
  title: 'Mock interviews for frontend roles',
  minimum: 3,
  lines: ['Dana', 'Kenji', null, null, null],
}

// The seeded accounts, offered in the login window only in development.
const DEMO_USERS =
  process.env.NODE_ENV === 'production' || !process.env.SEED_PASSWORD
    ? []
    : ['Dana Reyes', 'Kenji Mori', 'Amara Obi', 'Tom Becker'].map((name) => ({
        name,
        email: `${name.split(' ')[0].toLowerCase()}@practices.test`,
        password: process.env.SEED_PASSWORD as string,
      }))

type LandingPageProps = {
  searchParams: Promise<{ auth?: string; next?: string; token?: string }>
}

export default async function LandingPage({ searchParams }: LandingPageProps) {
  const { auth, next, token } = await searchParams

  // A password reset link also works for someone who is still logged in on this device.
  const isPasswordResetLink = parseAuthView(auth) === 'reset' && Boolean(token)
  if (!isPasswordResetLink && (await getUser())) redirect(next ? safeNextPath(next) : HOME_PATH)

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 sm:px-6">
      <header className="flex items-center justify-between py-5">
        <Wordmark href="/" />
        <AuthLink view="login" className="text-sm font-semibold underline decoration-line underline-offset-4 hover:decoration-ink">
          Log in
        </AuthLink>
      </header>

      <main className="grid flex-1 items-center gap-12 py-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-16 lg:py-16">
        <div>
          <h1 className="max-w-xl font-display text-5xl leading-[1.05] font-bold tracking-tight text-balance sm:text-6xl">
            Get enough people together to practice.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted">
            Post a time and set how many people it takes and how many fit. Once the minimum signs up, the practice shows as{' '}
            <span className="highlight highlight-green text-base text-ink">Confirmed</span>.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <AuthLink view="register" className="button button-primary">
              Create an account
            </AuthLink>
            <AuthLink view="login" className="button button-quiet">
              Log in
            </AuthLink>
          </div>
        </div>

        <figure>
          <div className="rounded-xl border border-line bg-sheet shadow-[6px_6px_0_var(--color-line)]">
            <div className="px-5 pt-5 pb-4">
              <span className="highlight highlight-yellow text-sm">Needs 1 more</span>
              <p className="mt-3 font-display text-xl leading-snug font-semibold">{SAMPLE_SHEET.title}</p>
              <p className="mt-1 text-sm text-muted tabular-nums">Thursday, 19:00 to 20:00 (GMT-5)</p>
            </div>
            <ol>
              {SAMPLE_SHEET.lines.map((name, index) => {
                const lineNumber = index + 1
                const isMinimumLine = lineNumber === SAMPLE_SHEET.minimum
                return (
                  <li
                    key={lineNumber}
                    className={`flex min-h-11 items-center gap-3 border-t px-5 py-2 ${isMinimumLine ? 'border-b-2 border-t-line border-b-ink' : 'border-line'}`}
                  >
                    <span className="w-6 text-sm text-muted tabular-nums">{lineNumber}</span>
                    {name && <span className="font-semibold text-pen">{name}</span>}
                    {isMinimumLine && <span className="ml-auto text-xs text-muted">Confirmed once this line is filled</span>}
                  </li>
                )
              })}
            </ol>
          </div>
          <figcaption className="mt-5 text-sm leading-relaxed text-muted">
            Dana posted it for 19:00 in Bogota. Kenji opens the same page in Tokyo and reads 09:00. Everyone sees their own time zone.
          </figcaption>
        </figure>
      </main>

      {/* The window reads the address in the browser, so it waits for the page to be there. */}
      <Suspense fallback={null}>
        <AuthModal
          minPasswordLength={MIN_PASSWORD_LENGTH}
          confirmationCodeLength={CONFIRMATION_CODE_LENGTH}
          confirmationCodeValidMinutes={CONFIRMATION_CODE_VALID_MINUTES}
          demoUsers={DEMO_USERS}
        />
      </Suspense>
    </div>
  )
}
