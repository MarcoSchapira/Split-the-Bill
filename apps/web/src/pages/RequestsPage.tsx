import * as Tabs from '@radix-ui/react-tabs'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Eye,
  EyeOff,
  RefreshCw,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { listBills, settleBill } from '../api/billsApi'
import { apiErrorMessage } from '../api/client'
import { invalidateBillData, queryKeys } from '../api/queryClient'
import type { Bill } from '../api/types'
import { useAuth } from '../auth/useAuth'
import { RequestCard } from '../components/RequestCard'
import { useToast } from '../components/ui/useToast'
import { formatCad } from '../utils/format'
import {
  requestDirectionTotals,
  requestItemsFromBills,
  type RequestDirection,
  type RequestItem,
} from '../utils/requests'
import '../styles/social.css'

const EMPTY_BILLS: Bill[] = []

export function RequestsPage() {
  const auth = useAuth()
  const { showToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showCompleted, setShowCompleted] = useState(false)
  const direction: RequestDirection = searchParams.get('tab') === 'you-owe' ? 'you-owe' : 'owed-to-you'
  const billsQuery = useQuery({ queryKey: queryKeys.bills, queryFn: () => listBills() })

  const actionMutation = useMutation({
    mutationFn: async (item: RequestItem) => {
      if (item.role === 'debtor') return settleBill(item.billId)
      return settleBill(item.billId, undefined, item.counterparty.id)
    },
    onSuccess: async (_, item) => {
      showToast(
        item.role === 'debtor'
          ? 'Marked as paid. The lender still needs to confirm receipt.'
          : 'Payment confirmed. This request is now complete.',
        'success',
      )
      await invalidateBillData()
    },
    onError: (error) => showToast(apiErrorMessage(error, 'Unable to update payment status.'), 'error'),
  })

  const bills = billsQuery.data ?? EMPTY_BILLS
  const currentUserId = auth.user?.id ?? ''
  const items = useMemo(
    () => currentUserId
      ? requestItemsFromBills({
          bills,
          currentUserId,
          direction,
          includeCompleted: showCompleted,
        })
      : [],
    [bills, currentUserId, direction, showCompleted],
  )
  const totals = useMemo(
    () => currentUserId
      ? requestDirectionTotals({ bills, currentUserId, direction })
      : { totalCents: 0, pendingConfirmationCents: 0 },
    [bills, currentUserId, direction],
  )

  function selectDirection(nextDirection: RequestDirection) {
    setSearchParams(nextDirection === 'you-owe' ? { tab: 'you-owe' } : {})
  }

  const isOwed = direction === 'owed-to-you'
  const DirectionIcon = isOwed ? ArrowDownLeft : ArrowUpRight

  return (
    <section className="bc-page social-page">
      <header className="bc-page-header">
        <div className="bc-page-header__copy">
          <p className="bc-eyebrow">Payment requests</p>
          <h1 className="bc-page-title">Requests</h1>
          <p className="bc-page-subtitle">
            Track each payment from unpaid, to marked paid, to confirmed—without moving money in BillCompass.
          </p>
        </div>
        <button
          aria-pressed={showCompleted}
          className={`bc-button ${showCompleted ? 'bc-button--soft' : ''}`}
          onClick={() => setShowCompleted((current) => !current)}
          type="button"
        >
          {showCompleted ? <EyeOff aria-hidden="true" size={17} /> : <Eye aria-hidden="true" size={17} />}
          {showCompleted ? 'Hide completed' : 'Show completed'}
        </button>
      </header>

      <Tabs.Root value={direction} onValueChange={(value) => selectDirection(value as RequestDirection)}>
      <Tabs.List aria-label="Request direction" className="social-tabs">
        <Tabs.Trigger
          className={isOwed ? 'is-active' : ''}
          value="owed-to-you"
        >
          <ArrowDownLeft aria-hidden="true" size={18} />
          You are owed
        </Tabs.Trigger>
        <Tabs.Trigger
          className={!isOwed ? 'is-active' : ''}
          value="you-owe"
        >
          <ArrowUpRight aria-hidden="true" size={18} />
          You owe
        </Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content className="social-tab-panel" value={direction}>

      {billsQuery.error ? (
        <div className="bc-error social-error-row" role="alert">
          <span>{apiErrorMessage(billsQuery.error, 'Unable to load requests.')}</span>
          <button className="bc-button" onClick={() => void billsQuery.refetch()} type="button">
            <RefreshCw aria-hidden="true" size={16} />Retry
          </button>
        </div>
      ) : null}

      {billsQuery.isPending ? (
        <div className="social-request-layout">
          <div className="bc-skeleton social-total-skeleton" />
          <div className="social-request-list">
            <div className="bc-skeleton" />
            <div className="bc-skeleton" />
            <div className="bc-skeleton" />
          </div>
        </div>
      ) : (
        <div className="social-request-layout">
          <aside className={`social-total-card ${isOwed ? 'is-positive' : 'is-negative'}`}>
            <div className="social-total-card__icon">
              <DirectionIcon aria-hidden="true" size={22} />
            </div>
            <p>{isOwed ? 'You are owed' : 'You owe now'}</p>
            <strong>{formatCad(totals.totalCents)}</strong>
            <span>
              {isOwed
                ? 'Includes payments awaiting your confirmation.'
                : 'Excludes payments you already marked as paid.'}
            </span>
            {totals.pendingConfirmationCents > 0 ? (
              <div className="social-total-card__pending">
                <small>{isOwed ? 'Awaiting your confirmation' : 'Awaiting lender confirmation'}</small>
                <b>{formatCad(totals.pendingConfirmationCents)}</b>
              </div>
            ) : null}
          </aside>

          <div className="social-request-list">
            {items.length === 0 ? (
              <div className="bc-empty social-empty">
                <DirectionIcon aria-hidden="true" size={28} />
                <strong>{isOwed ? 'Nothing owed to you yet' : 'Nothing to pay right now'}</strong>
                <p>
                  {showCompleted
                    ? 'No requests match this view.'
                    : isOwed
                      ? 'When someone owes you from a shared bill, their request will appear here.'
                      : 'When you owe someone from a shared bill, their request will appear here.'}
                </p>
              </div>
            ) : items.map((item) => (
              <RequestCard
                isUpdating={actionMutation.isPending && actionMutation.variables?.shareId === item.shareId}
                item={item}
                key={item.shareId}
                onAction={(nextItem) => actionMutation.mutate(nextItem)}
              />
            ))}
          </div>
        </div>
      )}
      </Tabs.Content>
      </Tabs.Root>
    </section>
  )
}
