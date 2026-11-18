import { expect, test, type Browser } from '@playwright/test'

import { insertPractice, practiceIdByTitle } from './database'
import { expectEmail, logIn, people, sentEmails } from './helpers'

// A person who used the app from Tokyo gets the times of their emails in Tokyo, which has no daylight saving time.
const logInFromTokyo = async (browser: Browser, email: string) => {
  const context = await browser.newContext({ timezoneId: 'Asia/Tokyo' })
  const page = await context.newPage()
  await logIn(page, email)
  await context.close()
}

const emailsTo = (to: string, subject: RegExp) => sentEmails().filter((email) => email.to === to && subject.test(email.subject))

test.describe('Practice notices', () => {
  test('reaching the minimum emails the group, in the zone each person uses', async ({ page, browser }) => {
    const title = 'Mock interviews for frontend roles'
    // Kenji used the app from Tokyo. Dana never logged in, so her email shows the time in UTC.
    await logInFromTokyo(browser, people.kenji)

    // Two of three: Amara is the third.
    await logIn(page, people.amara)
    await page.goto(`/practices/${await practiceIdByTitle(title)}`)
    await page.getByRole('button', { name: 'Join', exact: true }).click()
    await expect(page.getByText('You have a spot.')).toBeVisible()

    const [toKenji] = await expectEmail(people.kenji, new RegExp(`^${title} is confirmed$`))
    expect(toKenji.html).toContain('GMT+9')
    const [toDana] = await expectEmail(people.dana, new RegExp(`^${title} is confirmed$`))
    expect(toDana.html).toContain('UTC')
    // Whoever made the change sees it on screen.
    expect(emailsTo(people.amara, /is confirmed/)).toHaveLength(0)
  })

  test('leaving a full practice gives the spot to the first person waiting, and only to them', async ({ page }) => {
    // Guitar circle: Sofia, Tom, Noah and Priya have the four spots. Lucía and Amara wait, in that order.
    await logIn(page, people.tom)
    await page.goto(`/practices/${await practiceIdByTitle('Guitar circle for beginners')}`)
    await page.getByRole('button', { name: 'Leave', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Join the waitlist' })).toBeVisible()

    const [toLucia] = await expectEmail(people.lucia, /^You have a spot in Guitar circle for beginners$/)
    expect(toLucia.html).toContain('moved up from the waitlist')
    expect(emailsTo(people.amara, /You have a spot/)).toHaveLength(0)
  })

  test('moving the time and cancelling email everyone on the sheet', async ({ page }) => {
    const title = 'Notice test: drawing together'
    const startsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    const id = await insertPractice({ title, startsAt, durationMin: 60, organizerEmail: people.dana, participantEmails: [people.noah, people.sofia] })

    await logIn(page, people.dana)
    await page.goto(`/practices/${id}`)
    await page.getByRole('button', { name: 'Edit practice' }).click()
    const later = new Date(startsAt.getTime() + 24 * 60 * 60 * 1000)
    const laterInBerlin = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', dateStyle: 'short', timeStyle: 'short' }).format(later)
    await page.getByLabel('Starts').fill(laterInBerlin.replace(' ', 'T'))
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByRole('button', { name: 'Edit practice' })).toBeVisible()

    const [moved] = await expectEmail(people.noah, new RegExp(`^${title} has a new time$`))
    expect(moved.html).toContain('It was')
    await expectEmail(people.sofia, new RegExp(`^${title} has a new time$`))
    expect(emailsTo(people.dana, /has a new time/)).toHaveLength(0)

    await page.getByRole('button', { name: 'Delete practice' }).click()
    await page
      .getByRole('button', { name: /^Delete/ })
      .last()
      .click()
    await page.waitForURL(/\/calendar/)

    const [cancelled] = await expectEmail(people.noah, new RegExp(`^${title} was cancelled$`))
    expect(cancelled.html).toContain('Dana Reyes cancelled')
    await expectEmail(people.sofia, new RegExp(`^${title} was cancelled$`))
  })

  test('titles typed by people are escaped in the email', async ({ page }) => {
    const title = 'Notice test <b>bold</b> & co'
    const id = await insertPractice({
      title,
      startsAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      durationMin: 60,
      organizerEmail: people.priya,
      minParticipants: 2,
    })
    await logIn(page, people.kenji)
    await page.goto(`/practices/${id}`)
    await page.getByRole('button', { name: 'Join', exact: true }).click()

    const [email] = await expectEmail(people.priya, /bold.*is confirmed$/)
    expect(email.html).toContain('Notice test &lt;b&gt;bold&lt;/b&gt; &amp; co')
    expect(email.html).not.toContain('<b>bold</b>')
  })
})
