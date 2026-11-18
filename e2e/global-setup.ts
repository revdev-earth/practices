import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

import { e2eEnvironment, EMAIL_OUTBOX } from './environment'

// A fresh database with the demo data and an empty outbox before every run.
export default function globalSetup() {
  const env = { ...process.env, ...e2eEnvironment }
  execSync('pnpm exec prisma db push', { env, stdio: 'inherit' })
  execSync('pnpm exec tsx prisma/seed.ts', { env, stdio: 'inherit' })
  writeFileSync(EMAIL_OUTBOX, '')
}
