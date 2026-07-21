import { deleteBill, settleBill } from '../api/billsApi'
import { apiErrorMessage } from '../api/client'
import { invalidateBillData } from '../api/queryClient'
import type { Bill, FriendshipSummary, PairwiseSummary, User } from '../api/types'
import { BillListItem } from './BillListItem'
import { useState } from 'react'

type BillListBill = Bill & { pairwise?: PairwiseSummary };

type BillListProps = {
  bills: BillListBill[];
  friends: FriendshipSummary[];
  friend?: User;
  emptyMessage?: string;
  onChanged: () => void;
}

export function BillList({
  bills,
  friend,
  emptyMessage = 'No bills recorded here yet.',
  onChanged,
}: BillListProps) {
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
      void invalidateBillData()
      onChanged()
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Unable to delete bill.'))
    }
  }

  async function settle(bill: BillListBill) {
    setError(null)
    try {
      await settleBill(bill.id, friend?.id)
      void invalidateBillData()
      onChanged()
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Unable to settle this bill.'))
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
            key={bill.id}
            onDelete={() => void remove(bill)}
            onSettle={() => void settle(bill)}
            onToggleExpanded={() => toggleExpanded(bill.id)}
          />
        ))}
      </div>
    </>
  )
}
