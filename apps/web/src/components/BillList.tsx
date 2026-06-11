import { useState } from 'react'
import { deleteBill } from '../api/billsApi'
import { apiErrorMessage } from '../api/client'
import type { Bill, FriendshipSummary, GroupSummary, PairwiseSummary, User } from '../api/types'
import { BillForm } from './BillForm'
import { BillListItem } from './BillListItem'
import { Modal } from './Modal'
import { notifyDataChanged } from '../utils/events'

type BillListBill = Bill & { pairwise?: PairwiseSummary };

type BillListProps = {
  bills: BillListBill[];
  friends: FriendshipSummary[];
  groups: GroupSummary[];
  friend?: User;
  emptyMessage?: string;
  onChanged: () => void;
}

export function BillList({
  bills,
  friends,
  groups,
  friend,
  emptyMessage = 'No bills recorded here yet.',
  onChanged,
}: BillListProps) {
  const [editing, setEditing] = useState<Bill | null>(null)
  const [expandedBillIds, setExpandedBillIds] = useState<Set<string>>(() => new Set())
  const [error, setError] = useState<string | null>(null)

  function toggleExpanded(billId: string) {
    setExpandedBillIds((current) => {
      const next = new Set(current)
      if (next.has(billId)) {
        next.delete(billId)
      } else {
        next.add(billId)
      }
      return next
    })
  }

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
    return <p className="empty-state">{emptyMessage}</p>
  }

  return (
    <>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="bill-list">
        {bills.map((bill) => (
          <BillListItem
            bill={bill}
            expanded={expandedBillIds.has(bill.id)}
            friend={friend}
            key={bill.id}
            pairwise={bill.pairwise}
            onDelete={() => void remove(bill)}
            onEdit={() => setEditing(bill)}
            onToggleExpanded={() => toggleExpanded(bill.id)}
          />
        ))}
      </div>
      {editing ? (
        <Modal
          onClose={() => setEditing(null)}
          size={editing.targetType === 'group' ? 'wide' : 'default'}
          title="Edit bill"
        >
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
