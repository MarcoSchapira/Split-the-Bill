import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { createBill, updateBill } from '../api/billsApi'
import type { Bill, FriendshipSummary } from '../api/types'
import { useAuth } from '../auth/useAuth'
import { apiErrorMessage } from '../api/client'
import {
  buildSharesFromMemberState,
  initializeMemberState,
  syncEqualMemberAmounts,
  type CustomSplitMode,
  type MemberSplitState,
  type SplitKind,
} from '../utils/billSplit'
import { notifyDataChanged } from '../utils/events'
import { displayName } from '../utils/format'
import { BillSplitMemberList } from './BillSplitMemberList'
import { SplitControls } from './SplitControls'

type BillFormProps = {
  bill?: Bill;
  friends: FriendshipSummary[];
  fixedFriend?: FriendshipSummary;
  onCancel: () => void;
  onSaved: (bill: Bill) => void;
}

function friendshipIdForBill(
  bill: Bill,
  friends: FriendshipSummary[],
  currentUserId: string,
): string | null {
  const otherParticipantIds = bill.shares
    .map((share) => share.user.id)
    .filter((id) => id !== currentUserId)

  if (otherParticipantIds.length !== 1) {
    return null
  }

  return friends.find((friendship) => friendship.friend.id === otherParticipantIds[0])?.id ?? null
}

