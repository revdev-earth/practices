import { expect, test } from '@playwright/test'

import { insertPractice } from './database'
import { logIn, people } from './helpers'

// Tokyo has no daylight saving time, so its wall clock is always UTC+9.
const TIME_ZONE = 'Asia/Tokyo'
test.use({ timezoneId: TIME_ZONE })

// A day two weeks ahead, far from the practices of the seed.
const dayInTwoWeeks = () => new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000))

const tokyoTime = (day: string, time: string) => new Date(`${day}T${time}:00+09:00`)

test.describe('Week view', () => {
  test('practices sit on their day at their hour, and overlapping ones share the width', async ({ page }) => {
    const day = dayInTwoWeeks()
    await insertPractice({ title: 'Week test early', startsAt: tokyoTime(day, '10:00'), durationMin: 90, organizerEmail: people.amara })
    await insertPractice({ title: 'Week test overlap', startsAt: tokyoTime(day, '10:30'), durationMin: 60, organizerEmail: people.tom })
    await insertPractice({ title: 'Week test late', startsAt: tokyoTime(day, '15:00'), durationMin: 30, organizerEmail: people.priya })

    await logIn(page, people.kenji)
    await page.goto(`/calendar?view=week&day=${day}`)
    await expect(page.getByRole('link', { name: 'Week', exact: true })).toHaveAttribute('aria-current', 'page')

    const early = page.locator('.week-block', { hasText: 'Week test early' })
    const overlap = page.locator('.week-block', { hasText: 'Week test overlap' })
    const late = page.locator('.week-block', { hasText: 'Week test late' })
    await expect(early).toBeVisible()

    const earlyBox = (await early.boundingBox())!
    const overlapBox = (await overlap.boundingBox())!
    const lateBox = (await late.boundingBox())!

    // Side by side, each about half of the day.
    expect(overlapBox.x).toBeGreaterThan(earlyBox.x + earlyBox.width / 2)
    expect(Math.abs(earlyBox.width - overlapBox.width)).toBeLessThan(2)
    // 90 minutes are drawn longer than 60, and the later start sits lower.
    expect(earlyBox.height).toBeGreaterThan(overlapBox.height)
    expect(overlapBox.y).toBeGreaterThan(earlyBox.y)
    // Alone at its hour, the late practice takes the whole width of its day.
    expect(lateBox.width).toBeGreaterThan(earlyBox.width * 1.6)
    // A practice of 30 minutes writes its time and title on one line.
    await expect(late).toHaveClass(/week-block-one-line/)

    await early.click()
    await expect(page).toHaveURL(/\/practices\//)
    await expect(page.getByRole('heading', { name: 'Week test early' })).toBeVisible()
  })

  test('the arrows move one week and switching views keeps the selected day', async ({ page }) => {
    const day = dayInTwoWeeks()
    await logIn(page, people.kenji)
    await page.goto(`/calendar?view=week&day=${day}`)
    const heading = page.getByRole('heading', { level: 1 })
    const weekHeading = await heading.textContent()
    expect(weekHeading).toMatch(/^[A-Z][a-z]+ \d{1,2} to .+\d{4}$/)

    await page.getByRole('link', { name: /^Next week/ }).click()
    await expect(heading).not.toHaveText(weekHeading ?? '')
    await page.getByRole('link', { name: /^Previous week/ }).click()
    await expect(heading).toHaveText(weekHeading ?? '')

    await page.getByRole('link', { name: 'Month', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`day=${day}`))
    await expect(page.getByRole('link', { name: 'Month', exact: true })).toHaveAttribute('aria-current', 'page')
  })

  test('on a phone the week is a list of days', async ({ page }) => {
    const day = dayInTwoWeeks()
    await page.setViewportSize({ width: 390, height: 844 })
    await logIn(page, people.kenji)
    await page.goto(`/calendar?view=week&day=${day}`)
    await expect(page.locator('.week-block').first()).toBeHidden()
    await expect(page.getByRole('link', { name: /Week test early/ }).last()).toBeVisible()
  })
})
