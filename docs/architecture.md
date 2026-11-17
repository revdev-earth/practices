# Architecture

## Stack

Next.js 16 with the App Router, React 19, TypeScript, Tailwind CSS 4, Prisma 7 with the libSQL adapter, Better Auth, Zod 4, Resend and lucide-react. The package manager is pnpm.

```
Browser (React)
  → Server Components read through src/lib/practices.ts
  → Server Actions write (src/actions/*)
    → Prisma
      → local SQLite (file:) or Turso (libsql://)
```

## Routes

| Route | Content | Access |
|-------|---------|--------|
| `/` | Landing page and the account window | Public |
| `/calendar` | The month with every practice on its day, and the agenda of one day | Session |
| `/practices` | List with views | Session |
| `/practices/new` | Post a practice | Session |
| `/practices/[id]` | Detail, sign-up sheet, join, leave and edit in place by the organizer | Session |
| `/practices/[id]/room` | Video room of an online practice, only for people with a confirmed spot | Session |

`/` is the only public page. `src/proxy.ts` checks the session cookie and sends anyone without it to `/?auth=login&next=…`, which opens the login step of the account window and remembers the destination. Every private page validates the real session with `requireUser()`. Every Server Action validates it with `getUser()`.

The landing page accepts `?auth=` with `login`, `register`, `forgot` or `reset`, plus `next` for the destination and `token` for the password reset link.

The calendar accepts `?month=2026-11` to open a month and `?day=2026-11-19` to select a day, which also picks its month.

The list accepts `?view=` with `upcoming`, `open`, `confirmed`, `mine` or `past`.

`/practices/new` accepts `?day=` and opens the form on that day.

The path builders live in `src/lib/redirects.ts`, with `HOME_PATH`, `authModalPath`, `calendarPath` and `safeNextPath`.

## Account window

Login, registration, the email code and password recovery are steps of one window, `src/app/_/AuthModal.tsx`, mounted on the landing page.

The step comes from the address, read with `useSearchParams`. The buttons on the landing page are `AuthLink` components. They change the address with `window.history.pushState`, which Next.js connects to `useSearchParams`, so the window opens at once with no trip to the server and the back button closes it.

The code step is the exception. It is kept in the state of the window, because it needs the password just typed and that only lives in memory.

`src/components/Modal.tsx` is the window itself. It is a native `<dialog>` opened with `showModal()`, which keeps the page behind out of reach, closes with Escape and returns the focus to where it was. The sheet lands with a slight tilt, follows the height of its content between steps and leaves with its own animation before the dialog closes for real. The styles and keyframes are in `src/app/globals.css` under `.modal`. With `prefers-reduced-motion` every animation is off.

Each step marks its first field with `data-autofocus` and the window moves the focus there.

## Email confirmation

Better Auth runs with `requireEmailVerification` and its `emailOTP` plugin, configured in `src/lib/auth.ts`. The code has 6 digits, works for 15 minutes and allows three tries. The database keeps a hash of it in the `verifications` table.

`src/lib/emailConfirmation.ts` decides when a code goes out. `User.confirmationCodeSentAt` stores the last time and a new code is allowed once every 60 seconds. Better Auth is told to send nothing on its own, so this is the single place that sends codes.

The flow of the actions in `src/actions/auth/index.ts`:

`registerAction` creates the account unconfirmed, sends the code and answers with `confirmEmail`, which moves the window to the code step. An email with a confirmed account is rejected. An email with an unconfirmed account is discarded and created again, once the 60 seconds have passed.

`loginAction` answers with `confirmEmail` too when the password is right and the email still waits for its code.

`confirmEmailAction` receives the email, the password and the code. It checks the password against the account first and the code second. Better Auth marks the email as confirmed and opens the session.

`resendConfirmationCodeAction` sends a new code if the 60 seconds have passed.

## Data model

The schema is in `prisma/schema.prisma`.

`Practice` stores the title, description, `startsAt`, `endsAt`, mode, location, `minParticipants`, `maxParticipants` and the organizer.

`Signup` links a person to a practice and stores `joinedAt`. The practice and user pair is unique.

`User`, `Session`, `Account` and `Verification` are the Better Auth tables. `User` adds `confirmationCodeSentAt`.

The waitlist is computed on read. Signups are ordered by `joinedAt`. The first `maxParticipants` have a spot and the rest wait. When someone leaves, the next person moves up on their own, with nothing written to the database.

The status of a practice is computed too, in `practiceStatus` in `src/lib/practiceRules.ts`. It is `open` while the minimum is missing, `confirmed` once it happens and spots remain, `full` once it filled up and `past` once it ended.

## Time zones

The database stores every date in UTC.

The `TimezoneSync` component reads the browser time zone and stores it in the `tz` cookie. When the cookie changes it refreshes the page. The server formats every date with that zone through `src/lib/dates.ts` and `src/lib/timezone.ts`. That way the server HTML and the browser show the same time. On the very first visit the cookie is still missing and `America/Bogota` is used.

