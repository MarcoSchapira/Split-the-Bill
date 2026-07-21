import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const user = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'jamie@example.com',
  name: 'Jamie Rivera',
  createdAt: '2026-07-01T12:00:00.000Z',
  aiReceiptConsentAt: null,
}

const dashboard = {
  totalOwedToYouCents: 5_200,
  totalYouOweCents: 1_800,
  netBalanceCents: 3_400,
  owedToYouPendingConfirmationPercent: 25,
  youOwePendingConfirmationPercent: 0,
  balances: [],
  groupBalances: [],
}

const primaryRoutes = [
  { path: '/dashboard', heading: 'Good to see you' },
  { path: '/bills', heading: 'Bills' },
  { path: '/requests', heading: 'Requests' },
  { path: '/groups', heading: 'Groups' },
  { path: '/friends', heading: 'People' },
  { path: '/activity', heading: 'Activity' },
  { path: '/settings', heading: 'Settings' },
] as const

const mockedResponses = new Map<string, unknown>([
  ['GET /auth/me', { user }],
  ['GET /dashboard', { dashboard }],
  ['GET /friends', { friends: [] }],
  ['GET /invitations', { receivedFriends: [], sentFriends: [] }],
  ['GET /bills', { bills: [] }],
  ['GET /activity', { activity: [] }],
  ['GET /groups', { groups: [] }],
])

test.beforeEach(async ({ page }) => {
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace(/^\/api/, '')
    const requestKey = `${request.method()} ${path}`

    if (!mockedResponses.has(requestKey)) {
      await route.fulfill({
        status: 501,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'UNEXPECTED_MOCK_REQUEST',
            message: `No mocked response exists for ${requestKey}`,
          },
        }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockedResponses.get(requestKey)),
    })
  })
})

test('renders every primary authenticated route without serious regressions', async ({ page }, testInfo) => {
  test.setTimeout(60_000)
  const browserErrors: string[] = []
  const failedApiResponses: string[] = []
  const accessibilityFailures: string[] = []
  const overflowFailures: string[] = []
  const viewportWidth = testInfo.project.use.viewport?.width

  page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`)
  })
  page.on('response', (response) => {
    const url = new URL(response.url())
    if (url.pathname.startsWith('/api/') && response.status() >= 400) {
      failedApiResponses.push(`${response.status()} ${response.request().method()} ${url.pathname}`)
    }
  })

  for (const route of primaryRoutes) {
    await page.goto(route.path)

    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toContainText(route.heading)
    await expect(page.locator('.bc-skeleton')).toHaveCount(0, { timeout: 15_000 })
    // Let route-entry opacity settle before Axe measures the final rendered colors.
    await page.waitForTimeout(300)
    if (route.path === '/dashboard') {
      await expect(page.getByText('$52.00')).toBeVisible()
    }

    const isMobileLayout = (page.viewportSize()?.width ?? 0) <= 840
    if (isMobileLayout) {
      await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible()
      await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeHidden()
    } else {
      await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeHidden()
      await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible()
    }

    const horizontalOverflow = await page.evaluate(() =>
      Math.max(
        document.documentElement.scrollWidth,
        document.body.scrollWidth,
      ) - window.innerWidth,
    )
    if (horizontalOverflow > 1) {
      overflowFailures.push(`${route.path}: ${horizontalOverflow}px`)
    }

    const accessibility = await new AxeBuilder({ page })
      .exclude('[data-radix-toast-viewport]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()
    const seriousViolations = accessibility.violations.filter(
      ({ impact }) => impact === 'serious' || impact === 'critical',
    )
    accessibilityFailures.push(
      ...seriousViolations.flatMap((violation) =>
        violation.nodes.map((node) => {
          const target = node.target.join(' ')
          const summary = node.failureSummary?.replace(/\s+/g, ' ').trim() ?? 'No failure summary'
          return `${route.path}: ${violation.id} at ${target} — ${summary}`
        }),
      ),
    )

    if (route.path === '/dashboard' && (viewportWidth === 390 || viewportWidth === 1440)) {
      await page.screenshot({
        fullPage: true,
        path: `/private/tmp/billcompass-mocked-dashboard-${viewportWidth}.png`,
      })
    }
  }

  expect(overflowFailures, `Horizontal overflow:\n${overflowFailures.join('\n')}`).toEqual([])
  expect(
    accessibilityFailures,
    `Serious or critical accessibility violations:\n${accessibilityFailures.join('\n')}`,
  ).toEqual([])
  expect(failedApiResponses, `API errors:\n${failedApiResponses.join('\n')}`).toEqual([])
  expect(browserErrors, `Browser errors:\n${browserErrors.join('\n')}`).toEqual([])
})