export function BillForm({
  bill,
  fixedFriend,
  friends,
  onCancel,
  onSaved,
}: BillFormProps) {
  const auth = useAuth()
  const choices = useMemo(
    () =>
      friends.map((friendship) => ({
        ...friendship,
        label: displayName(friendship.friend),
      })),
    [friends],
  )

  const initialFriendshipId =
    fixedFriend?.id ??
    (bill && auth.user
      ? friendshipIdForBill(bill, friends, auth.user.id) ?? choices[0]?.id ?? null
      : choices[0]?.id ?? null)
  const initialPayerId = bill?.payer.id ?? auth.user?.id ?? ''

  const [selectedFriendshipId, setSelectedFriendshipId] = useState(initialFriendshipId ?? '')
  const [description, setDescription] = useState(bill?.description ?? '')
  const [date, setDate] = useState(
    bill?.incurredAt.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
  )
  const [amount, setAmount] = useState(
    bill ? (bill.totalCents / 100).toFixed(2) : '',
  )
  const [payerId, setPayerId] = useState(initialPayerId)
  const [splitKind, setSplitKind] = useState<SplitKind>('equal')
  const [customMode, setCustomMode] = useState<CustomSplitMode>('amount')
  const [members, setMembers] = useState<MemberSplitState[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const activeFriendshipId = selectedFriendshipId || choices[0]?.id || ''

  const participants =
    activeFriendshipId && auth.user
      ? [
          auth.user,
          ...friends
            .filter((friendship) => friendship.id === activeFriendshipId)
            .map((friendship) => friendship.friend),
        ]
      : []

  const selectedPayerId = participants.some((participant) => participant.id === payerId)
    ? payerId
    : (participants[0]?.id ?? '')

  const totalCents = Math.round(Number(amount) * 100)
  const showMemberPanel = participants.length > 0

  const participantKey = participants.map((participant) => participant.id).join(',')

  useEffect(() => {
    if (participants.length === 0) {
      setMembers([])
      return
    }

    const existingShares = bill
      ? bill.shares.map((share) => ({
          userId: share.user.id,
          shareCents: share.shareCents,
        }))
      : undefined
    const isSameBillContext =
      bill &&
      participants.length > 0 &&
      bill.shares.length === participants.length &&
      participants.every((participant) =>
        bill.shares.some((share) => share.user.id === participant.id),
      )

    const initialized = initializeMemberState(participants, {
      existingShares: isSameBillContext ? existingShares : undefined,
      totalCents: isSameBillContext ? bill.totalCents : totalCents > 0 ? totalCents : 0,
    })

    setSplitKind(initialized.splitKind)
    setCustomMode(initialized.customMode)
    setMembers(
      initialized.splitKind === 'equal' && totalCents > 0
        ? syncEqualMemberAmounts(initialized.members, totalCents)
        : initialized.members,
    )
  }, [participantKey, activeFriendshipId, bill?.id])

  useEffect(() => {
    if (splitKind !== 'equal' || totalCents <= 0 || members.length === 0) {
      return
    }

    setMembers((current) => syncEqualMemberAmounts(current, totalCents))
  }, [amount, splitKind, participantKey])

  function updateMember(userId: string, patch: Partial<MemberSplitState>) {
    setMembers((current) =>
      current.map((member) =>
        member.user.id === userId ? { ...member, ...patch } : member,
      ),
    )
  }

  function toggleIncluded(userId: string) {
    setMembers((current) => {
      const next = current.map((member) =>
        member.user.id === userId ? { ...member, included: !member.included } : member,
      )
      return splitKind === 'equal' && totalCents > 0
        ? syncEqualMemberAmounts(next, totalCents)
        : next
    })
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!activeFriendshipId || !Number.isInteger(totalCents) || totalCents <= 0) {
      setError('Select a friend and enter a positive amount.')
      return
    }

    const shareResult = buildSharesFromMemberState({
      totalCents,
      splitKind,
      customMode,
      members,
    })

    if (shareResult.error) {
      setError(shareResult.error)
      return
    }

    const includedParticipantIds = members
      .filter((member) => member.included)
      .map((member) => member.user.id)
    if (includedParticipantIds.length === 0) {
      setError('Include at least one participant.')
      return
    }

    const input = {
      description,
      incurredAt: date,
      totalCents,
      source: bill?.source ?? 'manual',
      participantIds: includedParticipantIds,
      payerId: selectedPayerId,
      ...(shareResult.shares ? { shares: shareResult.shares } : {}),
    }
    setIsSaving(true)

    try {
      const saved = bill ? await updateBill(bill.id, input) : await createBill(input)
      notifyDataChanged()
      onSaved(saved)
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Unable to save bill.'))
    } finally {
      setIsSaving(false)
    }
  }

  if (!activeFriendshipId) {
    return <p className="empty-state">Accept a friend before adding a bill.</p>
  }

  const friendLocked = Boolean(fixedFriend && !bill) || Boolean(bill && !bill.canRetarget)
  const readOnlyValues = splitKind === 'equal'

  return (
    <form className="stack-form bill-form" onSubmit={submit}>
      <label>
        Split with
        <select
          disabled={friendLocked}
          value={activeFriendshipId}
          onChange={(event) => setSelectedFriendshipId(event.target.value)}
        >
          {choices.map((choice) => (
            <option key={choice.id} value={choice.id}>
              Friend: {choice.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Description
        <input
          maxLength={120}
          required
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <div className="form-row">
        <label>
          Amount (CAD)
          <input
            min="0.01"
            required
            step="0.01"
            type="number"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        <label>
          Date
          <input required type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
      </div>
      <label>
        Paid by
        <select required value={selectedPayerId} onChange={(event) => setPayerId(event.target.value)}>
          {participants.map((participant) => (
            <option key={participant.id} value={participant.id}>
              {displayName(participant)}
            </option>
          ))}
        </select>
      </label>
      <SplitControls
        customMode={customMode}
        splitKind={splitKind}
        onCustomModeChange={setCustomMode}
        onSplitKindChange={setSplitKind}
      />
      {showMemberPanel ? (
        <section className="bill-split-panel">
          <h3>Who shares this bill?</h3>
          <BillSplitMemberList
            customMode={customMode}
            members={members}
            payerId={selectedPayerId}
            readOnlyValues={readOnlyValues}
            splitKind={splitKind}
            onAmountChange={(userId, value) => updateMember(userId, { amount: value })}
            onPercentChange={(userId, value) => updateMember(userId, { percent: value })}
            onToggleIncluded={toggleIncluded}
          />
        </section>
      ) : null}
      {error ? <p className="form-error">{error}</p> : null}
      <div className="dialog-actions bill-form-actions">
        <button className="quiet-button" onClick={onCancel} type="button">
          Cancel
        </button>
        <button className="primary-button compact" disabled={isSaving} type="submit">
          {isSaving ? 'Saving...' : bill ? 'Save changes' : 'Add bill'}
        </button>
      </div>
    </form>
  )
}
