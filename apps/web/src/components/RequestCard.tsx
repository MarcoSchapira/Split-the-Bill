import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  WalletCards,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { displayName, formatCad } from '../utils/format'
import {
  canActOnRequest,
  requestStatus,
  type RequestItem,
} from '../utils/requests'

export function RequestCard({
  item,
  isUpdating = false,
  onAction,
}: {
  item: RequestItem;
  isUpdating?: boolean;
  onAction: (item: RequestItem) => void;
}) {
  const status = requestStatus(item)
  const isOwed = item.direction === 'owed-to-you'
  const DirectionIcon = isOwed ? ArrowDownLeft : ArrowUpRight
  const StatusIcon = status === 'completed' ? CheckCircle2 : status === 'pending' ? Clock3 : WalletCards
  const counterpartyName = displayName(item.counterparty)
  const canAct = canActOnRequest(item)

  return (
    <article className={`social-request social-request--${status}`}>
      <div className="social-request__body">
        <div className={`social-request__direction ${isOwed ? 'is-positive' : 'is-negative'}`}>
          <DirectionIcon aria-hidden="true" size={18} />
        </div>
        <div className="social-request__copy">
          <Link className="social-request__title" to={`/bills/${item.billId}`}>
            {item.billLabel}
            <ExternalLink aria-hidden="true" size={13} />
          </Link>
          <p>{isOwed ? `${counterpartyName} owes you` : `You owe ${counterpartyName}`}</p>
          <span className="social-request__date">
            <CalendarDays aria-hidden="true" size={13} />
            {formatRequestDate(item.incurredAt)}
          </span>
        </div>
        <div className={`social-request__amount ${isOwed ? 'is-positive' : 'is-negative'}`}>
          <small>{isOwed ? 'you are owed' : 'you owe'}</small>
          <strong>{formatCad(item.amountCents)}</strong>
        </div>
      </div>

      <div className={`social-request__status social-request__status--${status}`}>
        <StatusIcon aria-hidden="true" size={20} />
        <div>
          <strong>{requestStatusTitle(item)}</strong>
          <span>{requestStatusDetail(item, counterpartyName)}</span>
        </div>
        {canAct ? (
          <button
            className={`bc-button ${item.role === 'debtor' ? 'bc-button--primary' : 'bc-button--soft'}`}
            disabled={isUpdating}
            onClick={() => onAction(item)}
            type="button"
          >
            {isUpdating ? 'Updating…' : item.role === 'debtor' ? 'Mark paid' : 'Confirm payment'}
          </button>
        ) : null}
      </div>
    </article>
  )
}

function requestStatusTitle(item: RequestItem): string {
  const status = requestStatus(item)
  if (status === 'completed') return 'Settlement complete'
  if (status === 'pending') {
    return item.role === 'debtor' ? 'Awaiting confirmation' : 'Action needed'
  }
  return item.role === 'debtor' ? 'Payment due' : 'Action needed'
}

function requestStatusDetail(item: RequestItem, counterpartyName: string): string {
  const status = requestStatus(item)
  if (status === 'completed') {
    return item.role === 'debtor'
      ? `${counterpartyName} confirmed your payment.`
      : 'You confirmed this payment.'
  }
  if (status === 'pending') {
    return item.role === 'debtor'
      ? `You marked this paid. ${counterpartyName} still needs to confirm receipt.`
      : `${counterpartyName} marked this paid. Confirm after you receive it.`
  }
  if (item.role === 'debtor') {
    return `Mark paid after you send payment. ${counterpartyName} can also confirm receipt.`
  }
  return `Confirm once you've received payment from ${counterpartyName}.`
}

function formatRequestDate(value: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value))
}
