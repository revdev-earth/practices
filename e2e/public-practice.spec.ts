import { expect, test } from '@playwright/test'

import { insertPractice } from './database'
import { logIn, people } from './helpers'

const FAKE_MEDIA = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
test.use({ launchOptions: { args: FAKE_MEDIA } })

const liveKitConfigured = Boolean(process.env.NEXT_PUBLIC_LIVEKIT_URL && process.env.LIVEKIT_API_KEY)

test.describe('Public practices', () => {
  test('a private practice gives nothing away at its shared address', async ({ page }) => {
    const id = await insertPractice({
      title: 'Private: book club',
      startsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      durationMin: 60,
      organizerEmail: people.dana,
    })
    const response = await page.goto(`/share/${id}`)
    expect(response?.status()).toBe(404)
    await expect(page.getByText('Private: book club')).toHaveCount(0)
  })

  test('a public practice shows to anyone without the names on its sheet, and members go to the full page', async ({ page }) => {
    const id = await insertPractice({
      title: 'Public: street photography walk',
      startsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      durationMin: 120,
      organizerEmail: people.tom,
      participantEmails: [people.priya, people.noah],
      isPublic: true,
    })

    await page.goto(`/share/${id}`)
    await expect(page.getByRole('heading', { name: 'Public: street photography walk' })).toBeVisible()
    await expect(page.getByText('Tom Becker')).toBeVisible()
    await expect(page.getByText('3 of 6 taken')).toBeVisible()
    await expect(page.getByText('Priya Nair')).toHaveCount(0)

    await logIn(page, people.kenji)
    await page.goto(`/share/${id}`)
    await page.waitForURL(new RegExp(`/practices/${id}$`))
  })

  test('a guest enters the room of a public practice with a name', async ({ browser }) => {
    test.skip(!liveKitConfigured, 'LiveKit is not configured')
    test.setTimeout(120_000)

    const id = await insertPractice({
      title: 'Public: open mic rehearsal',
      startsAt: new Date(Date.now() - 60_000),
      durationMin: 60,
      organizerEmail: people.amara,
      isPublic: true,
      videoRoom: true,
    })

    const context = await browser.newContext({ permissions: ['camera', 'microphone'] })
    const guest = await context.newPage()
    await guest.goto(`/share/${id}`)
    await guest.getByLabel('Your name').fill('Visiting Guest')
    await guest.getByRole('button', { name: 'Enter the room' }).click()
    await expect(guest.locator('.lk-control-bar')).toBeVisible({ timeout: 30_000 })
    await expect(guest.locator('.lk-participant-tile').filter({ hasText: 'Visiting Guest' })).toBeVisible({ timeout: 30_000 })
    await context.close()
  })
})
