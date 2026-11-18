import { expect, test, type Browser } from '@playwright/test'

import { insertPractice } from './database'
import { logIn, people } from './helpers'

test.skip(!process.env.NEXT_PUBLIC_LIVEKIT_URL || !process.env.LIVEKIT_API_KEY, 'LiveKit is not configured')

test.use({ launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] } })

const enterRoom = async (browser: Browser, email: string, practiceId: string) => {
  const context = await browser.newContext({ permissions: ['camera', 'microphone'] })
  const page = await context.newPage()
  await logIn(page, email)
  await page.goto(`/practices/${practiceId}/room`)
  return page
}

test.describe('The call after the time is up', () => {
  test.describe.configure({ retries: 1 })

  test('the call goes on past the end, late people can still enter, and only the host ends it', async ({ browser }) => {
    test.setTimeout(240_000)
    // It ends 40 seconds after the test starts.
    const endsAt = Date.now() + 40_000
    const practiceId = await insertPractice({
      title: 'Call past the end',
      startsAt: new Date(endsAt - 30 * 60_000),
      durationMin: 30,
      organizerEmail: people.dana,
      participantEmails: [people.kenji, people.amara],
      videoRoom: true,
    })

    const host = await enterRoom(browser, people.dana, practiceId)
    const kenji = await enterRoom(browser, people.kenji, practiceId)
    await expect(kenji.locator('.lk-participant-tile')).toHaveCount(2, { timeout: 60_000 })

    // Only the host can end the call.
    await expect(kenji.getByRole('button', { name: 'End call' })).toHaveCount(0)

    await expect.poll(() => Date.now() > endsAt + 5_000, { timeout: 90_000, intervals: [2_000] }).toBe(true)

    // Past the end, the call is still there and someone arriving late gets in.
    await expect(kenji.locator('.lk-participant-tile')).toHaveCount(2)
    const amara = await enterRoom(browser, people.amara, practiceId)
    await expect(amara.locator('.lk-participant-tile')).toHaveCount(3, { timeout: 60_000 })

    const outsider = await (await browser.newContext()).newPage()
    await logIn(outsider, people.amara)
    await outsider.goto(`/practices/${practiceId}`)
    await expect(outsider.getByText('The time is up and the call is still going.')).toBeVisible()

    // The host ends it for everyone.
    await host.getByRole('button', { name: 'End call' }).click()
    await host.getByRole('button', { name: 'End for everyone' }).click()
    await kenji.waitForURL(new RegExp(`/practices/${practiceId}$`), { timeout: 30_000 })
    await expect(kenji.getByText('The host ended the call.')).toBeVisible()

    await amara.goto(`/practices/${practiceId}/room`)
    await expect(amara.getByRole('heading', { name: 'The call ended' })).toBeVisible()
  })

  test('a practice whose time is up and whose call is empty has its room closed', async ({ page }) => {
    const practiceId = await insertPractice({
      title: 'Ended with nobody in the call',
      startsAt: new Date(Date.now() - 3 * 60 * 60_000),
      durationMin: 60,
      organizerEmail: people.priya,
      videoRoom: true,
    })
    await logIn(page, people.priya)
    await page.goto(`/practices/${practiceId}/room`)
    await expect(page.getByRole('heading', { name: 'This practice ended' })).toBeVisible()
  })
})