The zone is shown next to every time, for example `GMT-5`.

The form uses a `datetime-local` input, which gives a time with no zone. The browser converts it to an ISO instant in UTC before sending it. The schema only accepts ISO instants, so the server always receives an exact moment.

## Calendar

A calendar day is written as a key, `2026-11-19`, and a month as `2026-11`, both in the viewer's zone. `dayKey` in `src/lib/dates.ts` turns an instant into the key of its day for a zone. The arithmetic on keys runs in UTC, where no day is skipped or repeated.

`calendarWeeks` gives the weeks a month page shows, Monday first, completed with days of the neighboring months.

The page reads the practices that start inside a stretch of UTC time wide enough for every zone, from `utcWindowCoveringDays`, and then groups them by `dayKey`. That keeps the query free of time zone math and puts each practice on the day the viewer sees it start.

`MonthSheet` draws the month as a table. Each day box is one link that selects the day. The practices of a day are `PracticeMark` links in the highlighter color of their status, placed above the link of the box. A pen dot marks the practices the viewer signed up for and it is hollow while the viewer is on the waitlist. Below 768 pixels a box only fits a short stroke per practice.

The practices of the selected day are listed under the month with the same `PracticeRow` the list uses.

## Interface

The visual idea is a paper sign-up sheet. The page background is a cool gray desk, content sits on white sheets, names and filled spots use ballpoint blue, and the status is a highlighter mark in yellow, green or pink.

The account window is a sheet put down on the desk. The calendar is a wall planner, with today circled in pen and every practice marked with highlighter.

The tokens live in `src/app/globals.css` under `@theme`. The display typeface is Bricolage Grotesque and the text typeface is Instrument Sans, both loaded with `next/font`.

`SeatTrack` draws one mark per spot with a tick at the minimum. `Roster` draws the numbered sheet with the line where the practice gets confirmed.

`AppShell` is the frame of every private page, with `AppHeader` on top. `AppNav` holds the two destinations, Calendar and List.

## Conventions

The `+/` alias points to `src/`.

Server Actions live in `src/actions/<topic>/index.ts`. Form actions return `{ success, errors }` with errors per field and the `form` key for the general error. One click actions return `{ success, error }`.

Rules shared by the browser and the server live in `src/lib/practiceRules.ts`, with the Zod schema and the limits.

Client forms submit through the `useFormAction` hook in `src/hooks/useFormAction.ts`. It keeps the typed values on screen after a validation error. A form that needs to react to the answer of its action wraps the action in a function of its own and passes that to the hook, as `LoginForm` does.

Components used by a single route go in a `_/` folder next to its page. Shared ones go in `src/components/`.

`'use client'` is used only in components with state, events or browser APIs.

Prettier uses 150 columns, single quotes and no semicolons.

`src/lib/prisma.ts` keeps one client on `globalThis` in development. After `prisma generate` the old client belongs to another class, fails the `instanceof` check and is replaced, so a schema change needs no restart of the dev server.

## Remote database

`pnpm db:push` syncs the local database. `pnpm db:staging:push` and `pnpm db:prod:push` sync Turso through `scripts/turso-push.mjs`, which only applies additive changes. `scripts/remote-db.mjs` runs any command against staging or production with the `STAGING_*` and `PROD_*` variables from `.env`.

On Vercel the database is chosen by the environment, in `src/lib/databaseEnv.ts`. Production reads `PROD_DATABASE_URL` and `PROD_DATABASE_AUTH_TOKEN`, a preview reads the `STAGING_*` pair, and `DATABASE_URL` stays as a fallback. The build script repeats that rule for its own commands.

On Vercel the build runs `scripts/vercel-build.mjs`, which generates the client, syncs the schema and compiles. Only the `staging` branch seeds demo data.

## Video rooms

An online practice can use a room of its own instead of an external link. The choice is `Practice.videoRoom`. The address of the room is never stored, it is always `/practices/[id]/room`.

The rooms run on LiveKit, the same service the `lives` project uses. `src/lib/livekit.ts` creates the room with the size limit of the practice, so LiveKit enforces the maximum and nine people pressing the button at once cannot overfill a room of eight. It also signs a pass for one person, valid until the practice ends.

`/practices/[id]/room` gives a pass only to people with a confirmed spot, from 15 minutes before the start until the end. The waitlist, people who did not join and people outside the practice see a message instead. `VideoRoom` draws the call with the LiveKit components: cameras, microphone, screen share and chat.

Without the three `LIVEKIT` variables the practices keep working and the room button says it is not available. In development `pnpm livekit` starts a local server in Docker with public development keys from `livekit.dev.yaml`. In production the values come from a LiveKit Cloud project.

## Email

`src/lib/email.ts` sends two emails with Resend, the confirmation code of a new account and the password reset link. The reset link points to `/?auth=reset&token=…`, which opens the new password step of the account window.

Without `RESEND_API_KEY`, in development the code and the link are printed in the terminal. In production nothing is sent and nobody can finish a registration, so the key is required there. The server log names the kind of email and leaves the code out.
