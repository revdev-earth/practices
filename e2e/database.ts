import { createClient } from '@libsql/client'

// Straight access to the test database, to prepare situations the interface does not offer, such as a practice that starts soon.
const withDatabase = async <T>(task: (client: ReturnType<typeof createClient>) => Promise<T>) => {
  const client = createClient({ url: 'file:./prisma/db/e2e.db' })
  try {
    return await task(client)
  } finally {
    client.close()
  }
}

export const practiceIdByTitle = (title: string) =>
  withDatabase(async (client) => {
    const result = await client.execute({ sql: 'SELECT id FROM practices WHERE title = ?', args: [title] })
    const id = result.rows[0]?.id
    if (typeof id !== 'string') throw new Error(`No practice called "${title}"`)
    return id
  })

export const makePracticePublic = (title: string) =>
  withDatabase((client) => client.execute({ sql: 'UPDATE practices SET isPublic = 1 WHERE title = ?', args: [title] }))

// Prisma keeps dates in SQLite as ISO text with the offset written out.
const sqliteDate = (date: Date) => date.toISOString().replace('Z', '+00:00')

type TestPractice = {
  title: string
  startsAt: Date
  durationMin: number
  organizerEmail: string
  // In arrival order, after the organizer.
  participantEmails?: string[]
  minParticipants?: number
  maxParticipants?: number
  videoRoom?: boolean
  isPublic?: boolean
}

// Puts a practice straight in the database, at any time, even one that already started.
export const insertPractice = (practice: TestPractice) =>
  withDatabase(async (client) => {
    const id = `e2e${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`
    const now = sqliteDate(new Date())
    const userId = async (email: string) => {
      const result = await client.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [email] })
      return String(result.rows[0].id)
    }
    const endsAt = new Date(practice.startsAt.getTime() + practice.durationMin * 60_000)
    await client.execute({
      sql: `INSERT INTO practices (id, title, description, startsAt, endsAt, mode, videoRoom, isPublic, location, minParticipants, maxParticipants, organizerId, createdAt, updatedAt)
            VALUES (?, ?, '', ?, ?, 'ONLINE', ?, ?, '', ?, ?, ?, ?, ?)`,
      args: [
        id,
        practice.title,
        sqliteDate(practice.startsAt),
        sqliteDate(endsAt),
        practice.videoRoom ? 1 : 0,
        practice.isPublic ? 1 : 0,
        practice.minParticipants ?? 2,
        practice.maxParticipants ?? 6,
        await userId(practice.organizerEmail),
        now,
        now,
      ],
    })
    const everyone = [practice.organizerEmail, ...(practice.participantEmails ?? [])]
    for (const [index, email] of everyone.entries()) {
      await client.execute({
        sql: 'INSERT INTO signups (id, practiceId, userId, joinedAt) VALUES (?, ?, ?, ?)',
        args: [`${id}s${index}`, id, await userId(email), sqliteDate(new Date(Date.now() - (everyone.length - index) * 1000))],
      })
    }
    return id
  })

// The attempt limit tests lock logins on purpose. The tests after them start with no counters.
export const clearAttemptCounters = () => withDatabase((client) => client.execute('DELETE FROM attempt_counters'))
