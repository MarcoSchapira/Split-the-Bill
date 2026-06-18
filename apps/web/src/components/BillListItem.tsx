import type { Bill } from '../api/types'
import { Link } from 'react-router-dom'
import { displayName, formatCad } from '../utils/format'

type BillListItemProps = {
  bill: Bill;
  expanded: boolean;
  onToggleExpanded: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSettle: () => void;
};

export function BillListItem({
  bill,
  expanded,
  onToggleExpanded,
  onEdit,
  onDelete,
  onSettle,
}: BillListItemProps) {
  const shares = [...bill.shares].sort((left, right) =>
    displayName(left.user).localeCompare(displayName(right.user)),
  )
  const summary = bill.userSummary
  const showBalance = summary.direction !== 'none' && summary.amountCents > 0
  const isSettled = summary.settled
  const balanceLabel =
    summary.direction === 'owed_to_you' ? 'owes you' : summary.direction === 'you_owe' ? 'you owe' : null
  const balanceClass =
    summary.direction === 'owed_to_you'
      ? 'positive'
      : summary.direction === 'you_owe'
        ? 'negative'
        : ''

  return (
    <article className={`bill-row${expanded ? ' is-expanded' : ''}${isSettled ? ' is-settled' : ''}`}>
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
            <div className="bill-title-row">
              <strong className="bill-title">
                <Link to={`/bills/${bill.id}`}>{bill.description}</Link>
              </strong>
              {showBalance && !isSettled ? (
                <button className="text-button bill-settle-button" onClick={onSettle} type="button">
                  Settle up
                </button>
              ) : null}
            </div>
          </div>
          {showBalance ? (
            <div className={`bill-balance ${balanceClass}`}>
              <span className="bill-balance-label">{balanceLabel}</span>
              <strong className="bill-amount">{formatCad(summary.amountCents)}</strong>
            </div>
          ) : (
            <div className="bill-balance bill-balance--empty" />
          )}
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
            <div className="bill-share-total">
              <span>Total</span>
              <strong>{formatCad(bill.totalCents)}</strong>
            </div>
            <p className="bill-share-paid-by">
              Paid by {displayName(bill.payer)} on{' '}
              {new Date(bill.incurredAt).toLocaleDateString(undefined, {
                timeZone: 'UTC',
              })}
            </p>
            <p className="bill-share-breakdown-title">Split breakdown</p>
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
          </div>
        ) : null}
      </div>
    </article>
  )
}
