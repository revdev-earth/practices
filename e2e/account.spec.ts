import { expect, test, type Page } from '@playwright/test'

import { E2E_PASSWORD } from './environment'
import { expectEmail, logIn, people } from './helpers'

const NEW_PASSWORD = 'Another@Password9'

const formError = (page: Page) => page.locator('form [role="alert"]')

// Each run registers new people, so the tests never meet an account left by an earlier run.
const newEmail = (label: string) => `${label}-${Date.now()}@practices.test`

const register = async (page: Page, name: string, email: string) => {
  await page.goto('/?auth=register')
  await page.getByLabel('Name').fill(name)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(E2E_PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByLabel('Code from the email')).toBeVisible()
}

const codeSentTo = async (email: string) => {
  const emails = await expectEmail(email, /is your Practices confirmation code$/)
  return emails[emails.length - 1].subject.slice(0, 6)
}

test.describe('Account', () => {
  test('a new account opens with the code from its email and lands on the calendar', async ({ page }) => {
    const email = newEmail('ada')
    await register(page, 'Ada Lovelace', email)

    await page.getByLabel('Code from the email').fill('000000')
    await page.getByRole('button', { name: 'Confirm email' }).click()
    await expect(page.getByText('That code does not match.', { exact: false })).toBeVisible()

    await page.getByLabel('Code from the email').fill(await codeSentTo(email))
    await page.getByRole('button', { name: 'Confirm email' }).click()
    await page.waitForURL(/\/calendar/)
    await expect(page.getByText('Ada Lovelace')).toBeVisible()

    await page.getByRole('button', { name: 'Log out' }).click()
    await page.waitForURL((url) => url.pathname === '/')
    await logIn(page, email)
  })

  test('an account that never typed its code goes to the code step when it logs in', async ({ page }) => {
    const email = newEmail('grace')
    await register(page, 'Grace Hopper', email)

    await page.goto('/?auth=login')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password', { exact: true }).fill(E2E_PASSWORD)
    await page.getByRole('button', { name: 'Log in', exact: true }).click()
    await expect(page.getByLabel('Code from the email')).toBeVisible()
  })

  test('registering an email with a confirmed account says so', async ({ page }) => {
    await page.goto('/?auth=register')
    await page.getByLabel('Name').fill('Someone Else')
    await page.getByLabel('Email').fill(people.dana)
    await page.getByLabel('Password', { exact: true }).fill(E2E_PASSWORD)
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByText('An account with this email already exists. Log in instead.')).toBeVisible()
  })

  test('a reset link from the email sets a new password and works only once', async ({ page }) => {
    const email = newEmail('katherine')
    await register(page, 'Katherine Johnson', email)
    await page.getByLabel('Code from the email').fill(await codeSentTo(email))
    await page.getByRole('button', { name: 'Confirm email' }).click()
    await page.waitForURL(/\/calendar/)
    await page.getByRole('button', { name: 'Log out' }).click()
    await page.waitForURL((url) => url.pathname === '/')

    await page.goto('/?auth=forgot')
    await page.getByLabel('Email').fill(email)
    await page.getByRole('button', { name: 'Send reset link' }).click()
    await expect(page.getByRole('status')).toContainText('a reset link is on its way')

    const [resetEmail] = await expectEmail(email, /^Reset your Practices password$/)
    const resetPath = resetEmail.html.match(/href="http:\/\/localhost:3500(\/\?auth=reset&amp;token=[^"]+|\/\?auth=reset&token=[^"]+)"/)?.[1]
    expect(resetPath).toBeTruthy()
    const resetLink = (resetPath ?? '').replaceAll('&amp;', '&')

    await page.goto(resetLink)
    await page.getByLabel('New password', { exact: true }).fill(NEW_PASSWORD)
    await page.getByRole('button', { name: 'Save new password' }).click()
    await expect(page.getByText('Password saved. Log in with the new one.')).toBeVisible()

    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password', { exact: true }).fill(E2E_PASSWORD)
    await page.getByRole('button', { name: 'Log in', exact: true }).click()
    await expect(formError(page)).toHaveText('Wrong email or password.')
    await logIn(page, email, NEW_PASSWORD)

    await page.goto(resetLink)
    await page.getByLabel('New password', { exact: true }).fill('Yet@Another1')
    await page.getByRole('button', { name: 'Save new password' }).click()
    await expect(formError(page)).toHaveText('This link expired or was already used. Request a new one.')
  })

  test('a private page without a session opens the login window and comes back after it', async ({ page }) => {
    await page.goto('/practices?view=mine')
    await expect(page).toHaveURL(/\/\?auth=login&next=%2Fpractices%3Fview%3Dmine/)
    await page.getByLabel('Email').fill(people.kenji)
    await page.getByLabel('Password', { exact: true }).fill(E2E_PASSWORD)
    await page.getByRole('button', { name: 'Log in', exact: true }).click()
    await page.waitForURL(/\/practices\?view=mine/)
  })
})
