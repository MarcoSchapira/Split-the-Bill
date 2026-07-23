import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { deleteBill, getBill, settleBill } from '../api/billsApi'
import { apiErrorMessage } from '../api/client'
import { invalidateBillData, queryClient, queryKeys } from '../api/queryClient'
import type { BillShare } from '../api/types'
import { useAuth } from '../auth/useAuth'
import { useDialogFocus } from '../components/ui/useDialogFocus'
import { displayName, formatCad } from '../utils/format'
import '../styles/bills.css'

type ShareStatus = 'payer' | 'unpaid' | 'awaiting' | 'completed'

function shareStatus(share: BillShare, payerId: string): ShareStatus {
  if (share.user.id === payerId) return 'payer'
  if (share.lenderConfirmedPaid) return 'completed'
  if (share.payerMarkedAsPaid) return 'awaiting'
  return 'unpaid'
}

function shareStatusCopy(status: ShareStatus) {
  if (status === 'payer') return 'Paid the bill'
  if (status === 'completed') return 'Payment confirmed'
  if (status === 'awaiting') return 'Marked paid · confirmation pending'
  return 'Payment outstanding'
}

function formatQuantity(quantity: number | string) {
  const value = Number(quantity)
  if (!Number.isFinite(value)) return '—'
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/\.?0+$/, '')
}

