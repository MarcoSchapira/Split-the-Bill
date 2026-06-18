import { useCallback, useEffect, useState } from 'react'
import { listBills } from '../api/billsApi'
import { apiErrorMessage } from '../api/client'
import { listFriends } from '../api/friendsApi'
import { listGroups } from '../api/groupsApi'
import type { Bill, FriendshipSummary, GroupSummary } from '../api/types'
import { BillList } from '../components/BillList'
import { DATA_CHANGED_EVENT } from '../utils/events'

export function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([])
  const [friends, setFriends] = useState<FriendshipSummary[]>([])
  const [groups, setGroups] = useState<GroupSummary[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [nextBills, nextFriends, nextGroups] = await Promise.all([
        listBills(),
        listFriends(),
        listGroups(),
      ])
      setBills(nextBills)
      setFriends(nextFriends)
      setGroups(nextGroups)
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
      {error ? <p className="form-error">{error}</p> : null}
      <section className="panel">
        <div className="panel-title">
          <h2>All bills</h2>
          <span className="count-pill">{bills.length}</span>
        </div>
        <BillList bills={bills} friends={friends} groups={groups} onChanged={() => void load()} />
      </section>
    </section>
  )
}
