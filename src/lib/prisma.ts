import 'dotenv/config'
import { PrismaClient } from '+/generated/prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { resolveDatabase } from './databaseEnv'

const { url: databaseUrl, authToken: databaseAuthToken } = resolveDatabase()

if (!databaseUrl) throw new Error('The database is not configured: set DATABASE_URL, or PROD_DATABASE_URL on Vercel production')

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
    adapter: new PrismaLibSql({ url: databaseUrl, authToken: databaseAuthToken }),
    log: ['error', 'warn'],
  })

export const prisma = reusableClient ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
