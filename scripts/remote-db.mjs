#!/usr/bin/env node
// Runs a command pointed at a REMOTE database (Turso) from local.
// Usage: node scripts/remote-db.mjs <staging|prod> <cmd> [args...]
// Reads STAGING_* or PROD_* from the single .env and passes them to the child as DATABASE_URL and DATABASE_AUTH_TOKEN.
import 'dotenv/config'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join, delimiter } from 'node:path'

const binDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'node_modules', '.bin')

const [environment, cmd, ...args] = process.argv.slice(2)
const prefixes = { staging: 'STAGING', prod: 'PROD' }
const prefix = prefixes[environment]
if (!prefix || !cmd) {
  console.error('usage: node scripts/remote-db.mjs <staging|prod> <cmd> [args...]')
  process.exit(1)
}

const url = process.env[`${prefix}_DATABASE_URL`]
if (!url) {
  console.error(`⛔ ${prefix}_DATABASE_URL is not set in .env`)
  process.exit(1)
}

console.warn(`🌐 Pointing at ${environment.toUpperCase()} (${url.split('://')[0]}://…) → ${cmd} ${args.join(' ')}`)

const child = spawn(cmd, args, {
  stdio: 'inherit',
  env: {
    ...process.env,
    PATH: `${binDir}${delimiter}${process.env.PATH ?? ''}`,
    DATABASE_URL: url,
    DATABASE_AUTH_TOKEN: process.env[`${prefix}_DATABASE_AUTH_TOKEN`] ?? '',
  },
})
child.on('exit', (code) => process.exit(code ?? 0))
