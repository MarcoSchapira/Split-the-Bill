import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiErrorMessage } from '../api/client'
import { getDashboard } from '../api/dashboardApi'
import { listFriends } from '../api/friendsApi'
import type { Dashboard, FriendshipSummary } from '../api/types'
import { BillForm } from '../components/BillForm'
import { Modal } from '../components/Modal'
import { DATA_CHANGED_EVENT } from '../utils/events'
import { displayName, formatCad } from '../utils/format'

export function DashboardPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [friends, setFriends] = useState<FriendshipSummary[]>([])
  const [showBillForm, setShowBillForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [nextDashboard, nextFriends] = await Promise.all([
        getDashboard(),
        listFriends(),
      ])
      setDashboard(nextDashboard)
      setFriends(nextFriends)
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Unable to load dashboard.'))
    } finally {
      setIsLoading(false)
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
          <p className="eyebrow">Overview</p>
          <h1>Dashboard</h1>
          <p>Keep track of every shared balance in one place.</p>
        </div>
        <button className="primary-button compact" onClick={() => setShowBillForm(true)} type="button">
          + Add bill
        </button>
      </header>
      {error ? <p className="form-error">{error}</p> : null}
      {isLoading ? <p className="screen-message">Loading balances...</p> : null}
      {dashboard ? (
        <>
          <div className="summary-cards">
            <article className="summary-card positive">
              <span>You are owed</span>
              <strong>{formatCad(dashboard.totalOwedToYouCents)}</strong>
            </article>
            <article className="summary-card negative">
              <span>You owe</span>
              <strong>{formatCad(dashboard.totalYouOweCents)}</strong>
            </article>
            <article className="summary-card">
              <span>Net balance</span>
              <strong>{formatCad(dashboard.netBalanceCents)}</strong>
            </article>
          </div>
          <section className="panel balance-panel">
            <div className="panel-title">
              <h2>People</h2>
              <span className="count-pill">{dashboard.balances.length}</span>
            </div>
            {dashboard.balances.length === 0 ? (
              <p className="empty-state">Add a friend to start splitting bills.</p>
            ) : (
              <div className="balance-list">
                {dashboard.balances.map((balance) => {
                  if (!balance.friendshipId) return null
                  return (
                    <Link className="balance-row" key={balance.user.id} to={`/friends/${balance.friendshipId}`}>
                      <div>
                        <strong>{displayName(balance.user)}</strong>
                        <span>Friend</span>
                      </div>
                      <p className={`balance-value ${balance.balanceCents < 0 ? 'negative' : 'positive'}`}>
                        {balance.balanceCents === 0
                          ? 'Settled up'
                          : balance.balanceCents > 0
                            ? `owes you ${formatCad(balance.balanceCents)}`
                            : `you owe ${formatCad(-balance.balanceCents)}`}
                      </p>
                    </Link>
                  )
                })}
              </div>
            )}
          </section>
        </>
      ) : null}
      {showBillForm ? (
        <Modal onClose={() => setShowBillForm(false)} title="Add a bill">
          <BillForm
            friends={friends}
            onCancel={() => setShowBillForm(false)}
            onSaved={() => {
              setShowBillForm(false)
              void load()
            }}
          />
        </Modal>
      ) : null}
    </section>
  )
}
