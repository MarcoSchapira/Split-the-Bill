import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getBill } from '../api/billsApi'
import { apiErrorMessage } from '../api/client'
import type { Bill } from '../api/types'
import { DATA_CHANGED_EVENT } from '../utils/events'
import { displayName, formatCad } from '../utils/format'

function formatQuantity(quantity: number) {
  return Number.isInteger(quantity) ? quantity.toString() : quantity.toFixed(3).replace(/\.?0+$/, '')
}

export function BillDetailPage() {
  const { billId } = useParams()
  const [bill, setBill] = useState<Bill | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  if (!billId) {
    return <p className="form-error">Bill not found.</p>
  }

  return (
    <section className="page">
      <Link className="back-link" to="/bills">
        Back to bills
      </Link>
      {error ? <p className="form-error">{error}</p> : null}
      {bill ? (
        <>
          <header className="page-header">
            <div>
              <p className="eyebrow">{bill.source === 'capture' ? 'Captured receipt' : 'Manual bill'}</p>
              <h1>{bill.description}</h1>
              <p>{new Date(bill.incurredAt).toLocaleDateString()}</p>
            </div>
            <strong>{formatCad(bill.totalCents)}</strong>
          </header>

          <section className="panel">
            <h2>Bill details</h2>
            <p className="muted">Paid by {displayName(bill.payer)}</p>
            {bill.storeName || bill.receiptDate || bill.paymentMethod ? (
              <dl className="bill-meta">
                {bill.storeName ? (
                  <>
                    <dt>Store</dt>
                    <dd>{bill.storeName}</dd>
                  </>
                ) : null}
                {bill.storeAddress ? (
                  <>
                    <dt>Address</dt>
                    <dd>{bill.storeAddress}</dd>
                  </>
                ) : null}
                {bill.receiptNumber ? (
                  <>
                    <dt>Receipt number</dt>
                    <dd>{bill.receiptNumber}</dd>
                  </>
                ) : null}
                {bill.receiptDate ? (
                  <>
                    <dt>Receipt date</dt>
                    <dd>{bill.receiptDate}</dd>
                  </>
                ) : null}
                {bill.receiptTime ? (
                  <>
                    <dt>Receipt time</dt>
                    <dd>{bill.receiptTime}</dd>
                  </>
                ) : null}
                {bill.paymentMethod ? (
                  <>
                    <dt>Payment</dt>
                    <dd>
                      {bill.paymentMethod}
                      {bill.cardLast4 ? ` •••• ${bill.cardLast4}` : ''}
                    </dd>
                  </>
                ) : null}
              </dl>
            ) : null}
          </section>

          {bill.lineItems.length > 0 ? (
            <section className="panel">
              <div className="panel-title">
                <h2>Receipt items</h2>
                <span className="count-pill">{bill.lineItems.length}</span>
              </div>
              <ul className="bill-share-lines">
                {bill.lineItems.map((item) => (
                  <li className="bill-share-line" key={item.id}>
                    <span>
                      <strong>{item.name}</strong>
                      <span className="muted">
                        {' '}
                        ({formatQuantity(item.quantity)} × {formatCad(item.unitPriceCents)})
                      </span>
                      <br />
                      <small className="muted">
                        Assigned to{' '}
                        {item.assignments.map((assignment) => displayName(assignment.user)).join(', ')}
                      </small>
                    </span>
                    <span className="bill-share-amount">{formatCad(item.totalPriceCents)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="panel">
            <h2>Split summary</h2>
            <ul className="bill-share-lines">
              {bill.shares.map((share) => (
                <li className="bill-share-line" key={share.id}>
                  <span>{displayName(share.user)}</span>
                  <span className="bill-share-amount">{formatCad(share.shareCents)}</span>
                </li>
              ))}
            </ul>
            <p className="muted">
              Subtotal {formatCad(bill.subtotalCents ?? 0)} · Tax {formatCad(bill.taxCents ?? 0)} · Tip{' '}
              {formatCad(bill.tipCents ?? 0)}
            </p>
          </section>
        </>
      ) : null}
    </section>
  )
}
