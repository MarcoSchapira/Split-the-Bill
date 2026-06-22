import { useCallback, useEffect, useState } from 'react'
import { listBills } from '../api/billsApi'
import { apiErrorMessage } from '../api/client'
import { listFriends } from '../api/friendsApi'
import type { Bill, FriendshipSummary } from '../api/types'
import { BillList } from '../components/BillList'
import { DATA_CHANGED_EVENT } from '../utils/events'
import { formatCad } from '../utils/format'

export function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([])
  const [friends, setFriends] = useState<FriendshipSummary[]>([])
  const [error, setError] = useState<string | null>(null)

  const capturedBills = bills.filter((bill) => bill.source === 'capture').length
  const unsettledBills = bills.filter((bill) => !bill.userSummary.settled).length
  const netExposureCents = bills.reduce((sum, bill) => {
    if (bill.userSummary.direction === 'owed_to_you') return sum + bill.userSummary.amountCents
    if (bill.userSummary.direction === 'you_owe') return sum - bill.userSummary.amountCents
    return sum
  }, 0)

  const load = useCallback(async () => {
    try {
      const [nextBills, nextFriends] = await Promise.all([
        listBills(),
        listFriends(),
      ])
      setBills(nextBills)
      setFriends(nextFriends)
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Unable to load bills.'))
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
          <p className="eyebrow">Bill history</p>
          <h1>Bills</h1>
          <p>All recorded bills across manual entries and captured receipts.</p>
        </div>
      </header>
      <section className="bills-kpi-grid">
        <article className="bills-kpi-card">
          <span>Total bills</span>
          <strong>{bills.length}</strong>
        </article>
        <article className="bills-kpi-card">
          <span>Captured receipts</span>
          <strong>{capturedBills}</strong>
        </article>
        <article className="bills-kpi-card">
          <span>Need action</span>
          <strong>{unsettledBills}</strong>
        </article>
        <article className="bills-kpi-card">
          <span>Net exposure</span>
          <strong className={netExposureCents >= 0 ? 'positive' : 'negative'}>
            {formatCad(Math.abs(netExposureCents))}
          </strong>
        </article>
      </section>
      {error ? <p className="form-error">{error}</p> : null}
      <section className="panel bills-panel-surface">
        <div className="panel-title">
          <h2>All bills</h2>
          <span className="count-pill">{bills.length}</span>
        </div>
        <BillList bills={bills} friends={friends} onChanged={() => void load()} />
      </section>
    </section>
  )
}
