import { expect, test, type Page } from '@playwright/test'

import { clearAttemptCounters } from './database'
import { E2E_PASSWORD } from './environment'
import { people, sentEmails } from './helpers'

// The error of the form. Next.js keeps another alert on the page for route announcements.
const formError = (page: Page) => page.locator('form [role="alert"]')

const fillLogin = async (page: Page, email: string, password: string) => {
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
}

const requestReset = async (page: Page, email: string) => {
  await page.goto('/?auth=forgot')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Send reset link' }).click()
}

test.describe('Attempt limits', () => {
  test.afterAll(clearAttemptCounters)

  test('ten wrong passwords close the login of that email for a while, even with the right one', async ({ page }) => {
    await page.goto('/?auth=login')
    for (let attempt = 1; attempt <= 10; attempt++) {
      await fillLogin(page, people.noah, `wrong-password-${attempt}`)
      await expect(formError(page)).toHaveText('Wrong email or password.')
    }

    await fillLogin(page, people.noah, E2E_PASSWORD)
    await expect(formError(page)).toHaveText(/^Too many tries\. Try again in 1[45] minutes\.$/)
    await expect(page).not.toHaveURL(/\/calendar/)
  })

  test('a right password before the limit starts the count over', async ({ page }) => {
    await page.goto('/?auth=login')
    for (let attempt = 1; attempt <= 9; attempt++) {
      await fillLogin(page, people.sofia, `wrong-password-${attempt}`)
      await expect(formError(page)).toHaveText('Wrong email or password.')
    }
    await fillLogin(page, people.sofia, E2E_PASSWORD)
    await page.waitForURL(/\/calendar/)
  })

  test('one email gets three reset links per hour and the answer stays the same after that', async ({ page }) => {
    const resetLinksForPriya = () => sentEmails().filter((email) => email.to === people.priya && email.kind === 'password reset').length

    for (let request = 1; request <= 4; request++) {
      await requestReset(page, people.priya)
      await expect(page.getByRole('status')).toContainText('If an account uses that email, a reset link is on its way.')
    }
    await expect.poll(resetLinksForPriya).toBe(3)
  })

  test('one address asks for at most ten reset links per hour', async ({ browser }) => {
    const context = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': '203.0.113.7' } })
    const page = await context.newPage()

    for (let request = 1; request <= 10; request++) {
      await requestReset(page, `nobody-${request}@practices.test`)
      await expect(page.getByRole('status')).toContainText('a reset link is on its way')
    }
    await requestReset(page, 'nobody-11@practices.test')
    await expect(formError(page)).toHaveText(/^Too many tries\. Try again in (60|59) minutes\.$/)
    await context.close()
  })
})
