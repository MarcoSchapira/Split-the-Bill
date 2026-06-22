import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getBill } from '../api/billsApi'
import { apiErrorMessage } from '../api/client'
import type { Bill } from '../api/types'
import { DATA_CHANGED_EVENT } from '../utils/events'
import { displayName, formatCad } from '../utils/format'

function formatQuantity(quantity: number | string) {
  const numericQuantity =
    typeof quantity === 'number' ? quantity : Number.parseFloat(quantity)

  if (!Number.isFinite(numericQuantity)) {
    return String(quantity)
  }

  return Number.isInteger(numericQuantity)
    ? numericQuantity.toString()
    : numericQuantity.toFixed(3).replace(/\.?0+$/, '')
}

type ParticipantGroup = {
  userId: string;
  name: string;
  shareCents: number;
  isPayer: boolean;
  items: Bill['lineItems'];
  itemsSubtotalCents: number;
}

type ReceiptMetaField = {
  icon: 'location' | 'hash' | 'calendar' | 'clock' | 'payment';
  label: string;
  value: string;
}

function ReceiptIcon({ name }: { name: ReceiptMetaField['icon'] | 'store' | 'user' }) {
  const icons: Record<typeof name, ReactNode> = {
    store: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
      </svg>
    ),
    location: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11Z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
    ),
    hash: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M9 4 7 20M17 4l-2 16M4 9h16M3 15h16" />
      </svg>
    ),
    calendar: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect height="17" rx="2" width="18" x="3" y="5" />
        <path d="M8 3v4M16 3v4M3 10h18" />
      </svg>
    ),
    clock: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 8v4.5l3 2" />
      </svg>
    ),
    payment: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect height="14" rx="2.5" width="18" x="3" y="5" />
        <path d="M3 10h18M7 15h4" />
      </svg>
    ),
    user: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5.5 19.5c1.4-3.2 3.8-4.8 6.5-4.8s5.1 1.6 6.5 4.8" />
      </svg>
    ),
  }

  return <span className="receipt-icon">{icons[name]}</span>
}

