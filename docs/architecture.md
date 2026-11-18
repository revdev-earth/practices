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
| `/calendar` | The month or the week with every practice on its day, and the agenda of one day | Session |
| `/share/[id]` | Read only page of a public practice, with the guest entry to its room | Public |
| `/practices` | List with views | Session |
| `/practices/new` | Post a practice, also from a time chosen in a poll | Session |
| `/practices/[id]` | Detail, sign-up sheet, join, leave and edit in place by the organizer | Session |
| `/practices/[id]/room` | Video room of an online practice, only for people with a confirmed spot, with groups arranged by the host | Session |
| `/practices/[id]/event.ics` | The practice as a calendar file | Session |
| `/share/[id]/event.ics` | The calendar file of a public practice | Public |
| `/polls` | The polls a person hosts or answered | Session |
| `/polls/new` | Propose times for a practice | Session |
| `/polls/[id]` | Answer a poll, see the answers, and for the host, post the practice at a time | Public |

`/`, everything under `/share/` and each poll at `/polls/[id]` are public. `src/proxy.ts` checks the session cookie and sends anyone without it to `/?auth=login&next=…`, which opens the login step of the account window and remembers the destination. Every private page validates the real session with `requireUser()`. Every Server Action validates it with `getUser()`.

The landing page accepts `?auth=` with `login`, `register`, `forgot` or `reset`, plus `next` for the destination and `token` for the password reset link.

The calendar accepts `?month=2026-11` to open a month and `?day=2026-11-19` to select a day, which also picks its month. `?view=week` shows the week that holds the selected day.

The list accepts `?view=` with `upcoming`, `open`, `confirmed`, `mine` or `past`.

`/practices/new` accepts `?day=` and opens the form on that day. With `?poll=` and `?option=` it opens with the title, description, duration and time of a poll of the host that has no practice yet.

The path builders live in `src/lib/redirects.ts`, with `HOME_PATH`, `authModalPath`, `calendarPath`, `practicePath`, `roomPath`, `sharePath`, `shareablePracticePath`, `absoluteUrl` and `safeNextPath`.

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

`GuestSignup` is a spot taken without an account, on a public practice. It stores the name and the guest id of the browser, and the practice and guest pair is unique. The sheet merges both tables by `joinedAt`, with `sheetOrder` in `src/lib/practices.ts`, so people with and without an account share one order.

`User`, `Session`, `Account` and `Verification` are the Better Auth tables. `User` adds `confirmationCodeSentAt` and `timeZone`.

`TimePoll`, `TimePollOption` and `TimePollVote` keep the polls, their times and the answers. A vote belongs to `user:<id>` or to `guest:<uuid>`, and the pair of time and person is unique. `TimePoll.practiceId` points to the practice posted from the poll.

`Practice.roomClosedAt` is set when the host ends the call for everyone.

`AttemptCounter` counts the tries of one action inside a window of time, for the attempt limits.

`CallGroups` exists while the host has the call of a practice split into groups. It stores the number of groups and, as JSON, the group of each person of the call.

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

`MonthSheet` draws the month as a table. From 768 pixels a day box is at least 5.5 rem tall and grows with its practices, so a quiet week stays short. A practice writes its time and title as one text over up to two lines. Each day box is one link that selects the day. The practices of a day are `PracticeMark` links in the highlighter color of their status, placed above the link of the box. A pen dot marks the practices the viewer signed up for and it is hollow while the viewer is on the waitlist. Below 768 pixels a box only fits a short stroke per practice.

The practices of the selected day are listed under the month with the same `PracticeRow` the list uses.

`WeekSheet` draws the week as a planner page, with a column per day and a row per hour. Each practice is a block of highlighter as long as it lasts, placed by its wall clock time in the viewer's zone. Practices that overlap split the width of their day, each in its own lane. A practice that runs past midnight stops at the end of its day. The 24 hours scroll inside the sheet, about twelve at a time at 2.75 rem per hour, and `WeekHours` opens them on the twelve hours that hold the most practices starting at least an hour before the bottom edge. A pen line marks the current time across today. Below 768 pixels the week becomes a list of days with the same `PracticeMark` as the month.

The Month and Week switch keeps the selected day, so each view opens on the day picked in the other.

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

`/practices/[id]/room` gives a pass only to people with a confirmed spot, from 15 minutes before the start while the room is open. The waitlist, people who did not join and people outside the practice see a message instead. `VideoRoom` connects to the room and `PracticeCall` draws the call with the LiveKit components: cameras, microphone, screen share and chat.

`PracticeCall` follows the `VideoConference` of LiveKit and adds a bar to choose the layout. Grid shows everyone at the same size, with as many people as fit or a fixed number per screen, 4, 9, 16 or 25, and pages for the rest. Speaker fills the screen with whoever spoke last, preferring someone other than the viewer, and leaves the rest in a strip. The pin button on a tile fills the screen with that person in any layout until they are unpinned. A screen share pins itself when it starts. Each person chooses for themselves and the browser keeps the choice in `localStorage`.

## Groups in the call

