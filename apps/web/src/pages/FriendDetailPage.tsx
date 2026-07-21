import * as AlertDialog from '@radix-ui/react-alert-dialog'
import * as Tabs from '@radix-ui/react-tabs'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  Plus,
  ReceiptText,
  Trash2,
  UserRound,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { settleBill } from '../api/billsApi'
import { apiErrorMessage } from '../api/client'
import { getFriendship, removeFriend, settleFriend } from '../api/friendsApi'
import { invalidateBillData, invalidatePeopleData, queryKeys } from '../api/queryClient'
import type { Bill } from '../api/types'
import { useAuth } from '../auth/useAuth'
import { RequestCard } from '../components/RequestCard'
import { useDialogFocus } from '../components/ui/useDialogFocus'
import { useToast } from '../components/ui/useToast'
import { displayName, formatCad } from '../utils/format'
import {
  friendAwaitingConfirmationCents,
  friendNetBalanceCents,
  requestItemsForFriend,
  type RequestItem,
} from '../utils/requests'
import '../styles/social.css'

export function FriendDetailPage() {
  const { friendshipId = '' } = useParams()
  const auth = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showCompleted, setShowCompleted] = useState(false)
  const [settleDialogOpen, setSettleDialogOpen] = useState(false)
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const settleDialogFocus = useDialogFocus()
  const removeDialogFocus = useDialogFocus()
  const selectedTab = searchParams.get('tab') === 'bills' ? 'bills' : 'requests'
  const friendshipQuery = useQuery({
    enabled: Boolean(friendshipId),
    queryKey: queryKeys.friend(friendshipId),
    queryFn: () => getFriendship(friendshipId),
  })

  const friendship = friendshipQuery.data
  const currentUserId = auth.user?.id ?? ''
  const allRequests = useMemo(
    () => friendship && currentUserId
      ? requestItemsForFriend({
          bills: friendship.bills,
          currentUserId,
          friendUserId: friendship.friend.id,
          includeCompleted: true,
        })
      : [],
    [currentUserId, friendship],
  )
  const visibleRequests = showCompleted
    ? allRequests
    : allRequests.filter((item) => !item.lenderConfirmedPaid)
  const balanceCents = friendNetBalanceCents(allRequests)
  const awaitingConfirmationCents = friendAwaitingConfirmationCents(allRequests)
  const completedCount = allRequests.filter((item) => item.lenderConfirmedPaid).length

  async function refreshFriend() {
    await invalidateBillData()
  }

  const requestMutation = useMutation({
    mutationFn: async (item: RequestItem) => {
      if (item.role === 'debtor') return settleBill(item.billId)
      return settleBill(item.billId, undefined, item.counterparty.id)
    },
    onSuccess: async (_, item) => {
      showToast(
        item.role === 'debtor'
          ? 'Marked as paid. Your friend still needs to confirm receipt.'
          : 'Payment confirmed.',
        'success',
      )
      await refreshFriend()
    },
    onError: (error) => showToast(apiErrorMessage(error, 'Unable to update payment status.'), 'error'),
  })
  const settleAllMutation = useMutation({
    mutationFn: () => settleFriend(friendshipId),
    onSuccess: async ({ settledCount }) => {
      setSettleDialogOpen(false)
      showToast(settledCount === 0 ? 'You are already settled up.' : 'Open requests were updated.', 'success')
      await refreshFriend()
    },
    onError: (error) => showToast(apiErrorMessage(error, 'Unable to settle up with this friend.'), 'error'),
  })
  const removeMutation = useMutation({
    mutationFn: () => removeFriend(friendshipId),
    onSuccess: async () => {
      showToast('Friend removed. Existing bill history was kept.', 'success')
      await invalidatePeopleData()
      navigate('/friends', { replace: true })
    },
    onError: (error) => showToast(apiErrorMessage(error, 'Unable to remove this friend.'), 'error'),
  })

  if (!friendshipId) return <p className="bc-error">Friend not found.</p>

  if (friendshipQuery.isPending) {
    return <section className="bc-page"><div className="bc-skeleton social-detail-skeleton" /><div className="bc-skeleton" /></section>
  }

  if (friendshipQuery.error || !friendship) {
    return (
      <section className="bc-page">
        <Link className="social-back-link" to="/friends"><ArrowLeft aria-hidden="true" size={16} />Back to people</Link>
        <div className="bc-error" role="alert">{apiErrorMessage(friendshipQuery.error, 'Unable to load friend details.')}</div>
      </section>
    )
  }

  const friendName = displayName(friendship.friend)
  const isPositive = balanceCents > 0
  const isNegative = balanceCents < 0
  const BalanceIcon = isPositive ? ArrowDownLeft : isNegative ? ArrowUpRight : CheckCircle2

  return (
    <section className="bc-page social-page">
      <Link className="social-back-link" to="/friends"><ArrowLeft aria-hidden="true" size={16} />Back to people</Link>
      <header className="social-detail-header bc-card">
        <div className="social-detail-header__person">
          <div className="social-avatar social-avatar--large">{avatarInitial(friendship.friend)}</div>
          <div><p className="bc-eyebrow">Friend since {formatShortDate(friendship.createdAt)}</p><h1>{friendName}</h1><span>{friendship.friend.email}</span></div>
        </div>
        <div className="social-detail-header__actions">
          <Link className="bc-button bc-button--primary" to={`/bills/new?friendshipId=${friendship.id}`}><Plus aria-hidden="true" size={17} />New bill</Link>
          <button className="bc-button" onClick={() => { settleDialogFocus.capture(); setSettleDialogOpen(true) }} type="button">Settle all</button>
          <button aria-label={`Remove ${friendName} as a friend`} className="bc-icon-button social-danger-icon" onClick={() => { removeDialogFocus.capture(); setRemoveDialogOpen(true) }} type="button"><Trash2 aria-hidden="true" size={17} /></button>
        </div>
        <div className="social-balance-summary">
          <div className={`social-balance-summary__primary ${isPositive ? 'is-positive' : isNegative ? 'is-negative' : ''}`}>
            <BalanceIcon aria-hidden="true" size={19} />
            <span><small>{isPositive ? 'Owed to you' : isNegative ? 'You owe' : 'Balance'}</small><strong>{balanceCents === 0 ? 'Settled up' : formatCad(Math.abs(balanceCents))}</strong></span>
          </div>
          <div><small>Open requests</small><strong>{allRequests.length - completedCount}</strong></div>
          <div><small>Awaiting confirmation</small><strong className={awaitingConfirmationCents > 0 ? 'bc-warning' : ''}>{formatCad(awaitingConfirmationCents)}</strong></div>
        </div>
      </header>

      <Tabs.Root value={selectedTab} onValueChange={(value) => setSearchParams(value === 'bills' ? { tab: 'bills' } : {})}>
      <Tabs.List aria-label="Friend detail sections" className="social-tabs">
        <Tabs.Trigger className={selectedTab === 'requests' ? 'is-active' : ''} value="requests"><Clock3 aria-hidden="true" size={18} />Requests<span>{allRequests.length}</span></Tabs.Trigger>
        <Tabs.Trigger className={selectedTab === 'bills' ? 'is-active' : ''} value="bills"><ReceiptText aria-hidden="true" size={18} />Shared bills<span>{friendship.bills.length}</span></Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content className="social-tab-panel" value={selectedTab}>

      {selectedTab === 'requests' ? (
        <section className="social-detail-section">
          <div className="social-section-heading">
            <div><h2>Requests with {friendName}</h2><p>Payment is complete only after the lender confirms receipt.</p></div>
            <button aria-pressed={showCompleted} className={`bc-button ${showCompleted ? 'bc-button--soft' : ''}`} onClick={() => setShowCompleted((current) => !current)} type="button">{showCompleted ? <EyeOff aria-hidden="true" size={16} /> : <Eye aria-hidden="true" size={16} />}{showCompleted ? 'Hide completed' : 'Show completed'}</button>
          </div>
          <div className="social-request-list">
            {visibleRequests.length === 0 ? (
              <div className="bc-empty social-empty"><CheckCircle2 aria-hidden="true" size={28} /><strong>{allRequests.length > 0 ? 'No open requests' : 'No requests yet'}</strong><p>{allRequests.length > 0 ? 'You and this friend are caught up. Show completed to review history.' : 'Requests from shared bills will appear here.'}</p></div>
            ) : visibleRequests.map((item) => (
              <RequestCard isUpdating={requestMutation.isPending && requestMutation.variables?.shareId === item.shareId} item={item} key={item.shareId} onAction={(nextItem) => requestMutation.mutate(nextItem)} />
            ))}
          </div>
        </section>
      ) : (
        <FriendBills bills={friendship.bills} />
      )}
      </Tabs.Content>
      </Tabs.Root>

      <ConfirmDialog
        actionLabel="Update all requests"
        description={`BillCompass will mark your unpaid requests to ${friendName} as paid and confirm payments you have received from ${friendName}. It does not transfer money.`}
        isPending={settleAllMutation.isPending}
        onCloseAutoFocus={settleDialogFocus.restore}
        onConfirm={() => settleAllMutation.mutate()}
        onOpenChange={setSettleDialogOpen}
        open={settleDialogOpen}
        title={`Settle up with ${friendName}?`}
      />
      <ConfirmDialog
        actionLabel="Remove friend"
        danger
        description={`${friendName} will leave your People list. Existing bills, shares, and settlement history remain unchanged for both of you.`}
        isPending={removeMutation.isPending}
        onCloseAutoFocus={removeDialogFocus.restore}
        onConfirm={() => removeMutation.mutate()}
        onOpenChange={setRemoveDialogOpen}
        open={removeDialogOpen}
        title={`Remove ${friendName}?`}
      />
    </section>
  )
}

