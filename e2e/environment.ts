import path from 'node:path'

// The browser tests run on their own server, with their own database and their own build folder,
// so they can run while the development server is up.
export const E2E_PORT = 3500
export const E2E_URL = `http://localhost:${E2E_PORT}`

export const E2E_PASSWORD = process.env.SEED_PASSWORD ?? 'Password@123!'

// Every email the server sends during the tests lands in this file, one JSON object per line.
export const EMAIL_OUTBOX = path.resolve(__dirname, '.outbox.jsonl')

export const e2eEnvironment: Record<string, string> = {
  DATABASE_URL: 'file:./prisma/db/e2e.db',
  NEXT_DIST_DIR: '.next-e2e',
  NEXT_PUBLIC_APP_URL: E2E_URL,
  EMAIL_OUTBOX,
  SEED_PASSWORD: E2E_PASSWORD,
}