export function BillDetailPage() {
  const { billId } = useParams()
  const [bill, setBill] = useState<Bill | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedParticipantIds, setExpandedParticipantIds] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    if (!billId) {
      return
    }

    try {
      setBill(await getBill(billId))
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Unable to load bill details.'))
    }
  }, [billId])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0)
    const reload = () => void load()
    window.addEventListener(DATA_CHANGED_EVENT, reload)
    return () => {
      window.clearTimeout(initialLoad)
      window.removeEventListener(DATA_CHANGED_EVENT, reload)
    }
  }, [load])

  const participants = useMemo<ParticipantGroup[]>(() => {
    if (!bill) {
      return []
    }

    const groupedByUserId = new Map<string, ParticipantGroup>()
    for (const share of bill.shares) {
      groupedByUserId.set(share.user.id, {
        userId: share.user.id,
        name: displayName(share.user),
        shareCents: share.shareCents,
        isPayer: share.user.id === bill.payerId,
        items: [],
        itemsSubtotalCents: 0,
      })
    }

    for (const item of bill.lineItems) {
      const assignedUserIds = item.assignments.map((assignment) => assignment.user.id)
      for (const assignedUserId of assignedUserIds) {
        const group = groupedByUserId.get(assignedUserId)
        if (!group) {
          continue
        }
        group.items.push(item)
        group.itemsSubtotalCents += item.totalPriceCents
      }
    }

    return [...groupedByUserId.values()].sort((left, right) => {
      if (left.isPayer && !right.isPayer) return -1
      if (!left.isPayer && right.isPayer) return 1
      return right.shareCents - left.shareCents
    })
  }, [bill])

  const receiptMetaFields = useMemo<ReceiptMetaField[]>(() => {
    if (!bill) {
      return []
    }

    const fields: ReceiptMetaField[] = []

    if (bill.storeAddress && !bill.storeName) {
      fields.push({ icon: 'location', label: 'Address', value: bill.storeAddress })
    }
    if (bill.receiptNumber) {
      fields.push({ icon: 'hash', label: 'Receipt number', value: bill.receiptNumber })
    }
    if (bill.receiptDate) {
      fields.push({ icon: 'calendar', label: 'Receipt date', value: bill.receiptDate })
    }
    if (bill.receiptTime) {
      fields.push({ icon: 'clock', label: 'Receipt time', value: bill.receiptTime })
    }
    if (bill.paymentMethod) {
      fields.push({
        icon: 'payment',
        label: 'Payment',
        value: `${bill.paymentMethod}${bill.cardLast4 ? ` •••• ${bill.cardLast4}` : ''}`,
      })
    }

    return fields
  }, [bill])

  useEffect(() => {
    if (!participants.length) {
      setExpandedParticipantIds(new Set())
      return
    }

    const defaultExpanded =
      participants.length > 2
        ? new Set(participants.filter((participant) => participant.isPayer).map((participant) => participant.userId))
        : new Set(participants.map((participant) => participant.userId))
    setExpandedParticipantIds(defaultExpanded)
  }, [participants])

  function toggleParticipant(userId: string) {
    setExpandedParticipantIds((current) => {
      const next = new Set(current)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }

  if (!billId) {
    return <p className="form-error">Bill not found.</p>
  }

  return (
    <section className="page bill-detail-page">
      <Link className="back-link" to="/bills">
        Back to bills
      </Link>
      {error ? <p className="form-error">{error}</p> : null}
      {bill ? (
        <>
          <header className="page-header bill-detail-header">
            <div>
              <p className="eyebrow">{bill.source === 'capture' ? 'Captured receipt' : 'Manual bill'}</p>
              <h1>{bill.description}</h1>
              <p className="bill-detail-date">
                {new Date(bill.incurredAt).toLocaleDateString(undefined, {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  timeZone: 'UTC',
                })}
              </p>
            </div>
            <div className="bill-detail-amount-card">
              <span>Total</span>
              <strong>{formatCad(bill.totalCents)}</strong>
            </div>
          </header>

          <section className="panel bill-split-panel">
            <div className="panel-title">
              <h2>Split by person</h2>
              <span className="count-pill">{participants.length}</span>
            </div>
            <p className="muted bill-split-intro">
              Share amounts are final; assigned items are supporting details.
            </p>
            <div className="person-split-list">
              {participants.map((participant) => {
                const expanded = expandedParticipantIds.has(participant.userId)
                const deltaCents = participant.shareCents - participant.itemsSubtotalCents
                return (
                  <article
                    className={`person-split-card${expanded ? ' is-expanded' : ''}${participant.isPayer ? ' is-payer' : ''}`}
                    key={participant.userId}
                  >
                    <button
                      aria-expanded={expanded}
                      className="person-split-toggle"
                      onClick={() => toggleParticipant(participant.userId)}
                      type="button"
                    >
                      <div className="person-split-header">
                        <div>
                          <strong>{participant.name}</strong>
                          {participant.isPayer ? <span className="person-split-badge">Paid</span> : null}
                          <p className="muted">
                            {participant.items.length > 0
                              ? `${participant.items.length} assigned item${participant.items.length === 1 ? '' : 's'}`
                              : 'No itemized assignments'}
                          </p>
                        </div>
                        <div className="person-split-amount">
                          <strong>{formatCad(participant.shareCents)}</strong>
                          <small>{expanded ? 'Hide items' : 'Show items'}</small>
                        </div>
                      </div>
                    </button>
                    {expanded ? (
                      <div className="person-split-items">
                        {participant.items.length > 0 ? (
                          <ul className="bill-share-lines">
                            {participant.items.map((item) => (
                              <li className="bill-share-line" key={`${participant.userId}-${item.id}`}>
                                <span>
                                  <strong>{item.name}</strong>
                                  <span className="muted">
                                    {' '}
                                    ({formatQuantity(item.quantity)} × {formatCad(item.unitPriceCents)})
                                  </span>
                                  {item.assignments.length > 1 ? (
                                    <small className="muted"> · shared with {item.assignments.length - 1} other(s)</small>
                                  ) : null}
                                </span>
                                <span className="bill-share-amount">{formatCad(item.totalPriceCents)}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="empty-state">No assigned items.</p>
                        )}
                        <p className="muted">
                          Items subtotal {formatCad(participant.itemsSubtotalCents)}
                          {deltaCents !== 0 ? (
                            <> · Final share differs by {formatCad(Math.abs(deltaCents))} due to tax/fees/tip allocation</>
                          ) : null}
                        </p>
                      </div>
                    ) : null}
                  </article>
                )
              })}
            </div>
          </section>

          <div className="bill-detail-footer">
            <section className="panel bill-totals-panel">
              <div className="panel-title">
                <h2>Bill breakdown</h2>
              </div>
              <dl className="bill-totals-lines">
                <div className="bill-totals-line">
                  <dt>Subtotal</dt>
                  <dd>{formatCad(bill.subtotalCents ?? 0)}</dd>
                </div>
                {bill.otherFeesCents && bill.otherFeesCents > 0 ? (
                  <div className="bill-totals-line">
                    <dt>Fees</dt>
                    <dd>{formatCad(bill.otherFeesCents)}</dd>
                  </div>
                ) : null}
                <div className="bill-totals-line">
                  <dt>Tax</dt>
                  <dd>{formatCad(bill.taxCents ?? 0)}</dd>
                </div>
                <div className="bill-totals-line">
                  <dt>Tip</dt>
                  <dd>{formatCad(bill.tipCents ?? 0)}</dd>
                </div>
                <div className="bill-totals-line bill-totals-line--grand">
                  <dt>Total</dt>
                  <dd>{formatCad(bill.totalCents)}</dd>
                </div>
              </dl>
            </section>

            <section className="panel bill-receipt-panel">
              {bill.storeName ? (
                <div className="bill-receipt-merchant">
                  <div className="bill-receipt-merchant-icon">
                    <ReceiptIcon name="store" />
                  </div>
                  <div>
                    <h2>{bill.storeName}</h2>
                    {bill.storeAddress ? <p>{bill.storeAddress}</p> : null}
                  </div>
                </div>
              ) : (
                <div className="panel-title">
                  <h2>Receipt details</h2>
                </div>
              )}

              <div className="bill-receipt-payer">
                <ReceiptIcon name="user" />
                <span>
                  Paid by <strong>{displayName(bill.payer)}</strong>
                </span>
              </div>

              {receiptMetaFields.length > 0 ? (
                <div className="bill-receipt-meta-grid">
                  {receiptMetaFields.map((field) => (
                    <article className="bill-receipt-meta-item" key={field.label}>
                      <ReceiptIcon name={field.icon} />
                      <div>
                        <span>{field.label}</span>
                        <strong>{field.value}</strong>
                      </div>
                    </article>
                  ))}
                </div>
              ) : !bill.storeName && !bill.receiptDate && !bill.paymentMethod ? (
                <p className="empty-state">No receipt metadata available.</p>
              ) : null}
            </section>
          </div>
        </>
      ) : null}
    </section>
  )
}
