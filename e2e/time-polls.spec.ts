import { expect, test } from '@playwright/test'

import { expectEmail, logIn, people, sentEmails } from './helpers'

// Tokyo has no daylight saving time, so wall clock times there are always UTC+9.
test.use({ timezoneId: 'Asia/Tokyo' })

const tokyoDay = (daysAhead: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000))

const TITLE = 'Poll test: debate club'

const answerTime = async (page: import('@playwright/test').Page, timeIndex: number, answer: 'Yes' | 'If needed' | 'No') => {
  const row = page.locator('form li').nth(timeIndex)
  await row.getByText(answer, { exact: true }).click()
}

test.describe('Time polls', () => {
  test('the host proposes times, people answer with and without an account, and the practice is posted at the best one', async ({ browser }) => {
    const host = await (await browser.newContext({ timezoneId: 'Asia/Tokyo' })).newPage()
    await logIn(host, people.dana)
    await host.goto('/polls')
    await host.getByRole('link', { name: 'New poll' }).click()

    await host.getByLabel('Title').fill(TITLE)
    await host.getByLabel('Description').fill('One motion, two teams, short rebuttals.')
    await host.getByLabel('Duration').selectOption('90')
    await host.getByLabel('Time 1', { exact: true }).fill(`${tokyoDay(3)}T19:00`)
    await host.getByLabel('Time 2', { exact: true }).fill(`${tokyoDay(4)}T19:00`)
    await host.getByRole('button', { name: 'Add a time' }).click()
    await host.getByLabel('Time 3', { exact: true }).fill(`${tokyoDay(5)}T10:30`)
    await host.getByRole('button', { name: 'Create poll' }).click()
    await host.waitForURL(/\/polls\/(?!new$)[^/]+$/)
    const pollUrl = new URL(host.url()).pathname
    await expect(host.getByRole('heading', { name: TITLE })).toBeVisible()
    await expect(host.getByText('19:00 to 20:30 (GMT+9)').first()).toBeVisible()

    // Someone with no account answers with a name, and the browser keeps their answers theirs.
    const guestContext = await browser.newContext({ timezoneId: 'Asia/Tokyo' })
    const guest = await guestContext.newPage()
    await guest.goto(pollUrl)
    await guest.getByLabel('Your name').fill('Visiting Guest')
    await answerTime(guest, 0, 'Yes')
    await answerTime(guest, 1, 'If needed')
    await guest.getByRole('button', { name: 'Save my answers' }).click()
    await expect(guest.getByText('Your answers are saved. You can change them from this browser.')).toBeVisible()
    await guest.reload()
    await expect(guest.getByLabel('Your name')).toHaveValue('Visiting Guest')
    await expect(guest.getByRole('row', { name: /Visiting Guest/ })).toBeVisible()
    await expect(guest.getByRole('button', { name: 'Update my answers' })).toBeVisible()

    // Three people with an account answer.
    for (const [email, answer] of [
      [people.kenji, 'Yes'],
      [people.amara, 'Yes'],
      [people.lucia, 'If needed'],
    ] as const) {
      const page = await (await browser.newContext({ timezoneId: 'Asia/Tokyo' })).newPage()
      await logIn(page, email)
      await page.goto(pollUrl)
      await answerTime(page, 1, answer)
      await page.getByRole('button', { name: 'Save my answers' }).click()
      await expect(page.getByText('Your answers are saved.')).toBeVisible()
    }

    // The second time works best: two yes and two if needed.
    await host.reload()
    const secondTime = host.locator('section[aria-labelledby="poll-times-heading"] li').nth(1)
    await expect(secondTime.getByText('2 yes, 2 if needed')).toBeVisible()
    await expect(secondTime.getByText('Works best')).toBeVisible()
    await expect(host.getByRole('heading', { name: '4 people answered' })).toBeVisible()

    // The host posts the practice at that time, with the details of the poll already filled in.
    await secondTime.getByRole('link', { name: 'Post at this time' }).click()
    await expect(host.getByLabel('Title')).toHaveValue(TITLE)
    await expect(host.getByLabel('Starts')).toHaveValue(`${tokyoDay(4)}T19:00`)
    await expect(host.getByLabel('Duration')).toHaveValue('90')
    await host.getByLabel('Minimum to confirm').fill('2')
    await host.getByRole('button', { name: 'Post practice' }).click()
    await host.waitForURL(/\/practices\/[^/]+$/)

    // Whoever said yes with an account is on the sheet, in the order they answered.
    const sheet = host.locator('aside, section').filter({ hasText: 'Sign-up sheet' }).first()
    await expect(sheet.getByText('Dana Reyes')).toBeVisible()
    await expect(sheet.getByText('Kenji Mori')).toBeVisible()
    await expect(sheet.getByText('Amara Obi')).toBeVisible()
    await expect(sheet.getByText('Lucía Fernández')).toHaveCount(0)

    await expectEmail(people.kenji, new RegExp(`^${TITLE} is set for a time you said yes to$`))
    await expectEmail(people.amara, new RegExp(`^${TITLE} is set for a time you said yes to$`))
    await expectEmail(people.lucia, new RegExp(`^${TITLE} is set for a time you could make$`))
    expect(sentEmails().filter((email) => email.to === people.dana && email.subject.startsWith(TITLE))).toHaveLength(0)

    // The poll closes and points to the practice.
    await guest.goto(pollUrl)
    await expect(guest.getByText(/^The host chose/)).toBeVisible()
    await expect(guest.getByRole('button', { name: 'Update my answers' })).toHaveCount(0)
  })

  test('a poll needs two different times in the future', async ({ page }) => {
    await logIn(page, people.kenji)
    await page.goto('/polls/new')
    await page.getByLabel('Title').fill('Poll test: not enough times')
    await page.getByLabel('Time 1', { exact: true }).fill(`${tokyoDay(2)}T19:00`)
    await page.getByLabel('Time 2', { exact: true }).fill(`${tokyoDay(2)}T19:00`)
    await page.getByRole('button', { name: 'Create poll' }).click()
    await expect(page.getByText('Each time can only be proposed once')).toBeVisible()

    await page.getByLabel('Time 2', { exact: true }).fill(`${tokyoDay(-2)}T19:00`)
    await page.getByRole('button', { name: 'Create poll' }).click()
    await expect(page.getByText('Every time has to be in the future')).toBeVisible()
  })

  test('only the host sees the button to post and the poll page opens without an account', async ({ page }) => {
    await logIn(page, people.tom)
    await page.goto('/polls/new')
    await page.getByLabel('Title').fill('Poll test: host only')
    await page.getByLabel('Time 1', { exact: true }).fill(`${tokyoDay(6)}T08:00`)
    await page.getByLabel('Time 2', { exact: true }).fill(`${tokyoDay(6)}T20:00`)
    await page.getByRole('button', { name: 'Create poll' }).click()
    await page.waitForURL(/\/polls\/(?!new$)[^/]+$/)
    await expect(page.getByRole('link', { name: 'Post at this time' })).toHaveCount(2)
    const pollUrl = new URL(page.url()).pathname

    await page.getByRole('button', { name: 'Log out' }).click()
    await page.waitForURL((url) => url.pathname === '/')
    await page.goto(pollUrl)
    await expect(page.getByRole('heading', { name: 'Poll test: host only' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Post at this time' })).toHaveCount(0)
    await expect(page.getByLabel('Your name')).toBeVisible()

    await page.goto('/polls')
    await expect(page).toHaveURL(/\?auth=login/)
  })
})
