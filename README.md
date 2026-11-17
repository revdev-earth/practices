# Practices

An app for organizing group practice sessions on any topic. One person posts a practice with a date, a duration and a group size. Others join. Once the minimum is reached the practice is confirmed. Once the maximum is reached, whoever joins next goes on the waitlist and moves up when someone leaves.

Everyone sees times in their own time zone.

## What it includes

- Registration with a 6 digit email confirmation code, login, logout and password recovery. All of it happens in one window on top of the landing page.
- A monthly calendar where people land after logging in, with every practice on its day.
- A list of practices with views: upcoming, needs people, confirmed, mine and past.
- Video rooms for online practices, built with LiveKit. Only people with a confirmed spot get in.
- A practice page with the sign-up sheet, waitlist, join, leave, copy summary, and editing and deleting in place from the icons in its header.

## Stack

Next.js 16, React 19, TypeScript, Tailwind CSS 4, Prisma 7 with libSQL, Better Auth, Zod 4, Resend, LiveKit and pnpm. No Redux.

## Getting started

```bash
cp .env.example .env   # fill in BETTER_AUTH_SECRET and SEED_PASSWORD
pnpm install
pnpm db:push && pnpm db:seed
pnpm dev               # http://localhost:3000
```

The demo users share the password in `SEED_PASSWORD`, for example `dana@practices.test`. In development the login window has a button that fills them in with one click.

Without `RESEND_API_KEY`, in development the confirmation code and the password reset link are printed in the server terminal.

For the video rooms, run `pnpm livekit` in another terminal. It starts a local LiveKit server in Docker with the development keys that `.env.example` already lists.

## Scripts

| Command | What it does |
|---------|--------------|
| `pnpm dev` | Development server with the local database |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm db:push` | Syncs the schema with the local database |
| `pnpm db:seed` | Wipes the local database and loads demo users and practices |
| `pnpm livekit` | Local LiveKit server in Docker, to try the video rooms |
| `pnpm db:studio` | Prisma Studio |
| `pnpm dev:staging` and `pnpm dev:prod` | Development server pointed at the staging or production Turso database |
| `pnpm db:staging:push` and `pnpm db:prod:push` | Create the tables and columns Turso is missing. They only add |
| `pnpm db:staging:seed` | Loads demo data into staging. Production is never seeded |

`pnpm dev:prod` writes to the production database. A newly created remote database needs its `push` first, or every query fails with `no such table`.

## Deployment

Vercel runs `scripts/vercel-build.mjs`, which generates the client, syncs the schema in Turso and builds. Variables needed per environment:

`PROD_DATABASE_URL` and `PROD_DATABASE_AUTH_TOKEN` in production (`STAGING_*` in previews), `BETTER_AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, `RESEND_API_KEY`, `FROM_EMAIL`, `NEXT_PUBLIC_LIVEKIT_URL`, `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET`.

Without `RESEND_API_KEY` and `FROM_EMAIL` nobody can finish a registration, because the code never arrives. Without the three LiveKit values the video room is not offered and the rest of the app works as usual.

## Documentation

It lives in [docs/](docs/README.md). To resume work, start with [docs/status.md](docs/status.md).

The reference project is `properties`, in `/Users/rev/dev/properties`.
