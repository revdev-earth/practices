import { expect, test, type Browser, type Page } from '@playwright/test'

import { insertPractice } from './database'
import { logIn, people } from './helpers'

// The calls run on the LiveKit project in .env. Without it there is no room to test.
test.skip(!process.env.NEXT_PUBLIC_LIVEKIT_URL || !process.env.LIVEKIT_API_KEY, 'LiveKit is not configured')

const FAKE_MEDIA = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']

const enterRoom = async (browser: Browser, email: string, practiceId: string) => {
  const context = await browser.newContext({ permissions: ['camera', 'microphone'] })
  const page = await context.newPage()
  await logIn(page, email)
  await page.goto(`/practices/${practiceId}/room`)
  await expect(page.locator('.lk-control-bar')).toBeVisible({ timeout: 30_000 })
  return page
}

const tiles = (page: Page) => page.locator('.lk-participant-tile')

// Every browser of this file has a camera and a microphone that play a test pattern and a tone.
test.use({ launchOptions: { args: FAKE_MEDIA } })

test.describe('Room layout', () => {
  // The calls go through LiveKit Cloud over the network. One slow connection gets a second chance.
  test.describe.configure({ retries: 1 })
  test.setTimeout(180_000)

  test('each person chooses grid or speaker, how many people per screen, and can pin someone', async ({ browser }) => {
    const practiceId = await insertPractice({
      title: 'Room layout test',
      startsAt: new Date(Date.now() - 60_000),
      durationMin: 60,
      organizerEmail: people.dana,
      participantEmails: [people.kenji, people.amara, people.lucia, people.tom],
      videoRoom: true,
    })

    const host = await enterRoom(browser, people.dana, practiceId)
    for (const email of [people.kenji, people.amara, people.lucia, people.tom]) await enterRoom(browser, email, practiceId)

    // Grid, as many as fit: the five people at once.
    await expect(host.locator('[data-call-layout="grid"]')).toBeVisible()
    await expect(tiles(host)).toHaveCount(5, { timeout: 60_000 })

    // Four per screen: two pages.
    await host.getByLabel('People per screen').selectOption('4')
    await expect(host.locator('.practice-grid-tiles .lk-participant-tile')).toHaveCount(4)
    await expect(host.getByText('Page 1 of 2')).toBeVisible()
    await host.getByRole('button', { name: 'Next people' }).click()
    await expect(host.locator('.practice-grid-tiles .lk-participant-tile')).toHaveCount(1)
    await expect(host.getByText('Page 2 of 2')).toBeVisible()

    // Speaker: one person fills the screen and the rest wait in the strip.
    await host.getByRole('button', { name: 'Speaker', exact: true }).click()
    await expect(host.locator('[data-call-layout="speaker"] .lk-focus-layout')).toBeVisible()
    await expect(host.locator('.lk-carousel .lk-participant-tile')).toHaveCount(4)

    // The choice stays after a reload, in this browser only.
    await host.reload()
    await expect(host.locator('[data-call-layout="speaker"]')).toBeVisible({ timeout: 30_000 })

    // Pinning someone from their tile fills the screen with them until they are unpinned.
    await host.getByRole('button', { name: 'Grid', exact: true }).click()
    await host.getByLabel('People per screen').selectOption('auto')
    await expect(tiles(host)).toHaveCount(5, { timeout: 60_000 })
    const kenjiTile = tiles(host).filter({ hasText: 'Kenji Mori' })
    await kenjiTile.hover()
    await kenjiTile.locator('.lk-focus-toggle-button').click()
    await expect(host.locator('[data-call-layout="pinned"]')).toBeVisible()
    await expect(host.getByRole('button', { name: 'Speaker', exact: true })).toBeDisabled()
    await host.getByRole('button', { name: 'Unpin Kenji Mori' }).click()
    await expect(host.locator('[data-call-layout="grid"]')).toBeVisible()
  })
})
