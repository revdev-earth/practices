'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { getUser } from '+/lib/auth'
import { practiceSchema } from '+/lib/practiceRules'
import { prisma } from '+/lib/prisma'
import { HOME_PATH } from '+/lib/redirects'

export type PracticeFormState = {
  success: boolean
  errors?: Record<string, string[]>
}

export type PracticeActionResult = {
  success: boolean
  error?: string
}

const SESSION_ENDED = 'Your session ended. Log in again.'

const parsePracticeForm = (formData: FormData) => {
  const text = (name: string) => String(formData.get(name) ?? '')
  return practiceSchema.safeParse({
    title: text('title'),
    description: text('description'),
    startsAt: text('startsAt'),
    durationMin: text('durationMin'),
    mode: text('mode'),
    videoRoom: text('videoRoom'),
    location: text('location'),
    minParticipants: text('minParticipants'),
    maxParticipants: text('maxParticipants'),
  })
}

const endOf = (startsAt: Date, durationMin: number) => new Date(startsAt.getTime() + durationMin * 60000)

// A change shows up in the list, in the practice itself and on the calendar.
const refreshPractices = () => {
  revalidatePath('/practices', 'layout')
  revalidatePath('/calendar')
}

export const createPracticeAction = async (_prevState: PracticeFormState, formData: FormData): Promise<PracticeFormState> => {
  const user = await getUser()
  if (!user) return { success: false, errors: { form: [SESSION_ENDED] } }

  const parsed = parsePracticeForm(formData)
  if (!parsed.success) return { success: false, errors: z.flattenError(parsed.error).fieldErrors }

  const { durationMin, ...practice } = parsed.data
  if (practice.startsAt.getTime() < Date.now()) return { success: false, errors: { startsAt: ['That time has already passed'] } }

  let practiceId: string
  try {
    // Whoever posts takes the first spot on the list.
    const created = await prisma.practice.create({
      data: {
        ...practice,
        endsAt: endOf(practice.startsAt, durationMin),
        organizerId: user.id,
        signups: { create: { userId: user.id } },
      },
      select: { id: true },
    })
    practiceId = created.id
  } catch (error) {
    console.error('Posting the practice failed:', error)
    return { success: false, errors: { form: ['The practice could not be posted. Try again.'] } }
  }

  refreshPractices()
  redirect(`/practices/${practiceId}`)
}

export const updatePracticeAction = async (practiceId: string, _prevState: PracticeFormState, formData: FormData): Promise<PracticeFormState> => {
  const user = await getUser()
  if (!user) return { success: false, errors: { form: [SESSION_ENDED] } }

  const parsed = parsePracticeForm(formData)
  if (!parsed.success) return { success: false, errors: z.flattenError(parsed.error).fieldErrors }

  const current = await prisma.practice.findUnique({ where: { id: practiceId }, select: { organizerId: true, startsAt: true, endsAt: true } })
  if (!current) return { success: false, errors: { form: ['This practice no longer exists.'] } }
  if (current.organizerId !== user.id) return { success: false, errors: { form: ['Only the organizer can edit this practice.'] } }
  if (current.endsAt < new Date()) return { success: false, errors: { form: ['This practice already ended and can no longer be edited.'] } }

  const { durationMin, ...practice } = parsed.data
  // A practice that already started keeps its time. Only moving the date into the past is rejected.
  const movedStart = practice.startsAt.getTime() !== current.startsAt.getTime()
  if (movedStart && practice.startsAt.getTime() < Date.now()) return { success: false, errors: { startsAt: ['That time has already passed'] } }

  try {
    await prisma.practice.update({
      where: { id: practiceId },
      data: { ...practice, endsAt: endOf(practice.startsAt, durationMin) },
    })
  } catch (error) {
    console.error('Saving the practice failed:', error)
    return { success: false, errors: { form: ['The changes could not be saved. Try again.'] } }
  }

  refreshPractices()
  // The sheet stays where it is. The form closes itself and the page shows the saved practice.
  return { success: true }
}

export const deletePracticeAction = async (practiceId: string): Promise<PracticeActionResult> => {
  const user = await getUser()
  if (!user) return { success: false, error: SESSION_ENDED }

  const deleted = await prisma.practice.deleteMany({ where: { id: practiceId, organizerId: user.id } })
  if (deleted.count === 0) return { success: false, error: 'Only the organizer can delete this practice.' }

  refreshPractices()
  redirect(HOME_PATH)
}

const findOpenPractice = async (practiceId: string): Promise<PracticeActionResult> => {
  const practice = await prisma.practice.findUnique({ where: { id: practiceId }, select: { endsAt: true } })
  if (!practice) return { success: false, error: 'This practice no longer exists.' }
  if (practice.endsAt < new Date()) return { success: false, error: 'This practice already ended.' }
  return { success: true }
}

export const joinPracticeAction = async (practiceId: string): Promise<PracticeActionResult> => {
  const user = await getUser()
  if (!user) return { success: false, error: SESSION_ENDED }

  const open = await findOpenPractice(practiceId)
  if (!open.success) return open

  // Joining twice changes nothing: the original place on the list is kept.
  await prisma.signup.upsert({
    where: { practiceId_userId: { practiceId, userId: user.id } },
    create: { practiceId, userId: user.id },
    update: {},
  })

  refreshPractices()
  return { success: true }
}

export const leavePracticeAction = async (practiceId: string): Promise<PracticeActionResult> => {
  const user = await getUser()
  if (!user) return { success: false, error: SESSION_ENDED }

  const open = await findOpenPractice(practiceId)
  if (!open.success) return open

  await prisma.signup.deleteMany({ where: { practiceId, userId: user.id } })

  refreshPractices()
  return { success: true }
}
