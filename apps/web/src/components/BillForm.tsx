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

type Target = {
  targetType: 'friendship';
  targetId: string;
}

type BillFormProps = {
  bill?: Bill;
  friends: FriendshipSummary[];
  fixedTarget?: Target;
  onCancel: () => void;
  onSaved: (bill: Bill) => void;
}

function targetValue(target: Target): string {
  return `${target.targetType}:${target.targetId}`
}

function parseTarget(value: string): Target {
  const [targetType, targetId] = value.split(':')
  return {
    targetType: targetType as 'friendship',
    targetId,
  }
}

export function BillForm({
  bill,
  fixedTarget,
  friends,
  onCancel,
  onSaved,
}: BillFormProps) {
  const auth = useAuth()
  const choices = useMemo(
    () =>
      friends.map((friendship) => ({
        ...friendship,
        kind: 'friendship' as const,
        label: displayName(friendship.friend),
      })),
    [friends],
  )

  const initialTarget =
    fixedTarget ??
    (bill && bill.targetType === 'friendship' && bill.friendshipId
      ? { targetType: 'friendship' as const, targetId: bill.friendshipId }
      : choices[0]
        ? { targetType: choices[0].kind, targetId: choices[0].id }
        : null)
  const initialPayerId = bill?.payer.id ?? auth.user?.id ?? ''

  const [selectedTarget, setSelectedTarget] = useState(
    initialTarget ? targetValue(initialTarget) : '',
  )
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
  const activeTarget =
    selectedTarget ||
    (choices[0] ? targetValue({ targetType: choices[0].kind, targetId: choices[0].id }) : '')
  const target = activeTarget ? parseTarget(activeTarget) : null

  const participants =
    target?.targetType === 'friendship' && auth.user
      ? [
          auth.user,
          ...friends
            .filter((friendship) => friendship.id === target.targetId)
            .map((friendship) => friendship.friend),
        ]
      : []

  const selectedPayerId = participants.some((participant) => participant.id === payerId)
    ? payerId
    : (participants[0]?.id ?? '')

  const totalCents = Math.round(Number(amount) * 100)
  const showMemberPanel = participants.length > 0

  const participantKey = participants.map((participant) => participant.id).join(',')
  const targetKey = target ? `${target.targetType}:${target.targetId}` : ''

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
  }, [participantKey, targetKey, bill?.id])

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

    if (!activeTarget || !Number.isInteger(totalCents) || totalCents <= 0) {
      setError('Enter a bill target and a positive amount.')
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

  if (!activeTarget) {
    return <p className="empty-state">Accept a friend before adding a bill.</p>
  }

  const targetLocked = Boolean(fixedTarget && !bill) || Boolean(bill && !bill.canRetarget)
  const readOnlyValues = splitKind === 'equal'

  return (
    <form className="stack-form bill-form" onSubmit={submit}>
      <label>
        Split with
        <select
          disabled={targetLocked}
          value={activeTarget}
          onChange={(event) => setSelectedTarget(event.target.value)}
        >
          {choices.map((choice) => (
            <option key={`${choice.kind}:${choice.id}`} value={`${choice.kind}:${choice.id}`}>
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
