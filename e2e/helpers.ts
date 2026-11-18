import { readFileSync } from 'node:fs'

import { expect, type Page } from '@playwright/test'

import { E2E_PASSWORD, EMAIL_OUTBOX } from './environment'

// Demo people from prisma/seed.ts.
export const people = {
  dana: 'dana@practices.test',
  kenji: 'kenji@practices.test',
  amara: 'amara@practices.test',
  lucia: 'lucia@practices.test',
  tom: 'tom@practices.test',
  priya: 'priya@practices.test',
  sofia: 'sofia@practices.test',
  noah: 'noah@practices.test',
} as const

// Opens the login step of the account window and lands on the calendar.
export const logIn = async (page: Page, email: string, password = E2E_PASSWORD) => {
  await page.goto('/?auth=login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await page.waitForURL(/\/calendar/)
}

export type SentEmail = { kind: string; to: string; subject: string; html: string; sentAt: string }

export const sentEmails = (): SentEmail[] =>
  readFileSync(EMAIL_OUTBOX, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as SentEmail)

// The emails one person got with a subject that matches, waiting a moment because the server sends them after answering.
export const expectEmail = async (to: string, subject: RegExp) => {
  await expect
    .poll(() => sentEmails().filter((email) => email.to === to && subject.test(email.subject)).length, { timeout: 10_000 })
    .toBeGreaterThan(0)
  return sentEmails().filter((email) => email.to === to && subject.test(email.subject))
}
