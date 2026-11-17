import 'dotenv/config'
import { PrismaClient } from '+/generated/prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) throw new Error('DATABASE_URL is not configured')

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Development reloads this file on every change, so the client is kept on globalThis and reused instead of opening a connection each time.
// A client created before the last `prisma generate` belongs to the previous class and does not know the new fields.
// It fails this check and gets replaced, so a schema change needs no restart of the dev server.
const reusableClient = globalForPrisma.prisma instanceof PrismaClient ? globalForPrisma.prisma : undefined

// Local uses a file (file:) and production uses Turso (libsql://) with its token.
const createClient = () =>
  new PrismaClient({
    adapter: new PrismaLibSql({ url: databaseUrl, authToken: process.env.DATABASE_AUTH_TOKEN || undefined }),
    log: ['error', 'warn'],
  })

export const prisma = reusableClient ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