The host splits the people of the main room into groups, each with a LiveKit room of its own, named `practice-<id>-group-<n>`. Group 0 is the main room. The rules of the split are in `src/lib/callGroups.ts`. The number of groups is the number of people divided by the group size, rounded down. People are shuffled and dealt one by one to group 1, 2 and so on, so the people left over join a group one each. The host stays in the main room.

The actions in `src/actions/callGroups/index.ts` check that the person asking is the host and that the call is running. Each change is written to `CallGroups` first and then announced in the metadata of the main room and of every group room, through `announceGroups` in `src/lib/livekit.ts`.

Every browser in the call reads that metadata with `GroupFollower`. When its person belongs to another room, it calls `switchCallRoomAction` with the pass it already has. The server checks the pass, reads the group from the database and signs a pass for the right room with the same identity and name. That works the same for members and for guests. `VideoRoom` then connects to the new room, and a move between rooms is not taken as leaving the call.

`CallGroupsPanel` is the host's panel, opened from Groups in the bar of the call. It splits the call, moves a person with the list next to their name, lets the host visit a group and brings everyone back. Every person sees which group they are in at the top of the call.

## Call styles

The rules for the call in `src/app/globals.css` stay outside the CSS layers. The LiveKit styles are not layered, and a layered rule always loses to them.

The time of the practice does not close the room. `roomStateOf` in `src/lib/livekit.ts` says whether a room is waiting, open or closed. Until the end it is open. After the end it stays open while any room of the call still exists in LiveKit, and LiveKit keeps a room 5 minutes after its last person leaves. The host closes it for good with End call, which sets `Practice.roomClosedAt` and deletes every room of the practice, so LiveKit disconnects everyone. A pass stays valid 2 hours past the end so a call that runs over can reconnect. The pages decide who gets one.

The room page, the guest entry, the groups and the move between rooms all ask `roomStateOf`. The page of a practice whose time is up says when the call is still going, and the public page keeps the guest entry while it does.

Without the three `LIVEKIT` variables the practices keep working and the room button says it is not available. In development `pnpm livekit` starts a local server in Docker with public development keys from `livekit.dev.yaml`. In production the values come from a LiveKit Cloud project.

## Spots without an account

On the public page of a practice, `GuestSpot` takes a spot with just a name, or a place on the waitlist when the sheet is full. The sheet shows the name with the tag not registered. Such a spot counts toward the minimum and the maximum like any other, and someone leaving moves the waitlist up whoever they are.

The guest id of the browser lives in the `poll_voter` cookie, `httpOnly` for a year, through `src/lib/guests.ts`. The name stays from the first deploy, when only polls used it. The same id answers polls and holds spots, so a yes given in a poll without an account becomes a spot when the host posts the practice as public. A private practice never takes spots without an account, since those people cannot open it.

The same browser gives the spot back. The host takes a guest off the sheet from the sheet itself, with a confirmation. Guests have no email, so the notices leave them out. Taking spots without an account is limited to 10 per hour per address.

A guest with a confirmed spot enters the room with the name of the spot, without typing it again. The pass has the identity `listed-<id>`, so the spot uses one of the places of the sheet and never one of the places for visitors.

## Public practices and guests

`Practice.isPublic` is chosen in the form, private by default. A public practice has the page `/share/[id]`, which anyone can open with no account. It shows the practice, the host, how many spots are taken and no names from the sign-up sheet. A private practice answers 404 at that address, so its link gives nothing away. Someone who is logged in is sent to the full page at `/practices/[id]`.

If the public practice has a Practices room, the page also lets a visitor into the call with a name, without a spot on the sheet. `enterAsGuestAction` checks everything on the server: the name, that the practice is public, has a room, has not ended and that the room is open. A guest has no spot on the sheet.

The room of a public practice has 10 extra places for guests, `GUEST_SEATS` in `src/lib/livekit.ts`. LiveKit enforces the total and the pass for a guest is refused once 10 guests are inside, so guests can never take the place of someone with a confirmed spot.

The summary that the organizer copies carries the public link when the practice is public.

## Polls

A poll finds the time of a practice before it is posted. `TimePoll.kind` says whether it asks for times or for days. A day is a calendar date, the same for everyone whatever their zone, kept in `TimePollOption.day`. Its `startsAt` is noon UTC of that day, which keeps the options in order. The rules are in `src/lib/timePolls.ts`, the reads in `src/lib/timePollReads.ts` and the actions in `src/actions/polls/index.ts`.

The host gives a title, a description, a duration and from 2 to 10 times in the future, typed in their zone and sent as exact instants, or from 2 to 10 days from today on. The form switches between both and keeps what was typed. The poll page shows each time in the zone of whoever opens it.

Anyone with the link answers yes, if needed or no to every time. With a session the name is the one of the account. Without one the person types a name and the `poll_voter` cookie, `httpOnly` for a year, keeps the answers theirs so they can change them from the same browser. Saves without an account are limited to 30 per hour per address.

The time that works best has the most yes answers, then the most if needed. Every time tied with it is marked. The host posts the practice from any future time with Post at this time, or from a day with Post on this day, which opens the practice form already filled in. A day opens at 19:00 for the host to change. On posting, `createPracticeAction` checks that the poll is the host's and has no practice yet, signs up the people with an account who said yes, in the order they answered, after the host, and links the poll to the practice. The poll then takes no more answers and points to the practice.

