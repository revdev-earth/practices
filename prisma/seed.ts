import 'dotenv/config'
import { hashPassword } from 'better-auth/crypto'

import { prisma } from '+/lib/prisma'

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

// Seeding wipes the whole database, so a remote one requires TEST_MODE=yes written on purpose.
const databaseUrl = process.env.DATABASE_URL ?? ''
if (!databaseUrl.startsWith('file:') && process.env.TEST_MODE !== 'yes') {
  console.error('⛔ Seeding wipes the database. A remote database needs TEST_MODE=yes.')
  process.exit(1)
}

const seedPassword = process.env.SEED_PASSWORD
if (!seedPassword) {
  console.error('⛔ SEED_PASSWORD is not set in .env')
  process.exit(1)
}

const DEMO_USERS = [
  { key: 'dana', name: 'Dana Reyes', email: 'dana@practices.test' },
  { key: 'kenji', name: 'Kenji Mori', email: 'kenji@practices.test' },
  { key: 'amara', name: 'Amara Obi', email: 'amara@practices.test' },
  { key: 'lucia', name: 'Lucía Fernández', email: 'lucia@practices.test' },
  { key: 'tom', name: 'Tom Becker', email: 'tom@practices.test' },
  { key: 'priya', name: 'Priya Nair', email: 'priya@practices.test' },
  { key: 'sofia', name: 'Sofia Rossi', email: 'sofia@practices.test' },
  { key: 'noah', name: 'Noah Kim', email: 'noah@practices.test' },
] as const

type DemoUserKey = (typeof DEMO_USERS)[number]['key']

type DemoPractice = {
  title: string
  description: string
  // Start relative to the moment the seed runs, so the list always has upcoming and past practices.
  startsInMs: number
  durationMin: number
  mode: 'ONLINE' | 'IN_PERSON'
  location: string
  minParticipants: number
  maxParticipants: number
  // In arrival order. The first one is the organizer.
  signups: DemoUserKey[]
}

const DEMO_PRACTICES: DemoPractice[] = [
  {
    title: 'Chess openings study group',
    description: 'We go through the Italian Game and play short games from the main lines.',
    startsInMs: -20 * MINUTE_MS,
    durationMin: 90,
    mode: 'ONLINE',
    location: 'https://meet.example.com/chess-openings',
    minParticipants: 2,
    maxParticipants: 6,
    signups: ['tom', 'priya', 'noah'],
  },
  {
    title: 'Mock interviews for frontend roles',
    description:
      'One person interviews, one answers and one takes notes. We rotate every 20 minutes.\n\nBring one question about React and one about CSS.',
    startsInMs: 1 * DAY_MS + 2 * HOUR_MS,
    durationMin: 60,
    mode: 'ONLINE',
    location: 'https://meet.example.com/mock-interviews',
    minParticipants: 3,
    maxParticipants: 5,
    signups: ['dana', 'kenji'],
  },
  {
    title: 'English conversation, intermediate level',
    description: 'Free conversation about a short article shared in advance. Corrections come at the end.',
    startsInMs: 1 * DAY_MS + 5 * HOUR_MS,
    durationMin: 45,
    mode: 'ONLINE',
    location: 'https://meet.example.com/english-conversation',
    minParticipants: 3,
    maxParticipants: 8,
    signups: ['lucia', 'amara', 'sofia', 'kenji', 'dana'],
  },
  {
    title: 'Guitar circle for beginners',
    description: 'Open chords and two simple songs. Bring your own guitar and a tuner.',
    startsInMs: 3 * DAY_MS,
    durationMin: 90,
    mode: 'IN_PERSON',
    location: 'Community room, 12 Mill Street',
    minParticipants: 2,
    maxParticipants: 4,
    signups: ['sofia', 'tom', 'noah', 'priya', 'lucia', 'amara'],
  },
  {
    title: 'Public speaking drills',
    description: 'Two minute talks with feedback from the group. Any topic works.',
    startsInMs: 5 * DAY_MS + 3 * HOUR_MS,
    durationMin: 120,
    mode: 'ONLINE',
    location: '',
    minParticipants: 4,
    maxParticipants: 20,
    signups: ['amara'],
  },
  {
    title: 'Spanish pronunciation workshop',
    description: 'Rolled r, vowels and word stress, with tongue twisters at the end.',
    startsInMs: -3 * DAY_MS,
    durationMin: 60,
    mode: 'ONLINE',
    location: 'https://meet.example.com/spanish-pronunciation',
    minParticipants: 3,
    maxParticipants: 6,
    signups: ['lucia', 'dana', 'tom', 'kenji'],
  },
  {
    title: 'Sketching from reference photos',
    description: 'Ten minute sketches from photos, then we compare approaches.',
    startsInMs: -10 * DAY_MS,
    durationMin: 60,
    mode: 'IN_PERSON',
    location: 'Riverside library, second floor',
    minParticipants: 3,
    maxParticipants: 5,
    signups: ['priya', 'sofia'],
  },
]

const resetDatabase = async () => {
  console.log('🧹 Wiping the database…')
  await prisma.signup.deleteMany({})
  await prisma.practice.deleteMany({})
  await prisma.session.deleteMany({})
  await prisma.account.deleteMany({})
  await prisma.verification.deleteMany({})
  await prisma.attemptCounter.deleteMany({})
  await prisma.user.deleteMany({})
}

const createDemoUsers = async () => {
  console.log('👥 Creating demo users…')
  const password = await hashPassword(seedPassword)
  const userIds = new Map<DemoUserKey, string>()

  for (const demoUser of DEMO_USERS) {
    const user = await prisma.user.create({ data: { name: demoUser.name, email: demoUser.email, emailVerified: true } })
    // Better Auth keeps the password in a "credential" account whose accountId is the user id.
    await prisma.account.create({ data: { userId: user.id, accountId: user.id, providerId: 'credential', password } })
    userIds.set(demoUser.key, user.id)
  }

  return userIds
}

const createDemoPractices = async (userIds: Map<DemoUserKey, string>) => {
  console.log('📋 Creating demo practices…')
  const now = Date.now()
  const userId = (key: DemoUserKey) => userIds.get(key) as string

  for (const practice of DEMO_PRACTICES) {
    const startsAt = new Date(now + practice.startsInMs)
    // People signed up over the days before the practice, one after another.
    const firstSignupAt = Math.min(now, startsAt.getTime()) - 2 * DAY_MS

    await prisma.practice.create({
      data: {
        title: practice.title,
        description: practice.description,
        startsAt,
        endsAt: new Date(startsAt.getTime() + practice.durationMin * MINUTE_MS),
        mode: practice.mode,
        location: practice.location,
        minParticipants: practice.minParticipants,
        maxParticipants: practice.maxParticipants,
        organizerId: userId(practice.signups[0]),
        signups: {
          create: practice.signups.map((key, index) => ({ userId: userId(key), joinedAt: new Date(firstSignupAt + index * 10 * MINUTE_MS) })),
        },
      },
    })
  }
}

const main = async () => {
  await resetDatabase()
  const userIds = await createDemoUsers()
  await createDemoPractices(userIds)

  console.log(`✅ Seed ready with ${DEMO_USERS.length} users and ${DEMO_PRACTICES.length} practices`)
  console.log(`   Log in with ${DEMO_USERS[0].email} and the password in SEED_PASSWORD`)
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
