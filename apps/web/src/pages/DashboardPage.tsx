import { useQueries, useQuery } from '@tanstack/react-query'
import { ArrowDownLeft, ArrowUpRight, BellRing, ChevronRight, Plus, ReceiptText, Shapes, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { listActivity } from '../api/activityApi'
import { listBills } from '../api/billsApi'
import { getDashboard } from '../api/dashboardApi'
import { listFriends } from '../api/friendsApi'
import { getInvitations } from '../api/invitationsApi'
import { queryKeys } from '../api/queryClient'
import type { Bill, Dashboard, FriendshipSummary } from '../api/types'
import { useAuth } from '../auth/useAuth'
import { activityRoute } from '../utils/activityNavigation'
import { displayName, formatCad } from '../utils/format'

function LoadingRows({ count = 3 }: { count?: number }) {
  return <div className="bc-list">{Array.from({ length: count }, (_, index) => <div className="bc-skeleton" key={index} />)}</div>
}

function balanceForFriend(dashboard: Dashboard | undefined, friend: FriendshipSummary) {
  return dashboard?.balances.find((balance) => balance.user.id === friend.friend.id)?.balanceCents ?? 0
}

function outstandingActions(bills: Bill[] | undefined, userId: string | undefined) {
  if (!bills || !userId) return { confirm: 0, markPaid: 0 }
  let confirm = 0
  let markPaid = 0

  for (const bill of bills) {
    for (const share of bill.shares) {
      if (share.shareCents <= 0 || share.user.id === bill.payerId || share.lenderConfirmedPaid) continue
      if (bill.payerId === userId && share.payerMarkedAsPaid) confirm += 1
      if (share.user.id === userId && !share.payerMarkedAsPaid) markPaid += 1
    }
  }
  return { confirm, markPaid }
}

export function DashboardPage() {
  const auth = useAuth()
  const dashboardQuery = useQuery({ queryKey: queryKeys.dashboard, queryFn: getDashboard })
  const [friendsQuery, invitationsQuery, billsQuery, activityQuery] = useQueries({
    queries: [
      { queryKey: queryKeys.friends, queryFn: listFriends },
      { queryKey: queryKeys.invitations, queryFn: getInvitations },
      { queryKey: queryKeys.bills, queryFn: () => listBills() },
      { queryKey: queryKeys.activity, queryFn: listActivity },
    ],
  })

  const dashboard = dashboardQuery.data
  const friends = (friendsQuery.data ?? []) as FriendshipSummary[]
  const pendingInvitations = invitationsQuery.data?.receivedFriends.filter((invitation) => invitation.status === 'pending') ?? []
  const actions = outstandingActions(billsQuery.data, auth.user?.id)
  const actionCount = pendingInvitations.length + actions.confirm + actions.markPaid
  const friendBalancesPending = friendsQuery.isPending || dashboardQuery.isPending
  const actionsPending = billsQuery.isPending || invitationsQuery.isPending

  return (
    <section className="bc-page">
      <header className="bc-page-header">
        <div className="bc-page-header__copy">
          <p className="bc-eyebrow">Your shared ledger</p>
          <h1 className="bc-page-title">Good to see you{auth.user?.name ? `, ${auth.user.name.split(' ')[0]}` : ''}.</h1>
          <p className="bc-page-subtitle">Balances, requests, and recent changes—all in one calm place.</p>
        </div>
        <div className="bc-header-actions">
          <Link className="bc-button" to="/friends?tab=invitations"><UsersRound size={18} />Invite someone</Link>
          <Link className="bc-button bc-button--primary" to="/bills/new"><Plus size={18} />New bill</Link>
        </div>
      </header>

      {dashboardQuery.isError ? <div className="bc-error">We could not load your balance summary. Try refreshing the page.</div> : null}
      <div className="bc-grid bc-grid--3">
        {dashboardQuery.isPending ? Array.from({ length: 3 }, (_, index) => <div className="bc-card bc-skeleton bc-metric" key={index} />) : (
          <>
            <article className="bc-card bc-metric bc-metric--positive">
              <span className="bc-metric__label">You are owed</span>
              <strong className="bc-metric__value">{formatCad(dashboard?.totalOwedToYouCents ?? 0)}</strong>
              <span className="bc-metric__meta">{dashboard?.owedToYouPendingConfirmationPercent ? `${dashboard.owedToYouPendingConfirmationPercent}% awaiting confirmation` : 'No pending confirmations'}</span>
            </article>
            <article className="bc-card bc-metric bc-metric--negative">
              <span className="bc-metric__label">You owe</span>
              <strong className="bc-metric__value">{formatCad(dashboard?.totalYouOweCents ?? 0)}</strong>
              <span className="bc-metric__meta">{dashboard?.youOwePendingConfirmationPercent ? `${dashboard.youOwePendingConfirmationPercent}% marked as paid` : 'Nothing awaiting confirmation'}</span>
            </article>
            <article className="bc-card bc-metric">
              <span className="bc-metric__label">Net balance</span>
              <strong className={`bc-metric__value ${(dashboard?.netBalanceCents ?? 0) > 0 ? 'bc-positive' : (dashboard?.netBalanceCents ?? 0) < 0 ? 'bc-negative' : ''}`}>
                {formatCad(dashboard?.netBalanceCents ?? 0)}
              </strong>
              <span className="bc-metric__meta">Across friends and groups</span>
            </article>
          </>
        )}
      </div>

      <div className="bc-grid bc-grid--dashboard">
        <div className="bc-stack">
          <section className="bc-card">
            <div className="bc-card-header">
              <div>
                <p className="bc-eyebrow">People</p>
                <h2 className="bc-card-title">Friend balances</h2>
              </div>
              <Link className="bc-card-link" to="/friends">View everyone</Link>
            </div>
            {friendBalancesPending ? <LoadingRows /> : friendsQuery.isError || dashboardQuery.isError ? (
              <div className="bc-error">Friend balances are unavailable right now.</div>
            ) : friends.length === 0 ? (
              <div className="bc-empty"><UsersRound size={24} /><strong>Your people will appear here</strong><p>Invite a friend, then add a bill together.</p></div>
            ) : (
              <div className="bc-list">
                {friends
                  .slice()
                  .sort((left, right) => Math.abs(balanceForFriend(dashboard, right)) - Math.abs(balanceForFriend(dashboard, left)))
                  .map((friendship) => {
                    const balance = balanceForFriend(dashboard, friendship)
                    return (
                      <Link className="bc-list-row" key={friendship.id} to={`/friends/${friendship.id}`}>
                        <div className="bc-list-row__main"><strong>{displayName(friendship.friend)}</strong><span>{balance === 0 ? 'Settled up' : 'Friend balance'}</span></div>
                        <p className={`bc-list-row__value ${balance > 0 ? 'bc-positive' : balance < 0 ? 'bc-negative' : ''}`}>
                          {balance > 0 ? `owes you ${formatCad(balance)}` : balance < 0 ? `you owe ${formatCad(-balance)}` : 'All settled'}
                        </p>
                      </Link>
                    )
                  })}
              </div>
            )}
          </section>

          <section className="bc-card">
            <div className="bc-card-header">
              <div><p className="bc-eyebrow">Shared spaces</p><h2 className="bc-card-title">Group balances</h2></div>
              <Link className="bc-card-link" to="/groups">View groups</Link>
            </div>
            {dashboardQuery.isPending ? <LoadingRows count={2} /> : (dashboard?.groupBalances.length ?? 0) === 0 ? (
              <div className="bc-empty"><Shapes size={24} /><strong>No open group balances</strong><p>Create a group for trips, homes, or recurring shared costs.</p></div>
            ) : (
              <div className="bc-list">
                {dashboard?.groupBalances.map(({ balanceCents, group }) => (
                  <Link className="bc-list-row" key={group.id} to={`/groups/${group.id}`}>
                    <div className="bc-list-row__main"><strong>{group.name}</strong><span>{group.iconKey}</span></div>
                    <p className={`bc-list-row__value ${balanceCents > 0 ? 'bc-positive' : 'bc-negative'}`}>{balanceCents > 0 ? `owed ${formatCad(balanceCents)}` : `owe ${formatCad(-balanceCents)}`}</p>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="bc-card">
            <div className="bc-card-header"><h2 className="bc-card-title">Recent bills</h2><Link className="bc-card-link" to="/bills">All bills</Link></div>
            {billsQuery.isPending ? <LoadingRows /> : billsQuery.isError ? <div className="bc-error">Bills are unavailable right now.</div> : !billsQuery.data?.length ? (
              <div className="bc-empty"><ReceiptText size={24} /><strong>No bills yet</strong><p>Your newest expenses will show here.</p></div>
            ) : (
              <div className="bc-list">
                {billsQuery.data.slice(0, 4).map((bill) => (
                  <Link className="bc-list-row" key={bill.id} to={`/bills/${bill.id}`}>
                    <div className="bc-list-row__main"><strong>{bill.description}</strong><span>{new Date(bill.incurredAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })} · {displayName(bill.payer)}</span></div>
                    <p className="bc-list-row__value">{formatCad(bill.totalCents)}</p>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="bc-stack">
          <section className="bc-card">
            <div className="bc-card-header">
              <div><p className="bc-eyebrow">Action center</p><h2 className="bc-card-title">{actionCount ? `${actionCount} item${actionCount === 1 ? '' : 's'} need you` : 'You are all caught up'}</h2></div>
              {actionCount ? <span className="bc-badge bc-badge--warning"><BellRing size={13} />{actionCount}</span> : <span className="bc-badge bc-badge--positive">Clear</span>}
            </div>
            {actionsPending ? <LoadingRows count={3} /> : billsQuery.isError || invitationsQuery.isError ? (
              <div className="bc-error">Action items are unavailable right now.</div>
            ) : <div className="bc-list">
              <Link className="bc-list-row" to="/requests?tab=owed-to-you">
                <div className="bc-list-row__main"><strong>Confirm payments</strong><span>Marked paid by someone else</span></div>
                <span className={actions.confirm ? 'bc-badge bc-badge--warning' : 'bc-badge'}><ArrowDownLeft size={13} />{actions.confirm}</span>
              </Link>
              <Link className="bc-list-row" to="/requests?tab=you-owe">
                <div className="bc-list-row__main"><strong>Mark payments</strong><span>Requests you still owe</span></div>
                <span className={actions.markPaid ? 'bc-badge bc-badge--warning' : 'bc-badge'}><ArrowUpRight size={13} />{actions.markPaid}</span>
              </Link>
              <Link className="bc-list-row" to="/friends?tab=invitations">
                <div className="bc-list-row__main"><strong>Friend invitations</strong><span>Waiting for your response</span></div>
                <span className={pendingInvitations.length ? 'bc-badge bc-badge--warning' : 'bc-badge'}>{pendingInvitations.length}</span>
              </Link>
            </div>}
          </section>

          <section className="bc-card">
            <div className="bc-card-header"><h2 className="bc-card-title">Latest activity</h2><Link className="bc-card-link" to="/activity">Full history</Link></div>
            {activityQuery.isPending ? <LoadingRows count={2} /> : activityQuery.isError ? <div className="bc-error">Activity is unavailable right now.</div> : !activityQuery.data?.length ? (
              <div className="bc-empty"><strong>Quiet for now</strong><p>Updates from your shared ledger will appear here.</p></div>
            ) : (
              <div className="bc-list">
                {activityQuery.data.slice(0, 4).map((event) => {
                  const route = activityRoute(event)
                  const content = <><div className="bc-list-row__main"><strong>{displayName(event.actor)}</strong><span>{event.message}</span></div>{route ? <ChevronRight aria-hidden="true" size={17} /> : null}</>
                  return route
                    ? <Link className="bc-list-row" key={event.id} to={route}>{content}</Link>
                    : <div className="bc-list-row" key={event.id}>{content}</div>
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </section>
  )
}
