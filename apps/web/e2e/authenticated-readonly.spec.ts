import { expect, test } from '@playwright/test'

const email = process.env.BILLCOMPASS_TEST_EMAIL
const password = process.env.BILLCOMPASS_TEST_PASSWORD

test.describe('authenticated workspace smoke test', () => {
  test.skip(!email || !password, 'Set the read-only review account credentials to run this suite.')

  test('loads every primary workspace without browser or API errors', async ({ context, page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-1440', 'One login covers all responsive viewports.')

    const browserErrors: string[] = []
    const failedApiResponses: string[] = []

    page.on('pageerror', (error) => browserErrors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(message.text())
    })
    page.on('response', (response) => {
      const url = new URL(response.url())
      if (url.pathname.startsWith('/api/') && response.status() >= 400) {
        failedApiResponses.push(`${response.status()} ${url.pathname}`)
      }
    })

    await page.goto('/login')
    await page.getByLabel('Email').fill(email!)
    await page.getByLabel('Password').fill(password!)
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page).toHaveURL(/\/dashboard$/)
    // An anonymous /auth/me probe (and its refresh attempt) is expected before login.
    // Only diagnose failures that occur after the authenticated session exists.
    failedApiResponses.length = 0
    browserErrors.length = 0

    const accessCookie = (await context.cookies()).find(({ name }) => name === 'equisplit_access')
    expect(accessCookie, 'Login should issue the HttpOnly access cookie.').toBeDefined()
    await context.clearCookies({ name: 'equisplit_access' })
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: /Good to see you/ })).toBeVisible()
    await expect.poll(async () =>
      (await context.cookies()).some(({ name }) => name === 'equisplit_access'),
    ).toBe(true)
    // The first /auth/me 401 is intentional; successful refresh and retry are
    // proven by the restored cookie and authenticated dashboard above.
    failedApiResponses.length = 0
    browserErrors.length = 0

    const routes = [
      ['/dashboard', /Good to see you/],
      ['/bills', /^Bills$/],
      ['/requests', /^Requests$/],
      ['/groups', /^Groups$/],
      ['/friends', /^People$/],
      ['/activity', /^Activity$/],
      ['/settings', /^Settings$/],
    ] as const

    for (const [route, heading] of routes) {
      await page.goto(route)
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
      await page.waitForLoadState('networkidle')
    }

    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.bc-skeleton')).toHaveCount(0, { timeout: 15_000 })
    await page.screenshot({
      fullPage: true,
      path: '/private/tmp/billcompass-dashboard-desktop.png',
    })

    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible()
    await page.screenshot({
      fullPage: true,
      path: '/private/tmp/billcompass-dashboard-mobile.png',
    })

    // Logging out revokes only this temporary browser session and exercises a
    // same-origin, CSRF-protected mutation without changing review-account data.
    await page.getByRole('button', { name: 'Open menu' }).click()
    await page.getByRole('menuitem', { name: 'Log out' }).click()
    await expect(page).toHaveURL(/\/login$/)

    expect(failedApiResponses, `API errors: ${failedApiResponses.join(', ')}`).toEqual([])
    expect(browserErrors, `Browser errors: ${browserErrors.join('\n')}`).toEqual([])
  })
})
