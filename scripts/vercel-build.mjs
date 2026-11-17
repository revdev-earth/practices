#!/usr/bin/env node
// Vercel build. Each environment uses its own database (DATABASE_URL and DATABASE_AUTH_TOKEN set in Vercel).
// - Always syncs the schema, with additive changes only (new tables, columns and indexes).
// - Only the staging branch seeds demo data, with TEST_MODE=yes. Production never seeds.
import 'dotenv/config'
import { spawnSync } from 'node:child_process'

const run = (cmd, args, extraEnv = {}) => {
  const result = spawnSync(cmd, args, { stdio: 'inherit', env: { ...process.env, ...extraEnv } })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

const vercelEnv = process.env.VERCEL_ENV ?? 'local'
const branch = process.env.VERCEL_GIT_COMMIT_REF ?? ''
const seedsDemoData = vercelEnv === 'preview' && branch === 'staging'

console.log(`🏗️  Build ${vercelEnv}${branch ? ` (branch ${branch})` : ''}${seedsDemoData ? ' with demo data' : ''}`)

run('pnpm', ['exec', 'prisma', 'generate'])
if ((process.env.DATABASE_URL ?? '').startsWith('libsql://')) run('node', ['scripts/turso-push.mjs', 'current'])
if (seedsDemoData) run('pnpm', ['exec', 'tsx', 'prisma/seed.ts'], { TEST_MODE: 'yes' })
run('pnpm', ['exec', 'next', 'build'])
