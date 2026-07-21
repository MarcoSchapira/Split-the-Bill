import type { Bill, User } from '../api/types'

export type RequestDirection = 'owed-to-you' | 'you-owe'
export type RequestRole = 'debtor' | 'lender'
export type RequestStatus = 'unpaid' | 'pending' | 'completed'

export type RequestItem = {
  shareId: string;
  billId: string;
  billLabel: string;
  incurredAt: string;
  counterparty: User;
  amountCents: number;
  payerMarkedAsPaid: boolean;
  lenderConfirmedPaid: boolean;
  direction: RequestDirection;
  role: RequestRole;
}

export type RequestDirectionTotals = {
  totalCents: number;
  pendingConfirmationCents: number;
}

function billLabel(bill: Bill): string {
  const description = bill.description.trim()
  if (description) return description

  const storeName = bill.storeName?.trim()
  return storeName || 'Bill'
}

function lenderForShare(bill: Bill, lenderId: string): User | undefined {
  if (bill.payer.id === lenderId) return bill.payer
  return bill.shares.find((share) => share.user.id === lenderId)?.user
}

export function requestStatus(item: Pick<RequestItem, 'payerMarkedAsPaid' | 'lenderConfirmedPaid'>): RequestStatus {
  if (item.lenderConfirmedPaid) return 'completed'
  if (item.payerMarkedAsPaid) return 'pending'
  return 'unpaid'
}

export function requestItemsFromBills({
  bills,
  currentUserId,
  direction,
  includeCompleted = true,
}: {
  bills: Bill[];
  currentUserId: string;
  direction: RequestDirection;
  includeCompleted?: boolean;
}): RequestItem[] {
  const items: RequestItem[] = []

  for (const bill of bills) {
    for (const share of bill.shares) {
      if (share.shareCents <= 0) continue

      if (direction === 'owed-to-you') {
        if (share.lenderId !== currentUserId || share.user.id === currentUserId) continue

        items.push({
          shareId: share.id,
          billId: bill.id,
          billLabel: billLabel(bill),
          incurredAt: bill.incurredAt,
          counterparty: share.user,
          amountCents: share.shareCents,
          payerMarkedAsPaid: share.payerMarkedAsPaid,
          lenderConfirmedPaid: share.lenderConfirmedPaid,
          direction,
          role: 'lender',
        })
        continue
      }

      if (share.user.id !== currentUserId || share.lenderId === currentUserId) continue

      const lender = lenderForShare(bill, share.lenderId)
      if (!lender) continue

      items.push({
        shareId: share.id,
        billId: bill.id,
        billLabel: billLabel(bill),
        incurredAt: bill.incurredAt,
        counterparty: lender,
        amountCents: share.shareCents,
        payerMarkedAsPaid: share.payerMarkedAsPaid,
        lenderConfirmedPaid: share.lenderConfirmedPaid,
        direction,
        role: 'debtor',
      })
    }
  }

  return items
    .filter((item) => includeCompleted || !item.lenderConfirmedPaid)
    .sort((left, right) => {
      const statusDifference = requestStatusOrder(left) - requestStatusOrder(right)
      if (statusDifference !== 0) return statusDifference
      return Date.parse(right.incurredAt) - Date.parse(left.incurredAt)
    })
}

export function requestItemsForFriend({
  bills,
  currentUserId,
  friendUserId,
  includeCompleted = false,
}: {
  bills: Bill[];
  currentUserId: string;
  friendUserId: string;
  includeCompleted?: boolean;
}): RequestItem[] {
  return [
    ...requestItemsFromBills({ bills, currentUserId, direction: 'owed-to-you', includeCompleted }),
    ...requestItemsFromBills({ bills, currentUserId, direction: 'you-owe', includeCompleted }),
  ]
    .filter((item) => item.counterparty.id === friendUserId)
    .sort((left, right) => {
      const statusDifference = requestStatusOrder(left) - requestStatusOrder(right)
      if (statusDifference !== 0) return statusDifference
      return Date.parse(right.incurredAt) - Date.parse(left.incurredAt)
    })
}

export function requestDirectionTotals({
  bills,
  currentUserId,
  direction,
}: {
  bills: Bill[];
  currentUserId: string;
  direction: RequestDirection;
}): RequestDirectionTotals {
  let totalCents = 0
  let pendingConfirmationCents = 0

  for (const bill of bills) {
    for (const share of bill.shares) {
      if (share.shareCents <= 0 || share.lenderConfirmedPaid) continue

      if (direction === 'owed-to-you') {
        if (share.lenderId !== currentUserId || share.user.id === currentUserId) continue
        totalCents += share.shareCents
        if (share.payerMarkedAsPaid) pendingConfirmationCents += share.shareCents
        continue
      }

      if (share.user.id !== currentUserId || share.lenderId === currentUserId) continue
      if (share.payerMarkedAsPaid) {
        pendingConfirmationCents += share.shareCents
      } else {
        totalCents += share.shareCents
      }
    }
  }

  return { totalCents, pendingConfirmationCents }
}

export function friendNetBalanceCents(items: RequestItem[]): number {
  return items.reduce((balance, item) => {
    if (item.lenderConfirmedPaid) return balance
    if (item.direction === 'owed-to-you') return balance + item.amountCents
    if (item.payerMarkedAsPaid) return balance
    return balance - item.amountCents
  }, 0)
}

export function friendAwaitingConfirmationCents(items: RequestItem[]): number {
  return items.reduce((total, item) => {
    if (
      item.direction === 'you-owe' &&
      item.payerMarkedAsPaid &&
      !item.lenderConfirmedPaid
    ) {
      return total + item.amountCents
    }
    return total
  }, 0)
}

export function canActOnRequest(item: RequestItem): boolean {
  if (item.lenderConfirmedPaid) return false
  if (item.role === 'debtor') return !item.payerMarkedAsPaid
  return item.payerMarkedAsPaid
}

export function requestStatusOrder(item: Pick<RequestItem, 'payerMarkedAsPaid' | 'lenderConfirmedPaid'>): number {
  const status = requestStatus(item)
  if (status === 'unpaid') return 0
  if (status === 'pending') return 1
  return 2
}
