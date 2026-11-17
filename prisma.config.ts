import 'dotenv/config'
import { defineConfig } from 'prisma/config'

import { resolveDatabase } from './src/lib/databaseEnv'

const { url } = resolveDatabase()
if (!url) throw new Error('The database is not configured: set DATABASE_URL, or PROD_DATABASE_URL on Vercel production')

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: { url },
})
