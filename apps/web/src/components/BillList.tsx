import { useState } from 'react'
import { deleteBill } from '../api/billsApi'
import { apiErrorMessage } from '../api/client'
import type { Bill, FriendshipSummary, GroupSummary } from '../api/types'
import { BillForm } from './BillForm'
import { Modal } from './Modal'
import { notifyDataChanged } from '../utils/events'
import { displayName, formatCad } from '../utils/format'

type BillListProps = {
  bills: Bill[];
  friends: FriendshipSummary[];
  groups: GroupSummary[];
  onChanged: () => void;
}

export function BillList({ bills, friends, groups, onChanged }: BillListProps) {
  const [editing, setEditing] = useState<Bill | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function remove(bill: Bill) {
    if (!window.confirm(`Delete "${bill.description}"?`)) {
      return
    }

    setError(null)
    try {
      await deleteBill(bill.id)
      notifyDataChanged()
      onChanged()
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Unable to delete bill.'))
    }
  }

  if (bills.length === 0) {
    return <p className="empty-state">No bills recorded here yet.</p>
  }

  return (
    <>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="bill-list">
        {bills.map((bill) => (
          <article className="bill-row" key={bill.id}>
            <div className="bill-details">
              <strong>{bill.description}</strong>
              <span>
                Paid by {displayName(bill.payer)} on{' '}
                {new Date(bill.incurredAt).toLocaleDateString(undefined, {
                  timeZone: 'UTC',
                })}
              </span>
            </div>
            <strong className="bill-amount">{formatCad(bill.totalCents)}</strong>
            <div className="inline-actions">
              {bill.canEdit ? (
                <button className="text-button" onClick={() => setEditing(bill)} type="button">
                  Edit
                </button>
              ) : null}
              {bill.canDelete ? (
                <button className="text-button danger" onClick={() => void remove(bill)} type="button">
                  Delete
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
      {editing ? (
        <Modal onClose={() => setEditing(null)} title="Edit bill">
          <BillForm
            bill={editing}
            friends={friends}
            groups={groups}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null)
              onChanged()
            }}
          />
        </Modal>
      ) : null}
    </>
  )
}
