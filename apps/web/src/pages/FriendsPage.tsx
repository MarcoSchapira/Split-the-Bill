import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiErrorMessage } from '../api/client'
import { getDashboard } from '../api/dashboardApi'
import { listFriends } from '../api/friendsApi'
import type { BalanceContact, FriendshipSummary } from '../api/types'
import { DATA_CHANGED_EVENT } from '../utils/events'
import { displayName, formatCad } from '../utils/format'

export function FriendsPage() {
  const [friends, setFriends] = useState<FriendshipSummary[]>([])
  const [balances, setBalances] = useState<BalanceContact[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [nextFriends, dashboard] = await Promise.all([listFriends(), getDashboard()])
      setFriends(nextFriends)
      setBalances(dashboard.balances)
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Unable to load friends.'))
    }
  }, [])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0)
    const reload = () => void load()
    window.addEventListener(DATA_CHANGED_EVENT, reload)
    return () => {
      window.clearTimeout(initialLoad)
      window.removeEventListener(DATA_CHANGED_EVENT, reload)
    }
  }, [load])

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Connections</p>
          <h1>Friends</h1>
          <p>Direct bills are available once an invitation is accepted.</p>
        </div>
      </header>
      <section className="panel">
        <div className="panel-title">
          <h2>Accepted friends</h2>
          <span className="count-pill">{friends.length}</span>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        {friends.length === 0 ? (
          <p className="empty-state">Send a friend invitation using the quick action above.</p>
        ) : (
          <div className="group-list">
            {friends.map((friendship) => {
              const balance = balances.find((item) => item.friendshipId === friendship.id)
              const balanceCents = balance?.balanceCents ?? 0
              const balanceClass =
                balanceCents > 0
                  ? 'positive'
                  : balanceCents < 0
                    ? 'negative'
                    : 'settled'
              const balanceLabel =
                balanceCents > 0
                  ? formatCad(balanceCents)
                  : balanceCents < 0
                    ? formatCad(-balanceCents)
                    : 'Settled'

              return (
                <Link className="group-row" key={friendship.id} to={`/friends/${friendship.id}`}>
                  <div>
                    <strong>{displayName(friendship.friend)}</strong>
                    <span>{friendship.friend.email}</span>
                  </div>
                  <small className={`balance-chip ${balanceClass}`}>{balanceLabel}</small>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </section>
  )
}
