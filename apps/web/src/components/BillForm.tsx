import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { createBill, updateBill } from '../api/billsApi'
import { apiErrorMessage } from '../api/client'
import { getGroup } from '../api/groupsApi'
import type { Bill, FriendshipSummary, GroupSummary, User } from '../api/types'
import { useAuth } from '../auth/useAuth'
import { notifyDataChanged } from '../utils/events'
import { displayName } from '../utils/format'

type Target = {
  targetType: 'friendship' | 'group';
  targetId: string;
}

type BillFormProps = {
  bill?: Bill;
  friends: FriendshipSummary[];
  groups: GroupSummary[];
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
    targetType: targetType as 'friendship' | 'group',
    targetId,
  }
}

export function BillForm({
  bill,
  fixedTarget,
  friends,
  groups,
  onCancel,
  onSaved,
}: BillFormProps) {
  const auth = useAuth()
  const choices = useMemo(
    () => [
      ...friends.map((friendship) => ({
        ...friendship,
        kind: 'friendship' as const,
        label: displayName(friendship.friend),
      })),
      ...groups.map((group) => ({
        ...group,
        kind: 'group' as const,
        label: group.name,
      })),
    ],
    [friends, groups],
  )
  const initialTarget =
    fixedTarget ??
    (bill
      ? {
          targetType: bill.targetType,
          targetId: (bill.friendshipId ?? bill.groupId) as string,
        }
      : choices[0]
        ? { targetType: choices[0].kind, targetId: choices[0].id }
        : null)
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
  const [payerId, setPayerId] = useState(bill?.payer.id ?? auth.user?.id ?? '')
  const [loadedGroup, setLoadedGroup] = useState<{ id: string; users: User[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const activeTarget =
    selectedTarget ||
    (choices[0] ? targetValue({ targetType: choices[0].kind, targetId: choices[0].id }) : '')

  useEffect(() => {
    if (!activeTarget || parseTarget(activeTarget).targetType !== 'group') {
      return
    }

    const target = parseTarget(activeTarget)
    let isActive = true
    void getGroup(target.targetId)
      .then((group) => {
        if (isActive) {
          setLoadedGroup({
            id: target.targetId,
            users: group.members.map((member) => member.user),
          })
        }
      })
      .catch((requestError) => {
        if (isActive) {
          setError(apiErrorMessage(requestError, 'Unable to load group members.'))
        }
      })

    return () => {
      isActive = false
    }
  }, [activeTarget])

  const target = activeTarget ? parseTarget(activeTarget) : null
  const participants =
    target?.targetType === 'friendship' && auth.user
      ? [
          auth.user,
          ...friends
            .filter((friendship) => friendship.id === target.targetId)
            .map((friendship) => friendship.friend),
        ]
      : target?.targetType === 'group' && loadedGroup?.id === target.targetId
        ? loadedGroup.users
        : []
  const selectedPayerId = participants.some((participant) => participant.id === payerId)
    ? payerId
    : (participants[0]?.id ?? '')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const totalCents = Math.round(Number(amount) * 100)
    if (!activeTarget || !Number.isInteger(totalCents) || totalCents <= 0) {
      setError('Enter a bill target and a positive amount.')
      return
    }

    const target = parseTarget(activeTarget)
    const input = {
      description,
      incurredAt: date,
      totalCents,
      targetType: target.targetType,
      targetId: target.targetId,
      payerId: selectedPayerId,
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
    return <p className="empty-state">Accept a friend or join a group before adding a bill.</p>
  }

  const targetLocked = Boolean(fixedTarget && !bill) || Boolean(bill && !bill.canRetarget)

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
              {choice.kind === 'group' ? 'Group: ' : 'Friend: '}
              {choice.label}
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
      {error ? <p className="form-error">{error}</p> : null}
      <div className="dialog-actions">
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
