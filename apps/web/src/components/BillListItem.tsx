import type { Bill, PairwiseSummary, User } from '../api/types'
import { displayName, formatCad } from '../utils/format'

type BillListItemProps = {
  bill: Bill;
  expanded: boolean;
  pairwise?: PairwiseSummary;
  friend?: User;
  onToggleExpanded: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export function BillListItem({
  bill,
  expanded,
  pairwise,
  friend,
  onToggleExpanded,
  onEdit,
  onDelete,
}: BillListItemProps) {
  const shares = [...bill.shares].sort((left, right) =>
    displayName(left.user).localeCompare(displayName(right.user)),
  )

  const pairwiseLabel =
    pairwise && friend
      ? pairwise.direction === 'friend_owes_you'
        ? `${displayName(friend)} owes you ${formatCad(pairwise.amountCents)}`
        : `You owe ${displayName(friend)} ${formatCad(pairwise.amountCents)}`
      : null

  return (
    <article className={`bill-row${expanded ? ' is-expanded' : ''}`}>
      <button
        aria-expanded={expanded}
        aria-label={expanded ? 'Hide split breakdown' : 'Show split breakdown'}
        className="bill-expand-toggle"
        type="button"
        onClick={onToggleExpanded}
      >
        <span aria-hidden="true" className="bill-expand-icon" />
      </button>
      <div className="bill-row-main">
        <div className="bill-row-header">
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
              <button className="text-button" onClick={onEdit} type="button">
                Edit
              </button>
            ) : null}
            {bill.canDelete ? (
              <button className="text-button danger" onClick={onDelete} type="button">
                Delete
              </button>
            ) : null}
          </div>
        </div>
        {expanded ? (
          <div className="bill-share-breakdown">
            <p className="bill-share-breakdown-title">
              {pairwise ? 'Between you' : 'Split breakdown'}
            </p>
            {pairwise && pairwiseLabel ? (
              <ul className="bill-share-lines">
                <li className="bill-share-line bill-share-line--pairwise">
                  <span className="bill-share-name">{pairwiseLabel}</span>
                </li>
              </ul>
            ) : (
              <ul className="bill-share-lines">
                {shares.map((share) => (
                  <li className="bill-share-line" key={share.id}>
                    <span className="bill-share-name">
                      {displayName(share.user)}
                      {share.user.id === bill.payerId ? (
                        <span className="bill-share-payer-tag">Paid</span>
                      ) : null}
                    </span>
                    <span className="bill-share-amount">{formatCad(share.shareCents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </article>
  )
}
