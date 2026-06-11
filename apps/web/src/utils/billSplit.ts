import type { User } from '../api/types'

export type BillShareDraft = {
  userId: string;
  shareCents: number;
};

export type SplitKind = 'equal' | 'custom';
export type CustomSplitMode = 'amount' | 'percent';

export type MemberSplitState = {
  user: User;
  included: boolean;
  amount: string;
  percent: string;
};

export function equalShareCents(
  totalCents: number,
  participantIds: string[],
): BillShareDraft[] {
  const ordered = [...new Set(participantIds)].sort()
  if (ordered.length === 0) {
    return []
  }

  const baseShare = Math.floor(totalCents / ordered.length)
  const remainder = totalCents % ordered.length

  return ordered.map((userId, index) => ({
    userId,
    shareCents: baseShare + (index < remainder ? 1 : 0),
  }))
}

export function allocateFromPercents(
  totalCents: number,
  entries: { userId: string; percent: number }[],
): BillShareDraft[] {
  if (entries.length === 0) {
    return []
  }

  const totalPercent = entries.reduce((sum, entry) => sum + entry.percent, 0)
  if (totalPercent <= 0) {
    return entries.map((entry) => ({ userId: entry.userId, shareCents: 0 }))
  }

  const weighted = entries.map((entry) => {
    const exact = (entry.percent / totalPercent) * totalCents
    const floor = Math.floor(exact)
    return {
      userId: entry.userId,
      shareCents: floor,
      remainder: exact - floor,
    }
  })

  let assigned = weighted.reduce((sum, entry) => sum + entry.shareCents, 0)
  const byRemainder = [...weighted].sort((left, right) => right.remainder - left.remainder)

  for (const entry of byRemainder) {
    if (assigned >= totalCents) {
      break
    }
    entry.shareCents += 1
    assigned += 1
  }

  return weighted.map((entry) => ({ userId: entry.userId, shareCents: entry.shareCents }))
}

export function parseAmountToCents(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null
  }

  return Math.round(parsed * 100)
}

export function formatCentsAsAmount(shareCents: number): string {
  return (shareCents / 100).toFixed(2)
}

export function sharesAreEqual(totalCents: number, shares: BillShareDraft[]): boolean {
  if (shares.length === 0) {
    return false
  }

  const participantIds = shares.map((share) => share.userId)
  const expected = equalShareCents(totalCents, participantIds)
  const expectedMap = new Map(expected.map((share) => [share.userId, share.shareCents]))

  return shares.every((share) => expectedMap.get(share.userId) === share.shareCents)
}

export function inferPercentMode(shares: BillShareDraft[], totalCents: number): boolean {
  if (totalCents <= 0 || shares.length === 0) {
    return false
  }

  const percents = shares.map((share) =>
    Math.round((share.shareCents / totalCents) * 100),
  )
  const reconstructed = allocateFromPercents(
    totalCents,
    shares.map((share, index) => ({ userId: share.userId, percent: percents[index] ?? 0 })),
  )

  return reconstructed.every(
    (share, index) => share.shareCents === shares[index]?.shareCents,
  )
}

export function buildSharesFromMemberState(options: {
  totalCents: number;
  splitKind: SplitKind;
  customMode: CustomSplitMode;
  members: MemberSplitState[];
}): { shares?: BillShareDraft[]; error: string | null } {
  const { totalCents, splitKind, customMode, members } = options
  const included = members.filter((member) => member.included)

  if (included.length === 0) {
    return { error: 'Include at least one person in the split.' }
  }

  if (splitKind === 'equal') {
    const allIncluded = included.length === members.length
    if (allIncluded) {
      return { shares: undefined, error: null }
    }

    return {
      shares: equalShareCents(
        totalCents,
        included.map((member) => member.user.id),
      ),
      error: null,
    }
  }

  if (customMode === 'amount') {
    const shares: BillShareDraft[] = []
    let sum = 0

    for (const member of included) {
      const shareCents = parseAmountToCents(member.amount)
      if (shareCents === null) {
        return { error: `Enter a valid amount for ${member.user.name ?? member.user.email}.` }
      }
      shares.push({ userId: member.user.id, shareCents })
      sum += shareCents
    }

    if (sum !== totalCents) {
      return { error: 'Custom amounts must add up to the bill total.' }
    }

    return { shares, error: null }
  }

  const percentEntries = included.map((member) => ({
    userId: member.user.id,
    percent: Number(member.percent),
  }))

  if (percentEntries.some((entry) => !Number.isFinite(entry.percent) || entry.percent < 0)) {
    return { error: 'Enter a valid percentage for each included person.' }
  }

  const percentTotal = percentEntries.reduce((sum, entry) => sum + entry.percent, 0)
  if (Math.abs(percentTotal - 100) > 0.01) {
    return { error: 'Percentages must add up to 100%.' }
  }

  return { shares: allocateFromPercents(totalCents, percentEntries), error: null }
}

export function initializeMemberState(
  participants: User[],
  options?: {
    existingShares?: BillShareDraft[];
    totalCents?: number;
    splitKind?: SplitKind;
    customMode?: CustomSplitMode;
  },
): { members: MemberSplitState[]; splitKind: SplitKind; customMode: CustomSplitMode } {
  const shareMap = new Map(
    (options?.existingShares ?? []).map((share) => [share.userId, share.shareCents]),
  )
  const totalCents = options?.totalCents ?? 0
  const existingShares = options?.existingShares ?? []
  const allIncluded =
    existingShares.length > 0 &&
    participants.every((participant) => shareMap.has(participant.id))

  let splitKind: SplitKind = options?.splitKind ?? 'equal'
  let customMode: CustomSplitMode = options?.customMode ?? 'amount'

  if (existingShares.length > 0 && !options?.splitKind) {
    if (sharesAreEqual(totalCents, existingShares) && allIncluded) {
      splitKind = 'equal'
    } else {
      splitKind = 'custom'
      customMode = inferPercentMode(existingShares, totalCents) ? 'percent' : 'amount'
    }
  }

  const members = participants.map((user) => {
    const included = shareMap.size > 0 ? shareMap.has(user.id) : true
    const shareCents = shareMap.get(user.id)
    const amount =
      shareCents !== undefined ? formatCentsAsAmount(shareCents) : ''
    const percent =
      shareCents !== undefined && totalCents > 0
        ? String(Math.round((shareCents / totalCents) * 100))
        : ''

    return {
      user,
      included,
      amount,
      percent,
    }
  })

  return { members, splitKind, customMode }
}

export function syncEqualMemberAmounts(
  members: MemberSplitState[],
  totalCents: number,
): MemberSplitState[] {
  const includedIds = members.filter((member) => member.included).map((member) => member.user.id)
  const shares = equalShareCents(totalCents, includedIds)
  const shareMap = new Map(shares.map((share) => [share.userId, share.shareCents]))

  return members.map((member) => ({
    ...member,
    amount: member.included
      ? formatCentsAsAmount(shareMap.get(member.user.id) ?? 0)
      : '',
    percent: member.included && totalCents > 0
      ? String(Math.round(((shareMap.get(member.user.id) ?? 0) / totalCents) * 100))
      : '',
  }))
}
