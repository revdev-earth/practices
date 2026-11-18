# Status

Last updated on 2026-11-18.

## Done

- [x] Project setup with `package.json`, TypeScript, ESLint, Prettier, PostCSS, Tailwind 4 and `.env.example`
- [x] Prisma schema with `Practice`, `Signup` and the Better Auth tables
- [x] `src/lib`, with the Prisma client, Better Auth, emails, practice rules, practice reads, dates, time zone and paths
- [x] `src/proxy.ts`, which sends anyone without a session to the login window
- [x] `src/actions/practices/index.ts`, post, edit, delete, join and leave
- [x] `src/actions/auth/index.ts`, register, confirm the email, send a new code, log in, log out and reset the password
- [x] Landing page `/` with the account window: log in, create account, email code, forgot password and new password
- [x] `src/components/Modal.tsx`, the window with its opening and closing animation
- [x] Email confirmation with a 6 digit code, through the Better Auth `emailOTP` plugin
- [x] `/calendar`, the month with every practice on its day and the agenda of the selected day. It is where a person lands after logging in
- [x] `/practices` with views
- [x] `/practices/new`, which also opens on a day picked in the calendar, and the form shared with editing
- [x] Video rooms for online practices with LiveKit, at `/practices/[id]/room`, tested with fake cameras. The form offers Practices room or My own link
- [x] Public and private practices, with `/share/[id]` for people with no account and guest entry to the room by typing a name
- [x] `/practices/[id]` with the sign-up sheet, waitlist, join, leave and copy summary
- [x] Editing in place on `/practices/[id]`, with a pencil in the header of the sheet. The `/edit` route no longer exists
- [x] Error page and not found page
- [x] `scripts/remote-db.mjs`, `scripts/turso-push.mjs` and `scripts/vercel-build.mjs`
- [x] `prisma/seed.ts` with demo users, already confirmed, and practices
- [x] `vercel.json`
- [x] Add to calendar, with a Google Calendar link and an `.ics` file for members and for guests of public practices
- [x] Attempt limits on login, the email code, password reset requests and new accounts
- [x] Week view of the calendar, with a column per day and a row per hour, and a list of days on a phone
- [x] Email notices when a practice is confirmed, when someone moves up from the waitlist, when the time moves and when the practice is cancelled. `User.timeZone` keeps the zone each email is written in
- [x] Layout of the video room chosen by each person: grid with a number of people per screen, speaker, or one person pinned
- [x] Groups in the video call: the host splits, moves, visits and brings everyone back, and each browser follows its group
- [x] Polls to find the time of a practice, answered with or without an account, with the practice posted from the chosen time and the yes answers signed up
- [x] The room stays open past the end while people are in it, and the host ends the call for everyone
- [x] Playwright tests in `e2e/`, with their own server, database and outbox, run with `pnpm test:e2e`. They cover the account, practices, the calendar, public pages and guests, and everything added on 2026-11-18

The pages `/login`, `/register`, `/forgot-password` and `/reset-password` no longer exist. Their forms moved into the account window.

## Checks on 2026-11-18

`pnpm test:e2e` passes 34 of 34 tests in about two and a half minutes. The polls and the call past the end were added in the second half of the day. The tests of rooms and groups connect up to five browsers with fake cameras to the LiveKit Cloud project in `.env`, and skip themselves when LiveKit is not configured.

In one of four full runs the room layout test failed and passed again alone. Nine more runs of the room tests passed. The cause remains without enough evidence. The two LiveKit test files have one retry, since they depend on the network.

`tsc --noEmit`, `eslint` and `next build` pass with no errors and no warnings.

The schema gained the `attempt_counters`, `call_groups`, `time_polls`, `time_poll_options` and `time_poll_votes` tables, `users.timeZone` and `practices.roomClosedAt`. All of it is additive, so `pnpm db:staging:push` and `pnpm db:prod:push` can apply them.

## Checks on 2026-11-16

`tsc --noEmit`, `eslint`, `prettier --check` and `next build` pass with no errors and no warnings.

A browser walk through with Playwright passed 136 of 136 checks against the dev server, with people in Berlin, Tokyo and Bogota. The browser console stayed clean.

The account window was checked for opening from each button, the focus on the first field, closing with Escape, with the back button, with a click outside and with the close button, and staying open when a text selection is dragged out of a field.

The email code was checked for the unconfirmed account, the wrong code, the three tries, the lock after them, the 60 second wait kept by the server, the new code replacing the old one, the login that leads to the code step, and the registration of an email by someone who does not own it.

The calendar was checked for the landing after login, the current month and day, the month buttons, selecting a day, the agenda, opening a practice and coming back to its day, posting from an empty day, the pen dot, the status colors, the phone layout, and one practice sitting on different days in Berlin and Tokyo.

The practice flows of the earlier walk through were repeated, with posting, editing, joining, the waitlist moving up, the copied summary, the list views, deleting and the 404 pages.

The password reset was checked from the request to the link, the new password step, the return to log in, the old password failing and the used link being rejected.

A shorter run against the production build passed 9 of 9 checks with a clean console.

`scripts/turso-push.mjs` was run against a SQLite file with the earlier schema. It added `users.confirmationCodeSentAt` and the index on `practices.startsAt`, and a second run changed nothing.

Still unchecked, because they need accounts that do not exist yet: the scripts against a real Turso database, the Vercel build and a real email through Resend.

## Waiting on the project owner

- [ ] Create the Turso databases for staging and production and fill in `STAGING_*` and `PROD_*` in `.env`
- [ ] Set `RESEND_API_KEY` and `FROM_EMAIL`. They are now required outside development: without them the confirmation code is never sent and nobody can finish a registration
- [ ] Create a LiveKit Cloud project and set `NEXT_PUBLIC_LIVEKIT_URL`, `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` in staging and production. Without them the Practices room is not offered
- [ ] Commit. The public practices from before are staged and the work of 2026-11-18 is not, so `git add -A` comes before committing

## Notes for the next session

In development the confirmation code and the reset link are printed by the dev server. They are also written to `.next/dev/logs/next-development.log`.

The demo users of the seed are confirmed, so they log in straight away with the password in `SEED_PASSWORD`.

`next dev` refuses to start a second server with the same build folder. The browser tests use `.next-e2e` through `NEXT_DIST_DIR`, so they run next to the dev server. Other projects on this machine use ports 3000, 3100, 3200 and 3300.

In this shell `rm` asks for confirmation and waits forever in a script. `/bin/rm` does not.

`pnpm test:e2e` reuses a server already running on port 3500. After a schema change, stop that server so the tests start one with the new client.

## Next step

Review the work of 2026-11-18 in the browser, especially the week view, the room layouts, the groups, the polls and ending a call, and commit it.

In one screenshot of the poll page the Next.js development indicator showed one issue. Three later runs of the same steps left the browser console clean, so its cause remains without enough evidence.

Then deploy. Create the Turso databases, set up Resend, run `pnpm db:staging:push`, connect the repo to Vercel with `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `BETTER_AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, `RESEND_API_KEY` and `FROM_EMAIL` per environment, and repeat the walk through on staging.

