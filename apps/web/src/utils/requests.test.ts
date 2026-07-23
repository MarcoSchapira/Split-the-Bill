import { describe, expect, it } from 'vitest'
import type { Bill, BillShare, User } from '../api/types'
import {
  canActOnRequest,
  friendAwaitingConfirmationCents,
  friendNetBalanceCents,
  requestDirectionTotals,
  requestItemsFromBills,
} from './requests'

const you = user('you', 'You')
const alex = user('alex', 'Alex')
const sam = user('sam', 'Sam')

describe('request derivation', () => {
  it('derives lender and debtor requests from bill shares', () => {
    const bills = [
      bill('dinner', alex, [
        share('alex-share', alex, alex.id, 1_000),
        share('your-share', you, alex.id, 1_000),
      ]),
      bill('tickets', you, [
        share('your-ticket-share', you, you.id, 2_000),
        share('sam-ticket-share', sam, you.id, 2_000),
      ]),
    ]

    const youOwe = requestItemsFromBills({ bills, currentUserId: you.id, direction: 'you-owe' })
    const owedToYou = requestItemsFromBills({ bills, currentUserId: you.id, direction: 'owed-to-you' })

    expect(youOwe).toMatchObject([{ shareId: 'your-share', role: 'debtor', counterparty: alex }])
    expect(owedToYou).toMatchObject([{ shareId: 'sam-ticket-share', role: 'lender', counterparty: sam }])
  })

  it('keeps the two payment stages distinct and hides completed requests by default', () => {
    const pending = requestItem({ payerMarkedAsPaid: true })
    const unpaid = requestItem()
    const completed = requestItem({ payerMarkedAsPaid: true, lenderConfirmedPaid: true })

    expect(canActOnRequest({ ...unpaid, role: 'debtor' })).toBe(true)
    expect(canActOnRequest({ ...pending, role: 'debtor' })).toBe(false)
    expect(canActOnRequest({ ...unpaid, role: 'lender' })).toBe(true)
    expect(canActOnRequest({ ...pending, role: 'lender' })).toBe(true)
    expect(canActOnRequest({ ...completed, role: 'lender' })).toBe(false)

    const bills = [bill('staged', you, [
      share('unpaid', alex, you.id, 500),
      share('pending', sam, you.id, 600, true),
      share('completed', user('lee', 'Lee'), you.id, 700, true, true),
    ])]
    expect(requestItemsFromBills({
      bills,
      currentUserId: you.id,
      direction: 'owed-to-you',
      includeCompleted: false,
    }).map((item) => item.shareId)).toEqual(['unpaid', 'pending'])
  })

  it('matches mobile totals and pending-confirmation balance rules', () => {
    const bills = [
      bill('you paid', you, [
        share('alex-unpaid', alex, you.id, 800),
        share('sam-pending', sam, you.id, 900, true),
      ]),
      bill('alex paid', alex, [
        share('you-pending', you, alex.id, 1_100, true),
        share('you-unpaid', you, alex.id, 1_200),
      ]),
    ]

    expect(requestDirectionTotals({ bills, currentUserId: you.id, direction: 'owed-to-you' })).toEqual({
      totalCents: 1_700,
      pendingConfirmationCents: 900,
    })
    expect(requestDirectionTotals({ bills, currentUserId: you.id, direction: 'you-owe' })).toEqual({
      totalCents: 1_200,
      pendingConfirmationCents: 1_100,
    })

    const items = [
      requestItem({ direction: 'owed-to-you', amountCents: 800 }),
      requestItem({ direction: 'you-owe', amountCents: 1_100, payerMarkedAsPaid: true }),
      requestItem({ direction: 'you-owe', amountCents: 1_200 }),
    ]
    expect(friendNetBalanceCents(items)).toBe(-400)
    expect(friendAwaitingConfirmationCents(items)).toBe(1_100)
  })

  it('sorts unpaid before pending and completed, newest first within a state', () => {
    const bills = [
      { ...bill('pending', you, [share('pending', alex, you.id, 500, true)]), incurredAt: '2026-07-19T00:00:00.000Z' },
      { ...bill('older unpaid', you, [share('older-unpaid', sam, you.id, 500)]), incurredAt: '2026-07-18T00:00:00.000Z' },
      { ...bill('completed', you, [share('completed', alex, you.id, 500, true, true)]), incurredAt: '2026-07-21T00:00:00.000Z' },
      { ...bill('newer unpaid', you, [share('newer-unpaid', alex, you.id, 500)]), incurredAt: '2026-07-20T00:00:00.000Z' },
    ]

    expect(requestItemsFromBills({
      bills,
      currentUserId: you.id,
      direction: 'owed-to-you',
      includeCompleted: true,
    }).map((item) => item.shareId)).toEqual([
      'newer-unpaid',
      'older-unpaid',
      'pending',
      'completed',
    ])
  })
})

function user(id: string, name: string): User {
  return { id, name, email: `${id}@example.com`, createdAt: '2026-07-01T00:00:00.000Z' }
}

function share(
  id: string,
  shareUser: User,
  lenderId: string,
  shareCents: number,
  payerMarkedAsPaid = false,
  lenderConfirmedPaid = false,
): BillShare {
  return { id, user: shareUser, lenderId, shareCents, payerMarkedAsPaid, lenderConfirmedPaid }
}

function bill(description: string, payer: User, shares: BillShare[]): Bill {
  return {
    id: `bill-${description}`,
    description,
    incurredAt: '2026-07-20T00:00:00.000Z',
    payer,
    payerId: payer.id,
    storeName: null,
    shares,
  } as Bill
}

function requestItem(overrides: Partial<ReturnType<typeof requestItemsFromBills>[number]> = {}) {
  return {
    shareId: 'share',
    billId: 'bill',
    billLabel: 'Dinner',
    incurredAt: '2026-07-20T00:00:00.000Z',
    counterparty: alex,
    amountCents: 500,
    payerMarkedAsPaid: false,
    lenderConfirmedPaid: false,
    direction: 'owed-to-you' as const,
    role: 'lender' as const,
    ...overrides,
  }
}
