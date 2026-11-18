import { expect, test } from '@playwright/test'

import { insertPractice, setTimeZoneOf } from './database'
import { logIn, people } from './helpers'

const meta = (html: string, property: string) =>
  html.match(new RegExp(`<meta (?:property|name)="${property}" content="([^"]*)"`))?.[1]?.replaceAll('&amp;', '&') ?? null

test.describe('Link previews', () => {
  test('a public practice shows when, where and the spots, in the zone of the host, with a picture', async ({ request, page }) => {
    await setTimeZoneOf(people.kenji, 'Asia/Tokyo')
    const startsAt = new Date(`${new Date(Date.now() + 6 * 86_400_000).toISOString().slice(0, 10)}T10:00:00Z`)
    const id = await insertPractice({
      title: 'Preview test: haiku circle',
      startsAt,
      durationMin: 60,
      organizerEmail: people.kenji,
      participantEmails: [people.amara],
      minParticipants: 4,
      maxParticipants: 8,
      isPublic: true,
    })

    const html = await (await request.get(`/share/${id}`)).text()
    expect(meta(html, 'og:title')).toBe('Preview test: haiku circle')
    const description = meta(html, 'og:description') ?? ''
    // 10:00 UTC is 19:00 in Tokyo.
    expect(description).toContain('19:00 to 20:00 (GMT+9), 1 h')
    expect(description).toContain('Online, hosted by Kenji Mori')
    expect(description).toContain('2 of 8 spots taken, 2 more needed to confirm it.')
    expect(meta(html, 'twitter:card')).toBe('summary_large_image')

    const imageUrl = meta(html, 'og:image') ?? ''
    expect(imageUrl).toContain(`/share/${id}/opengraph-image`)
    const image = await request.get(new URL(imageUrl).pathname + new URL(imageUrl).search)
    expect(image.status()).toBe(200)
    expect(image.headers()['content-type']).toBe('image/png')

    await page.goto(new URL(imageUrl).pathname + new URL(imageUrl).search)
    await page.screenshot({ path: 'test-results/preview-practice.png' })
  })

  test('a private practice gives no details in its preview', async ({ request }) => {
    const id = await insertPractice({
      title: 'Preview test: secret',
      startsAt: new Date(Date.now() + 6 * 86_400_000),
      durationMin: 60,
      organizerEmail: people.kenji,
    })
    const html = await (await request.get(`/share/${id}`)).text()
    expect(html).not.toContain('Preview test: secret')
  })

  test('a poll says who asks, how many choices it has and that anyone can answer, with a picture', async ({ page, request }) => {
    const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)
    await logIn(page, people.tom)
    await page.goto('/polls/new')
    await page.getByLabel('Title').fill('Preview test: open mic')
    await page.getByRole('radio', { name: /^Days/ }).check()
    await page.getByLabel('Day 1', { exact: true }).fill(day(5))
    await page.getByLabel('Day 2', { exact: true }).fill(day(6))
    await page.getByRole('button', { name: 'Create poll' }).click()
    await page.waitForURL(/\/polls\/(?!new$)[^/]+$/)
    const pollPath = new URL(page.url()).pathname

    const html = await (await request.get(pollPath)).text()
    expect(meta(html, 'og:title')).toBe('When: Preview test: open mic')
    expect(meta(html, 'og:description')).toContain('Tom Becker asks which days work for you. 2 days to choose from, from')
    const imageUrl = new URL(meta(html, 'og:image') ?? '')
    const image = await request.get(imageUrl.pathname + imageUrl.search)
    expect(image.status()).toBe(200)
    expect(image.headers()['content-type']).toBe('image/png')
  })
})
