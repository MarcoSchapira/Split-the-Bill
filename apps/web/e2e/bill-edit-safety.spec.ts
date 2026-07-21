import { expect, test } from '@playwright/test'

const currentUser = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'jamie@example.com',
  name: 'Jamie Rivera',
  createdAt: '2026-07-01T12:00:00.000Z',
  aiReceiptConsentAt: '2026-07-02T12:00:00.000Z',
}

const friend = {
  id: '00000000-0000-4000-8000-000000000002',
  email: 'alex@example.com',
  name: 'Alex Chen',
  createdAt: '2026-06-01T12:00:00.000Z',
}

const capturedBill = {
  id: '00000000-0000-4000-8000-000000000010',
  description: 'Lunch at Green Table',
  incurredAt: '2026-07-18T12:45:00.000Z',
  totalCents: 2_500,
  source: 'capture',
  storeName: 'Green Table',
  storeAddress: '21 King Street West, Toronto',
  receiptNumber: 'GT-4821',
  receiptDate: '2026-07-18',
  receiptTime: '12:45',
  paymentMethod: 'Visa',
  cardLast4: '4242',
  itemCount: 2,
  subtotalCents: 2_000,
  otherFeesCents: 40,
  taxCents: 260,
  tipCents: 200,
  payerId: friend.id,
  creatorId: currentUser.id,
  createdAt: '2026-07-18T13:00:00.000Z',
  lastEditedAt: '2026-07-18T13:00:00.000Z',
  payer: friend,
  creator: currentUser,
  shares: [
    {
      id: 'share-jamie',
      shareCents: 625,
      lenderId: friend.id,
      payerMarkedAsPaid: true,
      lenderConfirmedPaid: false,
      user: currentUser,
    },
    {
      id: 'share-alex',
      shareCents: 1_875,
      lenderId: friend.id,
      payerMarkedAsPaid: false,
      lenderConfirmedPaid: false,
      user: friend,
    },
  ],
  canEdit: true,
  canDelete: true,
  canRetarget: true,
  userSummary: { amountCents: 625, direction: 'you_owe', settled: false },
  lineItems: [
    {
      id: 'item-coffee',
      name: 'Coffee',
      quantity: 2,
      unitPriceCents: 500,
      totalPriceCents: 1_000,
      sortOrder: 0,
      assignments: [
        { id: 'assignment-coffee-jamie', user: currentUser },
        { id: 'assignment-coffee-alex', user: friend },
      ],
    },
    {
      id: 'item-lunch',
      name: 'Lunch special',
      quantity: 1,
      unitPriceCents: 1_000,
      totalPriceCents: 1_000,
      sortOrder: 1,
      assignments: [{ id: 'assignment-lunch-alex', user: friend }],
    },
  ],
  isOneMainTotal: false,
  isSplitWithFriends: true,
  isSplitByFinalAmounts: false,
  isSplitWithGroup: false,
  groupId: null,
  group: null,
}

test('editing a rich captured bill preserves every replacement field', async ({ page }, testInfo) => {
  test.skip(testInfo.project.use.viewport?.width !== 1024, 'One desktop project exercises the replacement payload.')

  let replacementPayload: Record<string, unknown> | null = null

  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace(/^\/api/, '')
    const key = `${request.method()} ${path}`

    if (key === 'GET /auth/me') {
      await route.fulfill({ json: { user: currentUser } })
      return
    }
    if (key === 'GET /friends') {
      await route.fulfill({ json: { friends: [{ id: 'friendship-1', createdAt: '2026-06-02T12:00:00.000Z', friend }] } })
      return
    }
    if (key === 'GET /groups') {
      await route.fulfill({ json: { groups: [] } })
      return
    }
    if (key === `GET /bills/${capturedBill.id}`) {
      await route.fulfill({ json: { bill: capturedBill } })
      return
    }
    if (key === `PATCH /bills/${capturedBill.id}`) {
      replacementPayload = request.postDataJSON() as Record<string, unknown>
      await route.fulfill({ json: { bill: capturedBill } })
      return
    }

    await route.fulfill({
      status: 501,
      json: { error: { code: 'UNEXPECTED_MOCK_REQUEST', message: key } },
    })
  })

  await page.goto(`/bills/${capturedBill.id}/edit`)
  await expect(page.getByRole('heading', { level: 1, name: 'Update bill' })).toBeVisible()
  await expect(page.getByLabel('Title')).toHaveValue(capturedBill.description)
  await expect(page.getByLabel('Store name')).toHaveValue(capturedBill.storeName)
  await expect(page.getByLabel('Store address')).toHaveValue(capturedBill.storeAddress)
  await expect(page.getByLabel('Receipt number')).toHaveValue(capturedBill.receiptNumber)
  await expect(page.getByLabel('Payment method')).toHaveValue(capturedBill.paymentMethod)
  await expect(page.getByLabel('Card last 4')).toHaveValue(capturedBill.cardLast4)
  await expect(page.getByLabel('Paid by')).toHaveValue(friend.id)
  await expect(page.getByRole('button', { name: /Friends/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: /By line item/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByLabel('Item').first()).toHaveValue('Coffee')
  await expect(page.getByLabel('Item').nth(1)).toHaveValue('Lunch special')

  await page.getByRole('button', { name: 'Review bill' }).click()
  await expect(page.getByRole('heading', { name: 'Review your bill' })).toBeFocused()
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect.poll(() => replacementPayload).not.toBeNull()

  expect(replacementPayload).toMatchObject({
    description: capturedBill.description,
    incurredAt: capturedBill.incurredAt,
    totalCents: capturedBill.totalCents,
    payerId: friend.id,
    source: 'capture',
    isOneMainTotal: false,
    isSplitWithFriends: true,
    isSplitWithGroup: false,
    groupId: null,
    isSplitByFinalAmounts: false,
    participantIds: [currentUser.id, friend.id],
    storeName: capturedBill.storeName,
    storeAddress: capturedBill.storeAddress,
    receiptNumber: capturedBill.receiptNumber,
    receiptDate: capturedBill.receiptDate,
    receiptTime: capturedBill.receiptTime,
    paymentMethod: capturedBill.paymentMethod,
    cardLast4: capturedBill.cardLast4,
    itemCount: capturedBill.itemCount,
    subtotalCents: capturedBill.subtotalCents,
    otherFeesCents: capturedBill.otherFeesCents,
    taxCents: capturedBill.taxCents,
    tipCents: capturedBill.tipCents,
    lineItems: [
      {
        name: 'Coffee',
        quantity: 2,
        unitPriceCents: 500,
        totalPriceCents: 1_000,
        assignedUserIds: [currentUser.id, friend.id],
      },
      {
        name: 'Lunch special',
        quantity: 1,
        unitPriceCents: 1_000,
        totalPriceCents: 1_000,
        assignedUserIds: [friend.id],
      },
    ],
  })

  const shares = replacementPayload?.shares as Array<{ userId: string; shareCents: number; lenderId: string }>
  expect(shares).toHaveLength(2)
  expect(shares.reduce((sum, share) => sum + share.shareCents, 0)).toBe(capturedBill.totalCents)
  expect(shares.every((share) => share.lenderId === friend.id)).toBe(true)
})
