import { describe, expect, it } from 'vitest'
import {
  allocateItemizedShares,
  equalShareCents,
  formatCentsAsAmount,
  parseAmountToCents,
  sharesMatchEqualSplit,
} from './billSplit'

describe('bill split cents', () => {
  it('gives an equal-split rounding remainder to the payer', () => {
    expect(equalShareCents(1_000, ['friend-b', 'payer', 'friend-a'], 'payer')).toEqual([
      { userId: 'friend-a', shareCents: 333 },
      { userId: 'friend-b', shareCents: 333 },
      { userId: 'payer', shareCents: 334 },
    ])
  })

  it('does not misclassify a custom one-cent distribution as an equal payer-remainder split', () => {
    expect(sharesMatchEqualSplit(1_000, [
      { userId: 'friend-a', shareCents: 333 },
      { userId: 'friend-b', shareCents: 334 },
      { userId: 'payer', shareCents: 333 },
    ], 'payer')).toBe(false)
  })

  it('parses dollar input into integer cents', () => {
    expect(parseAmountToCents(' 12.34 ')).toBe(1_234)
    expect(parseAmountToCents('-1')).toBeNull()
    expect(parseAmountToCents('not money')).toBeNull()
  })

  it('formats integer cents without floating-point drift', () => {
    expect(formatCentsAsAmount(0)).toBe('0.00')
    expect(formatCentsAsAmount(1_234)).toBe('12.34')
    expect(formatCentsAsAmount(100_001)).toBe('1000.01')
  })

  it('splits shared items and allocates the adjustment remainder to the payer', () => {
    const result = allocateItemizedShares({
      totalCents: 1_100,
      payerId: 'person-b',
      participantIds: ['person-a', 'person-b'],
      lineItems: [{ totalPriceCents: 1_001, assignedUserIds: ['person-a', 'person-b'] }],
    })

    expect(result.error).toBeNull()
    expect(result.shares).toEqual([
      { userId: 'person-a', shareCents: 550 },
      { userId: 'person-b', shareCents: 550 },
    ])
  })

  it('requires every item to have an assignee', () => {
    const result = allocateItemizedShares({
      totalCents: 500,
      payerId: 'person-a',
      participantIds: ['person-a', 'person-b'],
      lineItems: [{ totalPriceCents: 500, assignedUserIds: [] }],
    })

    expect(result.error).toMatch(/Assign every line item/)
    expect(result.shares).toEqual([])
  })

  it('rejects item totals above the final bill total', () => {
    const result = allocateItemizedShares({
      totalCents: 499,
      payerId: 'person-a',
      participantIds: ['person-a'],
      lineItems: [{ totalPriceCents: 500, assignedUserIds: ['person-a'] }],
    })

    expect(result.error).toMatch(/cannot exceed/)
  })
})
