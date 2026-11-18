import { expect, test } from '@playwright/test'

import { makePracticePublic, practiceIdByTitle } from './database'
import { logIn, people } from './helpers'

const TITLE = 'Mock interviews for frontend roles'

test.describe('Add to calendar', () => {
  test('a member downloads the calendar file and opens Google Calendar with the practice', async ({ page }) => {
    const id = await practiceIdByTitle(TITLE)
    await logIn(page, people.kenji)
    await page.goto(`/practices/${id}`)

    const google = page.getByRole('link', { name: 'Google Calendar' })
    const googleUrl = new URL((await google.getAttribute('href')) ?? '')
    expect(googleUrl.hostname).toBe('calendar.google.com')
    expect(googleUrl.searchParams.get('text')).toBe(TITLE)
    expect(googleUrl.searchParams.get('dates')).toMatch(/^\d{8}T\d{6}Z\/\d{8}T\d{6}Z$/)

    const download = page.waitForEvent('download')
    await page.getByRole('link', { name: 'Apple, Outlook and others (.ics)' }).click()
    const file = await download
    expect(file.suggestedFilename()).toBe('mock-interviews-for-frontend-roles.ics')

    const response = await page.request.get(`/practices/${id}/event.ics`)
    expect(response.headers()['content-type']).toContain('text/calendar')
    const ics = await response.text()
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain(`UID:${id}@practices`)
    expect(ics).toContain(`SUMMARY:${TITLE}`)
    expect(ics).toMatch(/DTSTART:\d{8}T\d{6}Z/)
    // Every line ends with CRLF and none is longer than 75 bytes.
    for (const line of ics.split('\r\n')) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75)
  })

  test('the public calendar file only exists for public practices', async ({ page, request }) => {
    const id = await practiceIdByTitle('Public speaking drills')
    expect((await request.get(`/share/${id}/event.ics`)).status()).toBe(404)

    await makePracticePublic('Public speaking drills')
    const response = await request.get(`/share/${id}/event.ics`)
    expect(response.status()).toBe(200)
    expect(await response.text()).toContain(`URL:http://localhost:3500/share/${id}`)

    await page.goto(`/share/${id}`)
    await expect(page.getByRole('link', { name: 'Apple, Outlook and others (.ics)' })).toHaveAttribute('href', `/share/${id}/event.ics`)
  })
})
