import { expect, test } from '@playwright/test'

import { insertPractice } from './database'
import { expectEmail, logIn, people } from './helpers'

test.use({ timezoneId: 'Asia/Tokyo' })

const tokyoDay = (daysAhead: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000))

const TITLE = 'Day poll test: board games'

test.describe('Day polls', () => {
  test('the group chooses a day and the host picks the hour when posting', async ({ browser }) => {
    const host = await (await browser.newContext({ timezoneId: 'Asia/Tokyo' })).newPage()
    await logIn(host, people.priya)

    // From the form of a new practice there is a way to ask the group first.
    await host.goto('/practices/new')
    await host.getByRole('link', { name: /Not sure when\?/ }).click()
    await host.waitForURL(/\/polls\/new$/)

    await host.getByLabel('Title').fill(TITLE)
    await host.getByRole('radio', { name: /^Days/ }).check()
    await host.getByLabel('Day 1', { exact: true }).fill(tokyoDay(7))
    await host.getByLabel('Day 2', { exact: true }).fill(tokyoDay(8))
    await host.getByRole('button', { name: 'Create poll' }).click()
    await host.waitForURL(/\/polls\/(?!new$)[^/]+$/)
    const pollUrl = new URL(host.url()).pathname
    await expect(host.getByRole('heading', { name: 'The days' })).toBeVisible()
    await expect(host.getByText('The host picks the hour once the day is chosen.')).toBeVisible()

    const voter = await (await browser.newContext({ timezoneId: 'Asia/Tokyo' })).newPage()
    await logIn(voter, people.noah)
    await voter.goto(pollUrl)
    await expect(voter.getByRole('heading', { name: 'Which days work for you?' })).toBeVisible()
    await voter.locator('form li').nth(1).getByText('Yes', { exact: true }).click()
    await voter.getByRole('button', { name: 'Save my answers' }).click()
    await expect(voter.getByText('Your answers are saved.')).toBeVisible()

    await host.reload()
    const secondDay = host.locator('section[aria-labelledby="poll-times-heading"] li').nth(1)
    await expect(secondDay.getByText('Works best')).toBeVisible()
    await secondDay.getByRole('link', { name: 'Post on this day' }).click()
    await expect(host.getByText('The group chose the day. Pick the hour.', { exact: false })).toBeVisible()
    await expect(host.getByLabel('Starts')).toHaveValue(`${tokyoDay(8)}T19:00`)
    await host.getByLabel('Starts').fill(`${tokyoDay(8)}T17:30`)
    await host.getByLabel('Minimum to confirm').fill('2')
    await host.getByRole('button', { name: 'Post practice' }).click()
    await host.waitForURL(/\/practices\/(?!new$)[^/]+$/)
    await expect(host.getByText('17:30 to 18:30 (GMT+9)', { exact: false })).toBeVisible()
    await expect(host.locator('aside, section').filter({ hasText: 'Sign-up sheet' }).first().getByText('Noah Kim')).toBeVisible()

    await expectEmail(people.noah, new RegExp(`^${TITLE} is set for a day you said yes to$`))
  })
})

test.describe('Sharing', () => {
  test('the share button copies the link of the practice, and says who can open it', async ({ browser }) => {
    const id = await insertPractice({
      title: 'Share test: public',
      startsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      durationMin: 60,
      organizerEmail: people.sofia,
      isPublic: true,
    })
    const context = await browser.newContext({ timezoneId: 'Asia/Tokyo', permissions: ['clipboard-read', 'clipboard-write'] })
    const page = await context.newPage()
    await logIn(page, people.sofia)
    await page.goto(`/practices/${id}`)
    await expect(page.getByText('The link opens for anyone, with no account.')).toBeVisible()
    await page.getByRole('button', { name: 'Share' }).click()
    await expect(page.getByRole('button', { name: 'Link copied' })).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`http://localhost:3500/share/${id}`)

    const privateId = await insertPractice({
      title: 'Share test: private',
      startsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      durationMin: 60,
      organizerEmail: people.sofia,
    })
    await page.goto(`/practices/${privateId}`)
    await expect(page.getByText('The practice is private, so the link asks for an account.', { exact: false })).toBeVisible()
    await page.getByRole('button', { name: 'Share' }).click()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`http://localhost:3500/practices/${privateId}`)
  })

  test('people without an account can pass on a public practice', async ({ browser }) => {
    const id = await insertPractice({
      title: 'Share test: from a guest',
      startsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      durationMin: 60,
      organizerEmail: people.tom,
      isPublic: true,
    })
    const context = await browser.newContext({ timezoneId: 'Asia/Tokyo', permissions: ['clipboard-read', 'clipboard-write'] })
    const page = await context.newPage()
    await page.goto(`/share/${id}`)
    await page.getByRole('button', { name: 'Share with someone' }).click()
    await expect(page.getByRole('button', { name: 'Link copied' })).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`http://localhost:3500/share/${id}`)
  })
})
