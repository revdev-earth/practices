#!/usr/bin/env node
// Syncs the Prisma schema with the remote Turso (libSQL) database. It can be repeated safely.
// Prisma CLI does not push to libsql://, so the SQL is generated with migrate diff and applied with the libSQL client.
// - Creates the missing tables.
// - Adds the new columns of tables that already exist (when they are optional or have a default value).
// - Creates the missing indexes.
// It never drops or changes existing columns. Those changes are listed at the end to be done by hand.
// Usage: node scripts/turso-push.mjs <staging|prod|current>
//   staging and prod read STAGING_* or PROD_* from .env. current uses DATABASE_URL and DATABASE_AUTH_TOKEN (the Vercel build).
import 'dotenv/config'
import { execFileSync } from 'node:child_process'
import { createClient } from '@libsql/client'

const environment = process.argv[2]
const prefix = { staging: 'STAGING', prod: 'PROD' }[environment]
if (!prefix && environment !== 'current') throw new Error('Usage: node scripts/turso-push.mjs <staging|prod|current>')

const url = prefix ? process.env[`${prefix}_DATABASE_URL`] : process.env.DATABASE_URL
const authToken = prefix ? process.env[`${prefix}_DATABASE_AUTH_TOKEN`] : process.env.DATABASE_AUTH_TOKEN
if (!url?.startsWith('libsql://') && !url?.startsWith('file:')) throw new Error('The database URL must be libsql://… (or file: for tests)')
if (url.startsWith('libsql://') && !authToken) throw new Error('The database auth token is missing')

const sql = execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'diff', '--from-empty', '--to-schema', 'prisma/schema.prisma', '--script'], {
  encoding: 'utf8',
  env: { ...process.env, DATABASE_URL: 'file:./prisma/db/dev.db' },
})

const statements = sql
  .split(/;\s*\n/)
  .map((statement) => statement.replace(/^(\s*--[^\n]*\n)+/g, '').trim())
  .filter(Boolean)

const client = createClient({ url, authToken })

const existingTables = new Set((await client.execute("SELECT name FROM sqlite_master WHERE type = 'table'")).rows.map((row) => String(row.name)))
const existingIndexes = new Set((await client.execute("SELECT name FROM sqlite_master WHERE type = 'index'")).rows.map((row) => String(row.name)))

const created = []
const addedColumns = []
const addedIndexes = []
const manual = []

for (const statement of statements) {
  const table = statement.match(/^CREATE TABLE "([^"]+)"/)
  const index = statement.match(/^CREATE (?:UNIQUE )?INDEX "([^"]+)"/)

  if (table) {
    const name = table[1]
    if (!existingTables.has(name)) {
      await client.execute(statement)
      created.push(name)
      continue
    }

    // The table exists. The columns it is missing are added.
    const present = new Set((await client.execute(`PRAGMA table_info("${name}")`)).rows.map((row) => String(row.name)))
    const body = statement.slice(statement.indexOf('(') + 1, statement.lastIndexOf(')'))
    for (const raw of body.split('\n')) {
      const line = raw.trim().replace(/,$/, '')
      const column = line.match(/^"([^"]+)"\s/)
      if (!column || present.has(column[1])) continue

      const definition = line.replace(/\s+PRIMARY KEY/, '')
      if (/NOT NULL/.test(definition) && !/DEFAULT/.test(definition)) {
        manual.push(`${name}.${column[1]} is required and has no default value`)
        continue
      }
      await client.execute(`ALTER TABLE "${name}" ADD COLUMN ${definition}`)
      addedColumns.push(`${name}.${column[1]}`)
    }
  } else if (index) {
    if (existingIndexes.has(index[1])) continue
    await client.execute(statement)
    addedIndexes.push(index[1])
  }
}

console.log(`Tables created ${created.length}${created.length ? `: ${created.join(', ')}` : ''}`)
console.log(`Columns added ${addedColumns.length}${addedColumns.length ? `: ${addedColumns.join(', ')}` : ''}`)
console.log(`Indexes created ${addedIndexes.length}`)
if (manual.length) console.warn(`Need a manual change:\n - ${manual.join('\n - ')}`)
client.close()
