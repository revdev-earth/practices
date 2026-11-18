import { expect, test, type Browser, type Page } from '@playwright/test'

import { insertPractice } from './database'
import { logIn, people } from './helpers'

test.skip(!process.env.NEXT_PUBLIC_LIVEKIT_URL || !process.env.LIVEKIT_API_KEY, 'LiveKit is not configured')

// Every browser of this file has a camera and a microphone that play a test pattern and a tone.
test.use({ launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] } })

const enterRoom = async (browser: Browser, email: string, practiceId: string) => {
  const context = await browser.newContext({ permissions: ['camera', 'microphone'] })
  const page = await context.newPage()
  await logIn(page, email)
  await page.goto(`/practices/${practiceId}/room`)
  await expect(page.locator('.lk-control-bar')).toBeVisible({ timeout: 30_000 })
  return page
}

const tiles = (page: Page) => page.locator('.lk-participant-tile')
const groupStatus = (page: Page) => page.locator('.practice-call-group')
const panel = (page: Page) => page.getByRole('complementary', { name: 'Groups' })

const groupNumberOf = async (page: Page) => {
  await expect(groupStatus(page)).toHaveText(/^You are in group \d$/, { timeout: 30_000 })
  return Number((await groupStatus(page).textContent())?.slice(-1))
}

test.describe('Groups in the call', () => {
  // The calls go through LiveKit Cloud over the network. One slow connection gets a second chance.
  test.describe.configure({ retries: 1 })
  test.setTimeout(240_000)

  test('the host splits the call into groups, moves someone, visits a group and brings everyone back', async ({ browser }) => {
    const practiceId = await insertPractice({
      title: 'Groups test',
      startsAt: new Date(Date.now() - 60_000),
      durationMin: 60,
      organizerEmail: people.dana,
      participantEmails: [people.kenji, people.amara, people.lucia, people.tom],
      videoRoom: true,
    })

    const host = await enterRoom(browser, people.dana, practiceId)
    const guests = {
      kenji: await enterRoom(browser, people.kenji, practiceId),
      amara: await enterRoom(browser, people.amara, practiceId),
      lucia: await enterRoom(browser, people.lucia, practiceId),
      tom: await enterRoom(browser, people.tom, practiceId),
    }
    await expect(tiles(host)).toHaveCount(5, { timeout: 60_000 })

    // Only the host has the panel.
    await expect(guests.kenji.getByRole('button', { name: 'Groups' })).toHaveCount(0)

    // Four people in groups of two: two groups of two. The host stays in the main room.
    await host.getByRole('button', { name: 'Groups' }).click()
    await panel(host).getByLabel('People per group').fill('2')
    await panel(host).getByRole('button', { name: 'Split into groups' }).click()
    await expect(panel(host).getByRole('listitem', { name: 'Group 1' }).getByText('(2)')).toBeVisible({ timeout: 30_000 })
    await expect(panel(host).getByRole('listitem', { name: 'Group 2' }).getByText('(2)')).toBeVisible()

    const groupOf = {
      kenji: await groupNumberOf(guests.kenji),
      amara: await groupNumberOf(guests.amara),
      lucia: await groupNumberOf(guests.lucia),
      tom: await groupNumberOf(guests.tom),
    }
    expect(Object.values(groupOf).sort()).toEqual([1, 1, 2, 2])
    for (const page of Object.values(guests)) await expect(tiles(page)).toHaveCount(2, { timeout: 30_000 })
    await expect(tiles(host)).toHaveCount(1, { timeout: 30_000 })

    // Kenji moves to the other group, which then has three people.
    const otherGroup = groupOf.kenji === 1 ? 2 : 1
    await panel(host).getByLabel('Move Kenji Mori').selectOption(String(otherGroup))
    await expect(groupStatus(guests.kenji)).toHaveText(`You are in group ${otherGroup}`, { timeout: 30_000 })
    await expect(tiles(guests.kenji)).toHaveCount(3, { timeout: 30_000 })

    // The host visits that group, with the panel still open.
    await panel(host)
      .getByRole('listitem', { name: `Group ${otherGroup}` })
      .getByRole('button', { name: 'Visit' })
      .click()
    await expect(groupStatus(host)).toHaveText(`You are in group ${otherGroup}`, { timeout: 30_000 })
    await expect(tiles(host)).toHaveCount(4, { timeout: 30_000 })

    // Everyone back in the main room.
    await panel(host).getByRole('button', { name: 'Bring everyone back' }).click()
    for (const page of [host, ...Object.values(guests)]) {
      await expect(groupStatus(page)).toHaveCount(0, { timeout: 30_000 })
      await expect(tiles(page)).toHaveCount(5, { timeout: 60_000 })
    }
  })

  test('a group needs enough people', async ({ browser }) => {
    const practiceId = await insertPractice({
      title: 'Groups test, too few',
      startsAt: new Date(Date.now() - 60_000),
      durationMin: 60,
      organizerEmail: people.priya,
      participantEmails: [people.sofia],
      videoRoom: true,
    })
    const host = await enterRoom(browser, people.priya, practiceId)
    await enterRoom(browser, people.sofia, practiceId)
    await expect(tiles(host)).toHaveCount(2, { timeout: 60_000 })

    await host.getByRole('button', { name: 'Groups' }).click()
    await panel(host).getByLabel('People per group').fill('2')
    await panel(host).getByRole('button', { name: 'Split into groups' }).click()
    await expect(panel(host).getByRole('alert')).toHaveText('Only 1 person is here besides you, not enough for groups of 2.')
  })
})