export function BillDetailPage() {
  const { billId } = useParams()
  const auth = useAuth()
  const navigate = useNavigate()
  const billQuery = useQuery({
    queryKey: queryKeys.bill(billId ?? 'missing'),
    queryFn: () => getBill(billId!),
    enabled: Boolean(billId),
  })
  const bill = billQuery.data ?? null
  const [actionError, setActionError] = useState<string | null>(null)
  const [activeShareId, setActiveShareId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const deleteDialogFocus = useDialogFocus()

  const sortedShares = useMemo(
    () => bill
      ? [...bill.shares].sort((left, right) => {
          if (left.user.id === bill.payerId) return -1
          if (right.user.id === bill.payerId) return 1
          return displayName(left.user).localeCompare(displayName(right.user))
        })
      : [],
    [bill],
  )

  async function settleShare(share: BillShare) {
    if (!bill || !auth.user) return
    setActionError(null)
    setActiveShareId(share.id)
    try {
      const participantUserId = auth.user.id === bill.payerId ? share.user.id : undefined
      const updated = await settleBill(bill.id, undefined, participantUserId)
      queryClient.setQueryData(queryKeys.bill(bill.id), updated)
      void invalidateBillData()
    } catch (requestError) {
      setActionError(apiErrorMessage(requestError, 'Unable to update this payment.'))
    } finally {
      setActiveShareId(null)
    }
  }

  async function removeBill() {
    if (!bill) return
    setActionError(null)
    setIsDeleting(true)
    try {
      await deleteBill(bill.id)
      void invalidateBillData()
      navigate('/bills', { replace: true })
    } catch (requestError) {
      setActionError(apiErrorMessage(requestError, 'Unable to delete this bill.'))
      setIsDeleting(false)
    }
  }

  if (!billId) return <p className="form-error">Bill not found.</p>

  const hasReceiptMetadata = Boolean(
    bill && (bill.storeName || bill.storeAddress || bill.receiptNumber || bill.receiptDate || bill.receiptTime || bill.paymentMethod || bill.cardLast4),
  )
  const hasDetailedTotals = Boolean(
    bill && [bill.subtotalCents, bill.otherFeesCents, bill.taxCents, bill.tipCents].some((value) => value != null && value !== 0),
  )

  return (
    <section className="page bc-bill-detail">
      <Link className="back-link" to="/bills">Back to bills</Link>
      {billQuery.isPending ? <div className="bc-detail-skeleton"><span /><span /><span /></div> : null}
      {billQuery.error ? <div className="bc-page-error"><strong>We could not load this bill.</strong><p>{apiErrorMessage(billQuery.error, 'Unable to load this bill.')}</p><button className="secondary-button" type="button" onClick={() => void billQuery.refetch()}>Try again</button></div> : null}
      {bill ? (
        <>
          <header className="bc-detail-hero">
            <div className={`bc-detail-symbol ${bill.source}`} aria-hidden="true">{bill.source === 'capture' ? '▤' : '◇'}</div>
            <div className="bc-detail-title">
              <div className="bc-detail-kicker"><span>{bill.source === 'capture' ? 'Captured receipt' : 'Manual bill'}</span>{bill.group ? <Link to={`/groups/${bill.group.id}`}>{bill.group.name}</Link> : null}</div>
              <h1>{bill.description}</h1>
              <p>{new Date(bill.incurredAt).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })} · Paid by <strong>{displayName(bill.payer)}</strong></p>
            </div>
            <div className="bc-detail-total"><span>Total</span><strong>{formatCad(bill.totalCents)}</strong><small>{bill.shares.length} participant{bill.shares.length === 1 ? '' : 's'}</small></div>
            <div className="bc-detail-actions">
              {bill.canEdit ? <Link className="secondary-button" to={`/bills/${bill.id}/edit`}>Edit bill</Link> : null}
              {bill.canDelete ? <button className="text-button danger" disabled={isDeleting} type="button" onClick={() => { deleteDialogFocus.capture(); setDeleteOpen(true) }}>{isDeleting ? 'Deleting…' : 'Delete'}</button> : null}
            </div>
          </header>

          {actionError ? <p className="bc-save-error" role="alert">{actionError}</p> : null}

          <div className="bc-detail-layout">
            <div className="bc-detail-main">
              <section className="bc-card bc-settlement-card">
                <div className="bc-section-heading"><div><p className="eyebrow">Settlement</p><h2>Participant shares</h2></div><span className={`bc-status ${bill.userSummary.settled ? 'completed' : 'open'}`}>{bill.userSummary.settled ? 'All complete' : 'In progress'}</span></div>
                <p className="bc-section-intro">Debtors can mark payments as sent. The person who paid the bill can confirm receipt at any time.</p>
                <div className="bc-share-list">
                  {sortedShares.map((share) => {
                    const status = shareStatus(share, bill.payerId)
                    const isCurrentUser = share.user.id === auth.user?.id
                    const canMarkPaid = isCurrentUser && status === 'unpaid'
                    const canConfirm =
                      auth.user?.id === bill.payerId &&
                      (status === 'unpaid' || status === 'awaiting')
                    return (
                      <article className="bc-share-row" key={share.id}>
                        <span className="bc-avatar">{displayName(share.user).slice(0, 1).toUpperCase()}</span>
                        <div className="bc-share-person"><strong>{displayName(share.user)}{isCurrentUser ? ' (you)' : ''}</strong></div>
                        <span className={`bc-share-state ${status}`}><i />{shareStatusCopy(status)}</span>
                        <strong className="bc-share-amount">{formatCad(share.shareCents)}</strong>
                        <div className="bc-share-action">
                          {canMarkPaid ? <button className="secondary-button" disabled={activeShareId === share.id} type="button" onClick={() => void settleShare(share)}>{activeShareId === share.id ? 'Saving…' : 'Mark paid'}</button> : null}
                          {canConfirm ? <button className="primary-button compact" disabled={activeShareId === share.id} type="button" onClick={() => void settleShare(share)}>{activeShareId === share.id ? 'Saving…' : 'Confirm payment'}</button> : null}
                        </div>
                      </article>
                    )
                  })}
                </div>
              </section>

              {bill.lineItems.length > 0 ? (
                <section className="bc-card bc-detail-items">
                  <div className="bc-section-heading"><div><p className="eyebrow">Receipt</p><h2>Line items</h2></div><span className="bc-count">{bill.lineItems.length}</span></div>
                  <div className="bc-detail-item-head"><span>Item</span><span>Assigned to</span><span>Total</span></div>
                  {[...bill.lineItems].sort((left, right) => left.sortOrder - right.sortOrder).map((item) => (
                    <article className="bc-detail-item" key={item.id}>
                      <div><strong>{item.name}</strong><span>{formatQuantity(item.quantity)} × {formatCad(item.unitPriceCents)}</span></div>
                      <p>{item.assignments.length > 0 ? item.assignments.map((assignment) => displayName(assignment.user)).join(', ') : 'Split by final amounts'}</p>
                      <strong>{formatCad(item.totalPriceCents)}</strong>
                    </article>
                  ))}
                </section>
              ) : null}
            </div>

            <aside className="bc-detail-aside">
              <section className="bc-card bc-breakdown-card">
                <div className="bc-section-heading"><div><p className="eyebrow">Amounts</p><h2>Bill breakdown</h2></div></div>
                {hasDetailedTotals ? (
                  <dl className="bc-breakdown">
                    {bill.subtotalCents != null ? <div><dt>Subtotal</dt><dd>{formatCad(bill.subtotalCents)}</dd></div> : null}
                    {bill.taxCents ? <div><dt>Tax</dt><dd>{formatCad(bill.taxCents)}</dd></div> : null}
                    {bill.tipCents ? <div><dt>Tip</dt><dd>{formatCad(bill.tipCents)}</dd></div> : null}
                    {bill.otherFeesCents ? <div><dt>Other fees</dt><dd>{formatCad(bill.otherFeesCents)}</dd></div> : null}
                    <div className="total"><dt>Total</dt><dd>{formatCad(bill.totalCents)}</dd></div>
                  </dl>
                ) : <div className="bc-simple-total"><span>Final total</span><strong>{formatCad(bill.totalCents)}</strong></div>}
              </section>

              {hasReceiptMetadata ? (
                <section className="bc-card bc-merchant-card">
                  <div className="bc-section-heading"><div><p className="eyebrow">Merchant</p><h2>{bill.storeName || 'Receipt details'}</h2></div></div>
                  {bill.storeAddress ? <p className="bc-merchant-address">{bill.storeAddress}</p> : null}
                  <dl className="bc-meta-list">
                    {bill.receiptNumber ? <div><dt>Receipt number</dt><dd>{bill.receiptNumber}</dd></div> : null}
                    {bill.receiptDate ? <div><dt>Receipt date</dt><dd>{bill.receiptDate}</dd></div> : null}
                    {bill.receiptTime ? <div><dt>Receipt time</dt><dd>{bill.receiptTime}</dd></div> : null}
                    {bill.paymentMethod ? <div><dt>Payment</dt><dd>{bill.paymentMethod}{bill.cardLast4 ? ` ···· ${bill.cardLast4}` : ''}</dd></div> : bill.cardLast4 ? <div><dt>Card</dt><dd>···· {bill.cardLast4}</dd></div> : null}
                  </dl>
                </section>
              ) : null}

              <section className="bc-card bc-audit-card">
                <div className="bc-section-heading"><div><p className="eyebrow">Record</p><h2>Bill history</h2></div></div>
                <dl className="bc-meta-list">
                  <div><dt>Created by</dt><dd>{displayName(bill.creator)}</dd></div>
                  <div><dt>Created</dt><dd>{new Date(bill.createdAt).toLocaleString()}</dd></div>
                  <div><dt>Last edited</dt><dd>{new Date(bill.lastEditedAt).toLocaleString()}</dd></div>
                </dl>
              </section>
            </aside>
          </div>
        </>
      ) : null}
      <AlertDialog.Root onOpenChange={setDeleteOpen} open={deleteOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="modal-backdrop" />
          <AlertDialog.Content className="modal-card" onCloseAutoFocus={deleteDialogFocus.restore}>
            <AlertDialog.Title>Delete {bill?.description ?? 'this bill'}?</AlertDialog.Title>
            <AlertDialog.Description>This permanently removes the bill for every participant and cannot be undone.</AlertDialog.Description>
            <div className="bc-dialog-actions">
              <AlertDialog.Cancel asChild><button className="bc-button" disabled={isDeleting} type="button">Cancel</button></AlertDialog.Cancel>
              <button className="bc-button bc-button--danger" disabled={isDeleting} onClick={() => void removeBill()} type="button">{isDeleting ? 'Deleting…' : 'Delete permanently'}</button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </section>
  )
}
