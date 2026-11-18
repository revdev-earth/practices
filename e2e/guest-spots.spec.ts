import { expect, test, type Browser } from '@playwright/test'

import { insertPractice, practiceIdByTitle } from './database'
import { expectEmail, logIn, people } from './helpers'

test.use({ timezoneId: 'Asia/Tokyo', launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] } })

const liveKitConfigured = Boolean(process.env.NEXT_PUBLIC_LIVEKIT_URL && process.env.LIVEKIT_API_KEY)

const tokyoDay = (daysAhead: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000))

// A browser with no account, with its own cookies.
const guestBrowser = async (browser: Browser) =>
  (await browser.newContext({ timezoneId: 'Asia/Tokyo', permissions: ['camera', 'microphone'] })).newPage()

test.describe('Spots without an account', () => {
  test('a guest takes a spot with a name, counts on the sheet as not registered, and the waitlist moves up', async ({ browser }) => {
    const title = 'Guest spots: salsa basics'
    const id = await insertPractice({
      title,
      startsAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      durationMin: 60,
      organizerEmail: people.dana,
      participantEmails: [people.kenji],
      minParticipants: 3,
      maxParticipants: 3,
      isPublic: true,
    })

    const wendy = await guestBrowser(browser)
    await wendy.goto(`/share/${id}`)
    await wendy.getByLabel('Your name').fill('Walk-in Wendy')
    await wendy.getByRole('button', { name: 'Take a spot' }).click()
    await expect(wendy.getByText('You have a spot as Walk-in Wendy, not registered.')).toBeVisible()
    // Her own name is written in full and marked as hers. The others are shortened.
    const publicSheet = wendy.locator('section[aria-labelledby="roster-heading"]')
    await expect(publicSheet.getByRole('listitem').filter({ hasText: 'Walk-in Wendy' }).getByText('you')).toBeVisible()
    await expect(publicSheet.getByText('Kenji M.')).toBeVisible()

    // The third spot confirms the practice, so the people with an account hear about it.
    await expectEmail(people.dana, new RegExp(`^${title} is confirmed$`))
    await expectEmail(people.kenji, new RegExp(`^${title} is confirmed$`))

    const host = await (await browser.newContext({ timezoneId: 'Asia/Tokyo' })).newPage()
    await logIn(host, people.dana)
    await host.goto(`/practices/${id}`)
    const sheet = host.locator('section[aria-labelledby="roster-heading"]')
    await expect(sheet.getByRole('listitem').filter({ hasText: 'Walk-in Wendy' }).getByText('not registered')).toBeVisible()
    await expect(sheet.getByText('3 of 3')).toBeVisible()

    // The sheet is full: the next guest waits.
    const victor = await guestBrowser(browser)
    await victor.goto(`/share/${id}`)
    await victor.getByLabel('Your name').fill('Visiting Victor')
    await victor.getByRole('button', { name: 'Join the waitlist' }).click()
    await expect(victor.getByText('You are on the waitlist as Visiting Victor, not registered.', { exact: false })).toBeVisible()

    // Wendy gives her spot back and Victor moves up.
    await wendy.getByRole('button', { name: 'Give the spot back' }).click()
    // Victor took the free spot, so the sheet is full again for her.
    await expect(wendy.getByRole('button', { name: 'Join the waitlist' })).toBeVisible()
    await victor.reload()
    await expect(victor.getByText('You have a spot as Visiting Victor, not registered.')).toBeVisible()

    // The host takes Victor off the sheet.
    await host.reload()
    await sheet.getByRole('button', { name: 'Take Visiting Victor off the sheet' }).click()
    await sheet.getByRole('button', { name: 'Remove' }).click()
    await expect(sheet.getByText('Visiting Victor')).toHaveCount(0)
    await victor.reload()
    await expect(victor.getByRole('button', { name: 'Take a spot' })).toBeVisible()
  })

  test('a yes in a poll without an account becomes a spot when the practice is public', async ({ browser }) => {
    const title = 'Guest spots: from a poll'
    const host = await (await browser.newContext({ timezoneId: 'Asia/Tokyo' })).newPage()
    await logIn(host, people.lucia)
    await host.goto('/polls/new')
    await host.getByLabel('Title').fill(title)
    await host.getByLabel('Time 1', { exact: true }).fill(`${tokyoDay(9)}T19:00`)
    await host.getByLabel('Time 2', { exact: true }).fill(`${tokyoDay(10)}T19:00`)
    await host.getByRole('button', { name: 'Create poll' }).click()
    await host.waitForURL(/\/polls\/(?!new$)[^/]+$/)
    const pollUrl = new URL(host.url()).pathname

    const guest = await guestBrowser(browser)
    await guest.goto(pollUrl)
    await guest.getByLabel('Your name').fill('Poll Paula')
    await guest.locator('form li').nth(0).getByText('Yes', { exact: true }).click()
    await guest.getByRole('button', { name: 'Save my answers' }).click()
    await expect(guest.getByText('Your answers are saved.', { exact: false })).toBeVisible()

    await host.reload()
    await host.locator('section[aria-labelledby="poll-times-heading"] li').nth(0).getByRole('link', { name: 'Post at this time' }).click()
    await host.getByLabel('Minimum to confirm').fill('2')
    await host.getByRole('radio', { name: 'Public' }).check()
    await host.getByRole('button', { name: 'Post practice' }).click()
    await host.waitForURL(/\/practices\/(?!new$)[^/]+$/)
    await expect(host.locator('section[aria-labelledby="roster-heading"]').getByText('Poll Paula')).toBeVisible()

    const id = await practiceIdByTitle(title)
    await guest.goto(`/share/${id}`)
    await expect(guest.getByText('You have a spot as Poll Paula, not registered.')).toBeVisible()
  })

  test('a guest with a spot enters the room with their name, in a place of the sheet', async ({ browser }) => {
    test.skip(!liveKitConfigured, 'LiveKit is not configured')
    test.setTimeout(120_000)
    const id = await insertPractice({
      title: 'Guest spots: in the room',
      startsAt: new Date(Date.now() - 60_000),
      durationMin: 60,
      organizerEmail: people.amara,
      isPublic: true,
      videoRoom: true,
    })

    const guest = await guestBrowser(browser)
    await guest.goto(`/share/${id}`)
    await guest.getByLabel('Your name').fill('Roomy Rita')
    await guest.getByRole('button', { name: 'Take a spot' }).click()
    await guest.getByRole('button', { name: 'Enter the room as Roomy Rita' }).click()
    await expect(guest.locator('.lk-participant-tile').filter({ hasText: 'Roomy Rita' })).toBeVisible({ timeout: 30_000 })
  })
})