function FriendBills({ bills }: { bills: Bill[] }) {
  return (
    <section className="bc-card social-detail-section">
      <div className="social-section-heading"><div><h2>Shared bill history</h2><p>Removing a friendship never removes these records.</p></div></div>
      {bills.length === 0 ? (
        <div className="bc-empty"><ReceiptText aria-hidden="true" size={28} /><strong>No shared bills</strong><p>Create a bill and choose this friend to get started.</p></div>
      ) : (
        <div className="social-bill-list">
          {bills.map((bill) => (
            <Link className="social-bill-row" key={bill.id} to={`/bills/${bill.id}`}>
              <div className="social-bill-row__icon"><ReceiptText aria-hidden="true" size={18} /></div>
              <div><strong>{bill.description || bill.storeName || 'Bill'}</strong><span>{formatShortDate(bill.incurredAt)} · Paid by {displayName(bill.payer)}</span></div>
              <div><small>Total</small><strong>{formatCad(bill.totalCents)}</strong></div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

function ConfirmDialog({
  actionLabel,
  danger = false,
  description,
  isPending,
  onCloseAutoFocus,
  onConfirm,
  onOpenChange,
  open,
  title,
}: {
  actionLabel: string;
  danger?: boolean;
  description: string;
  isPending: boolean;
  onCloseAutoFocus: (event: Event) => void;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}) {
  return (
    <AlertDialog.Root onOpenChange={onOpenChange} open={open}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="social-dialog-overlay" />
        <AlertDialog.Content className="social-dialog social-confirm-dialog" onCloseAutoFocus={onCloseAutoFocus}>
          <div className={`social-confirm-dialog__icon ${danger ? 'is-danger' : ''}`}><UserRound aria-hidden="true" size={27} /></div>
          <AlertDialog.Title>{title}</AlertDialog.Title>
          <AlertDialog.Description>{description}</AlertDialog.Description>
          <div className="social-dialog__actions">
            <AlertDialog.Cancel asChild><button className="bc-button" disabled={isPending} type="button">Cancel</button></AlertDialog.Cancel>
            <button className={`bc-button ${danger ? 'bc-button--danger' : 'bc-button--primary'}`} disabled={isPending} onClick={onConfirm} type="button">{isPending ? 'Updating…' : actionLabel}</button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}

function avatarInitial(user: { name: string | null; email: string }): string {
  return (user.name?.trim()[0] ?? user.email[0] ?? '?').toUpperCase()
}

function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat('en-CA', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value))
}
