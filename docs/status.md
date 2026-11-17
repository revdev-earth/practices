# Status

Last updated on 2026-11-16.

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
- [x] `/practices/[id]` with the sign-up sheet, waitlist, join, leave and copy summary
- [x] Editing in place on `/practices/[id]`, with a pencil in the header of the sheet. The `/edit` route no longer exists
- [x] Error page and not found page
- [x] `scripts/remote-db.mjs`, `scripts/turso-push.mjs` and `scripts/vercel-build.mjs`
- [x] `prisma/seed.ts` with demo users, already confirmed, and practices
- [x] `vercel.json`

The pages `/login`, `/register`, `/forgot-password` and `/reset-password` no longer exist. Their forms moved into the account window.

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
- [ ] First commit. The repo has no commits yet. Almost everything is staged and the last edits of 2026-11-16 are not, so `git add -A` comes before committing

## Notes for the next session

In development the confirmation code and the reset link are printed by the dev server. They are also written to `.next/dev/logs/next-development.log`.

The demo users of the seed are confirmed, so they log in straight away with the password in `SEED_PASSWORD`.

`next dev` refuses to start a second server in the same folder. Other projects on this machine use ports 3000, 3100, 3200 and 3300.

In this shell `rm` asks for confirmation and waits forever in a script. `/bin/rm` does not.

The walk through script is not in the repo. Playwright was borrowed from `/Users/rev/dev/properties/node_modules`.

## Next step

Deploy. Create the Turso databases, set up Resend, run `pnpm db:staging:push`, connect the repo to Vercel with `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `BETTER_AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, `RESEND_API_KEY` and `FROM_EMAIL` per environment, and repeat the walk through on staging.

After that, the walk through can become the Playwright tests listed in `docs/goal.md`.
