# Practices documentation

This folder holds the project context, so work can resume without rereading old conversations.

## Reading order

1. [status.md](status.md) lists what is done, what is missing and the next step. It gets updated at the end of every block of work.
2. [goal.md](goal.md) describes the app we expect and the decisions already made.
3. [architecture.md](architecture.md) explains the stack, routes, data model, time zones and code conventions.

## Local setup

```bash
cp .env.example .env   # fill in BETTER_AUTH_SECRET and SEED_PASSWORD
pnpm install
pnpm db:push && pnpm db:seed
pnpm dev               # http://localhost:3000
```

The demo users created by the seed share the password in `SEED_PASSWORD`. Their emails are in `prisma/seed.ts`, for example `dana@practices.test`.

In development the login window has a button that fills in a demo user with one click.

A new account needs the code sent to its email. With no email provider configured, the dev server prints the code in its terminal.

`pnpm dev:prod` and `pnpm dev:staging` point the server at Turso. A new remote database has no tables until `pnpm db:prod:push` or `pnpm db:staging:push` runs. Before that, every query fails with `no such table`.

## Reference project

The sibling project lives in `/Users/rev/dev/properties`. The stack, the Turso scripts and the conventions come from there. Its quick guide is `AGENTS.md`.
