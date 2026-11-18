import { expect, test } from '@playwright/test'

import { insertPractice } from './database'
import { logIn, people } from './helpers'

// Tokyo has no daylight saving time, so a wall clock time there is always UTC+9.
test.use({ timezoneId: 'Asia/Tokyo' })

const tokyoDay = (daysAhead: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000))

test.describe('Practices', () => {
  test('posting a practice puts the poster on the sheet and the practice on its day', async ({ page }) => {
    const day = tokyoDay(9)
    await logIn(page, people.kenji)
    await page.goto(`/practices/new?day=${day}`)

    await page.getByLabel('Title').fill('Watercolor basics')
    await page.getByLabel('Description').fill('Washes, gradients and one small landscape.')
    await page.getByLabel('Starts').fill(`${day}T18:30`)
    await page.getByLabel('Duration').selectOption('90')
    await page.getByRole('radio', { name: 'In person' }).check()
    await page.getByLabel('Place').fill('Art room, 3 Hill Road')
    await page.getByLabel('Minimum to confirm').fill('3')
    await page.getByLabel('Maximum group size').fill('5')
    await page.getByRole('button', { name: 'Post practice' }).click()

    await page.waitForURL(/\/practices\/[^/]+$/)
    await expect(page.getByRole('heading', { name: 'Watercolor basics' })).toBeVisible()
    await expect(page.getByText('18:30 to 20:00 (GMT+9), 1 h 30 min')).toBeVisible()
    await expect(page.getByText('Art room, 3 Hill Road')).toBeVisible()
    await expect(page.getByText('Needs 2 more').first()).toBeVisible()
    await expect(page.getByText('You have a spot.')).toBeVisible()

    await page.getByRole('link', { name: 'Back to the calendar' }).click()
    await expect(page).toHaveURL(new RegExp(`day=${day}`))
    await expect(page.locator('section').getByRole('link', { name: /Watercolor basics/ })).toBeVisible()
  })

  test('a past time and a maximum under the minimum are refused', async ({ page }) => {
    await logIn(page, people.kenji)
    await page.goto('/practices/new')
    await page.getByLabel('Title').fill('Too late')
    await page.getByLabel('Starts').fill(`${tokyoDay(-1)}T10:00`)
    await page.getByLabel('Minimum to confirm').fill('5')
    await page.getByLabel('Maximum group size').fill('3')
    await page.getByRole('button', { name: 'Post practice' }).click()
    await expect(page.getByText('The maximum has to be at least the minimum')).toBeVisible()

    await page.getByLabel('Maximum group size').fill('6')
    await page.getByRole('button', { name: 'Post practice' }).click()
    await expect(page.getByText('That time has already passed')).toBeVisible()
  })

  test('the waitlist moves up on its own when someone leaves', async ({ browser }) => {
    const id = await insertPractice({
      title: 'Pairs only: tango steps',
      startsAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
      durationMin: 60,
      organizerEmail: people.lucia,
      participantEmails: [people.tom],
      minParticipants: 2,
      maxParticipants: 2,
    })

    const amara = await (await browser.newContext({ timezoneId: 'Asia/Tokyo' })).newPage()
    await logIn(amara, people.amara)
    await amara.goto(`/practices/${id}`)
    await expect(amara.getByText('Every spot is taken. Joining puts you on the waitlist.')).toBeVisible()
    await amara.getByRole('button', { name: 'Join the waitlist' }).click()
    await expect(amara.getByText('You are on the waitlist.', { exact: false })).toBeVisible()

    const tom = await (await browser.newContext({ timezoneId: 'Asia/Tokyo' })).newPage()
    await logIn(tom, people.tom)
    await tom.goto(`/practices/${id}`)
    await tom.getByRole('button', { name: 'Leave', exact: true }).click()
    await expect(tom.getByRole('button', { name: 'Join the waitlist' })).toBeVisible()

    await amara.reload()
    await expect(amara.getByText('You have a spot.')).toBeVisible()
  })

  test('only the host edits and deletes, and a deleted practice answers 404', async ({ browser }) => {
    const id = await insertPractice({
      title: 'Host only: knots and splices',
      startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      durationMin: 60,
      organizerEmail: people.priya,
      participantEmails: [people.noah],
    })

    const noah = await (await browser.newContext({ timezoneId: 'Asia/Tokyo' })).newPage()
    await logIn(noah, people.noah)
    await noah.goto(`/practices/${id}`)
    await expect(noah.getByRole('heading', { name: 'Host only: knots and splices' })).toBeVisible()
    await expect(noah.getByRole('button', { name: 'Edit practice' })).toHaveCount(0)
    await expect(noah.getByRole('button', { name: 'Delete practice' })).toHaveCount(0)

    const priya = await (await browser.newContext({ timezoneId: 'Asia/Tokyo' })).newPage()
    await logIn(priya, people.priya)
    await priya.goto(`/practices/${id}`)
    await priya.getByRole('button', { name: 'Edit practice' }).click()
    await priya.getByLabel('Title').fill('Host only: knots, splices and hitches')
    await priya.getByRole('button', { name: 'Save changes' }).click()
    await expect(priya.getByRole('heading', { name: 'Host only: knots, splices and hitches' })).toBeVisible()

    await priya.getByRole('button', { name: 'Delete practice' }).click()
    await priya.getByRole('button', { name: 'Delete practice' }).last().click()
    await priya.waitForURL(/\/calendar/)

    await noah.reload()
    await expect(noah.getByRole('heading', { name: 'This page does not exist' })).toBeVisible()
  })

  test('the month shows each practice on its day and selecting a day lists them', async ({ page }) => {
    const day = tokyoDay(11)
    await insertPractice({
      title: 'Month test: chess endgames',
      startsAt: new Date(`${day}T09:15:00+09:00`),
      durationMin: 60,
      organizerEmail: people.sofia,
    })

    await logIn(page, people.kenji)
    await page.goto(`/calendar?month=${day.slice(0, 7)}`)
    await expect(page.getByRole('link', { name: /09:15\s*Month test: chess endgames/ })).toBeVisible()

    await page
      .getByRole('link', { name: new RegExp(`, 1 practice$`) })
      .filter({ hasText: String(Number(day.slice(8))) })
      .first()
      .click()
    await expect(page).toHaveURL(new RegExp(`day=${day}`))
    await expect(page.locator('#selected-day-heading')).toBeVisible()
    await expect(page.locator('section').getByRole('link', { name: /Month test: chess endgames/ })).toBeVisible()
  })
})