The page of a new practice and an empty day of the calendar link to the polls, for when the time is not clear yet.

`noticePollDecision` emails the people signed up from the poll, telling them whether they have a spot or wait, and the people with an account who said if needed, so they can join. People who answered with just a name have no email and see the chosen time on the poll page.

## Link previews

A chat app fetches a pasted link from its own server and shows its title, description and image. `src/lib/linkPreview.ts` writes them for a public practice and for a poll. The app has no time zone of the reader there, so the time goes in the zone of the host, from `User.timeZone`, with the zone written out. A private practice gives no details.

`opengraph-image.tsx` under `/share/[id]` and `/polls/[id]` draws a picture of 1200 by 630 with `next/og`: a white sheet on the desk with the status, the title, the day, the time, the place and the spots. `src/lib/previewImage.tsx` holds the shared parts and loads Bricolage Grotesque and Instrument Sans from Google Fonts, only the letters drawn. Without them the picture keeps the default typeface. `src/proxy.ts` leaves the picture of a poll public.

## Sharing

`ShareButton` shares a link. On a touch screen it opens the share sheet of the system, with the chats and apps of the person. On a computer it copies the link. The page of a practice shares the public page when the practice is public and the page behind the login when it is private, and says which. The public page of a practice and the page of a poll have it too.

## Add to calendar

`src/lib/calendarInvite.ts` writes a practice as an iCalendar file and as a Google Calendar link. Both carry the times in UTC, so each calendar shows them in its own zone. The file keeps the same `UID` for a practice, so importing it again after a change updates the event. Long lines are folded at 75 bytes without splitting a character.

A member gets the file at `/practices/[id]/event.ics`, with the room or the location of the practice. A guest of a public practice gets it at `/share/[id]/event.ics`, with the public page as its place, since the room needs an account. `AddToCalendar` shows both links under the buttons of the practice.

## Attempt limits

`src/lib/attemptLimits.ts` counts tries in the `attempt_counters` table, one row per action and subject, such as `login:dana@practices.test`. A try over the limit is refused and not counted, so the window ends on time. Rows older than a day are dropped on the next try.

| Action | Limit |
|--------|-------|
| Logging in to one email | 10 every 15 minutes |
| Logging in from one address | 50 every 15 minutes |
| Asking for a reset link for one email | 3 every hour |
| Asking for reset links from one address | 10 every hour |
| Creating accounts from one address | 10 every hour |

The email code step checks the password too, so its tries count as logins. A successful login starts the count of that email over. Past the limit of one email, a reset request gets the same answer and sends nothing, so the limit does not tell whether the account exists.

The address is the first entry of `x-forwarded-for`, which Vercel fills in. A local server has no proxy in front and no address, so the address limits do not apply there.

## Practice notices

`src/lib/practiceNotices.ts` emails the people of a practice when something changes for them. Each action that changes a sheet reads it with `readSheet` before and after, and `noticeSheetChanges` compares both.

| Change | Who gets an email |
|--------|-------------------|
| The practice reaches its minimum | Everyone with a spot |
| Someone moves up from the waitlist | That person |
| The host moves the time | Everyone on the sheet and the waitlist |
| The host deletes an upcoming practice | Everyone on the sheet and the waitlist |

The person who made the change sees it on screen and gets no email. A move up can come from someone leaving or from the host raising the maximum, and a confirmation from someone joining or from the host lowering the minimum. The emails go out with `after` from `next/server`, once the answer reached the browser.

An email is built with no browser, so `User.timeZone` keeps the zone of the browser the person last used. It is written from the `tz` cookie on login, on posting and on joining. A person with no zone stored gets the times in UTC, written as such. Titles and names are escaped before they go into the HTML.

## Email

`src/lib/email.ts` sends the confirmation code of a new account, the password reset link and the practice notices with Resend. The reset link points to `/?auth=reset&token=…`, which opens the new password step of the account window.

With `EMAIL_OUTBOX` set, outside production, every email is appended to that file as one line of JSON instead of being sent. The browser tests read it.

Without `RESEND_API_KEY`, in development the code and the link are printed in the terminal. In production nothing is sent and nobody can finish a registration, so the key is required there. The server log names the kind of email and leaves the code out.

## Browser tests

The Playwright tests live in `e2e/` and run with `pnpm test:e2e`. They start their own server on port 3500 with its own database, `prisma/db/e2e.db`, and its own build folder, `.next-e2e`, chosen with `NEXT_DIST_DIR` in `next.config.ts`. That lets them run while the development server is up.

`e2e/global-setup.ts` syncs the schema, runs the seed and empties the outbox before every run. `e2e/database.ts` writes to the test database directly, for situations the interface does not offer, such as a practice at a chosen hour. `e2e/helpers.ts` logs in and reads the emails from the outbox.

The browser runs in Berlin unless a test picks another zone. Tests that depend on the wall clock use Tokyo, which has no daylight saving time.
