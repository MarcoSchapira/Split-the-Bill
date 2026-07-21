import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { listBills } from '../api/billsApi'
import { apiErrorMessage } from '../api/client'
import { listGroups } from '../api/groupsApi'
import type { Bill, User } from '../api/types'
import { useAuth } from '../auth/useAuth'
import { queryKeys } from '../api/queryClient'
import { displayName, formatCad } from '../utils/format'
import '../styles/bills.css'

type BillStatus = 'recorded' | 'open' | 'awaiting' | 'settled'
type StatusFilter = 'all' | BillStatus
type SourceFilter = 'all' | 'manual' | 'capture'
type TargetFilter = 'all' | 'solo' | 'friends' | 'group'
const EMPTY_BILLS: Bill[] = []

function billStatus(bill: Bill, currentUserId: string): BillStatus {
  if (bill.userSummary.direction === 'none') return 'recorded'
  if (bill.userSummary.settled) return 'settled'
  const relevantShares = bill.payerId === currentUserId
    ? bill.shares.filter((share) => share.user.id !== currentUserId)
    : bill.shares.filter((share) => share.user.id === currentUserId)
  return relevantShares.some((share) => share.payerMarkedAsPaid && !share.lenderConfirmedPaid)
    ? 'awaiting'
    : 'open'
}

function targetKind(bill: Bill): Exclude<TargetFilter, 'all'> {
  if (bill.isSplitWithGroup) return 'group'
  if (bill.isSplitWithFriends) return 'friends'
  return 'solo'
}

function statusCopy(status: BillStatus, direction: Bill['userSummary']['direction']) {
  if (status === 'recorded') return 'Recorded'
  if (status === 'settled') return 'Completed'
  if (status === 'awaiting') return direction === 'owed_to_you' ? 'Payment to confirm' : 'Awaiting confirmation'
  if (direction === 'owed_to_you') return 'You are owed'
  if (direction === 'you_owe') return 'You owe'
  return 'Recorded'
}

export function BillsPage() {
  const auth = useAuth()
  const billsQuery = useQuery({ queryKey: queryKeys.bills, queryFn: () => listBills() })
  const groupsQuery = useQuery({ queryKey: queryKeys.groups, queryFn: listGroups })
  const bills = billsQuery.data ?? EMPTY_BILLS
  const groups = groupsQuery.data ?? []
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [source, setSource] = useState<SourceFilter>('all')
  const [target, setTarget] = useState<TargetFilter>('all')
  const [payerId, setPayerId] = useState('all')
  const [personId, setPersonId] = useState('all')
  const [groupId, setGroupId] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const people = useMemo(() => {
    const byId = new Map<string, User>()
    for (const bill of bills) {
      byId.set(bill.payer.id, bill.payer)
      for (const share of bill.shares) byId.set(share.user.id, share.user)
    }
    return [...byId.values()].sort((left, right) => displayName(left).localeCompare(displayName(right)))
  }, [bills])

  const filteredBills = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    const currentUserId = auth.user?.id ?? ''
    return bills.filter((bill) => {
      const searchable = [
        bill.description,
        bill.storeName,
        bill.group?.name,
        ...bill.shares.flatMap((share) => [share.user.name, share.user.email]),
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase()
      const date = bill.incurredAt.slice(0, 10)
      return (
        (!query || searchable.includes(query)) &&
        (status === 'all' || billStatus(bill, currentUserId) === status) &&
        (source === 'all' || bill.source === source) &&
        (target === 'all' || targetKind(bill) === target) &&
        (payerId === 'all' || bill.payerId === payerId) &&
        (personId === 'all' || bill.shares.some((share) => share.user.id === personId)) &&
        (groupId === 'all' || bill.groupId === groupId) &&
        (!fromDate || date >= fromDate) &&
        (!toDate || date <= toDate)
      )
    })
  }, [auth.user?.id, bills, fromDate, groupId, payerId, personId, search, source, status, target, toDate])

  const openCount = bills.filter((bill) => {
    const currentStatus = billStatus(bill, auth.user?.id ?? '')
    return currentStatus === 'open' || currentStatus === 'awaiting'
  }).length
  const capturedCount = bills.filter((bill) => bill.source === 'capture').length
  const netCents = bills.reduce((sum, bill) => {
    if (bill.userSummary.direction === 'owed_to_you' && !bill.userSummary.settled) return sum + bill.userSummary.amountCents
    if (bill.userSummary.direction === 'you_owe' && !bill.userSummary.settled) return sum - bill.userSummary.amountCents
    return sum
  }, 0)
  const filtersActive = Boolean(search || status !== 'all' || source !== 'all' || target !== 'all' || payerId !== 'all' || personId !== 'all' || groupId !== 'all' || fromDate || toDate)

  function clearFilters() {
    setSearch('')
    setStatus('all')
    setSource('all')
    setTarget('all')
    setPayerId('all')
    setPersonId('all')
    setGroupId('all')
    setFromDate('')
    setToDate('')
  }

  return (
    <section className="page bc-bills-page">
      <header className="page-header bc-ledger-header">
        <div>
          <p className="eyebrow">Expense ledger</p>
          <h1>Bills</h1>
          <p>Search every expense, receipt, participant, and settlement state.</p>
        </div>
        <Link className="primary-button compact" to="/bills/new">+ New bill</Link>
      </header>

      <section className="bc-kpi-grid" aria-label="Bill summary">
        <article><span>All bills</span><strong>{bills.length}</strong><small>Since you joined</small></article>
        <article><span>Still open</span><strong>{openCount}</strong><small>Including payments to confirm</small></article>
        <article><span>Receipt scans</span><strong>{capturedCount}</strong><small>AI-assisted entries</small></article>
        <article className={netCents < 0 ? 'is-negative' : 'is-positive'}><span>Open net</span><strong>{formatCad(Math.abs(netCents))}</strong><small>{netCents < 0 ? 'More to pay' : netCents > 0 ? 'More to receive' : 'Balanced'}</small></article>
      </section>

      <section className="bc-filter-panel" aria-label="Bill filters">
        <div className="bc-search-field"><span aria-hidden="true">⌕</span><label className="sr-only" htmlFor="bill-search">Search bills</label><input id="bill-search" type="search" placeholder="Search title, merchant, group, or person" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <div className="bc-filter-grid">
          <label>Status<select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}><option value="all">All statuses</option><option value="recorded">Recorded</option><option value="open">Open</option><option value="awaiting">Awaiting confirmation</option><option value="settled">Completed</option></select></label>
          <label>Source<select value={source} onChange={(event) => setSource(event.target.value as SourceFilter)}><option value="all">Any source</option><option value="manual">Manual</option><option value="capture">Receipt scan</option></select></label>
          <label>Target<select value={target} onChange={(event) => setTarget(event.target.value as TargetFilter)}><option value="all">Any target</option><option value="solo">Solo</option><option value="friends">Friends</option><option value="group">Group</option></select></label>
          <label>Paid by<select value={payerId} onChange={(event) => setPayerId(event.target.value)}><option value="all">Anyone</option>{people.map((person) => <option key={person.id} value={person.id}>{displayName(person)}</option>)}</select></label>
          <label>Participant<select value={personId} onChange={(event) => setPersonId(event.target.value)}><option value="all">Anyone</option>{people.map((person) => <option key={person.id} value={person.id}>{displayName(person)}</option>)}</select></label>
          <label>Group<select value={groupId} onChange={(event) => setGroupId(event.target.value)}><option value="all">Any group</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
          <label>From<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
          <label>To<input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
        </div>
        {filtersActive ? <button className="text-button bc-clear-filters" type="button" onClick={clearFilters}>Clear all filters</button> : null}
      </section>

      {billsQuery.error ? <div className="bc-page-error"><strong>Bills did not load.</strong><p>{apiErrorMessage(billsQuery.error, 'Unable to load your bills.')}</p><button className="secondary-button" type="button" onClick={() => void billsQuery.refetch()}>Try again</button></div> : null}
      {billsQuery.isPending ? <div className="bc-ledger-skeleton"><span /><span /><span /></div> : null}

      {!billsQuery.isPending && !billsQuery.error ? (
        <section className="bc-ledger-panel">
          <div className="bc-ledger-title"><div><h2>{filtersActive ? 'Filtered bills' : 'All bills'}</h2><span>{filteredBills.length}</span></div><p>Newest expenses appear first.</p></div>
          {filteredBills.length === 0 ? (
            <div className="bc-empty-ledger"><span aria-hidden="true">⌕</span><strong>{bills.length === 0 ? 'Your ledger is ready' : 'No bills match these filters'}</strong><p>{bills.length === 0 ? 'Create a bill manually or scan a receipt to get started.' : 'Broaden your search or clear the filters.'}</p>{bills.length === 0 ? <Link className="primary-button compact" to="/bills/new">Create your first bill</Link> : <button className="secondary-button" type="button" onClick={clearFilters}>Clear filters</button>}</div>
          ) : (
            <div className="bc-ledger-list">
              {filteredBills.map((bill) => {
                const currentStatus = billStatus(bill, auth.user?.id ?? '')
                const directionClass = bill.userSummary.direction === 'you_owe' ? 'is-negative' : bill.userSummary.direction === 'owed_to_you' ? 'is-positive' : ''
                return (
                  <article className="bc-ledger-row" key={bill.id}>
                    <Link aria-label={`View ${bill.description}`} className="bc-ledger-row-link" to={`/bills/${bill.id}`} />
                    <div className={`bc-ledger-source ${bill.source}`} aria-hidden="true">{bill.source === 'capture' ? '▤' : '◇'}</div>
                    <div className="bc-ledger-copy"><div className="bc-ledger-name"><h3>{bill.description}</h3><span className={`bc-status ${currentStatus}`}>{statusCopy(currentStatus, bill.userSummary.direction)}</span></div><p>{bill.storeName || (bill.group?.name ? `${bill.group.name} group` : targetKind(bill) === 'solo' ? 'Personal expense' : `With ${bill.shares.length - 1} other${bill.shares.length === 2 ? '' : 's'}`)}</p><small>{new Date(bill.incurredAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })} · Paid by {displayName(bill.payer)}</small></div>
                    <div className={`bc-ledger-money ${directionClass}`}><strong>{formatCad(bill.totalCents)}</strong>{bill.userSummary.direction !== 'none' ? <span>{bill.userSummary.direction === 'owed_to_you' ? `${formatCad(bill.userSummary.amountCents)} owed to you` : `${formatCad(bill.userSummary.amountCents)} you owe`}</span> : <span>No shared balance</span>}</div>
                    <span className="bc-ledger-chevron" aria-hidden="true">›</span>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      ) : null}
    </section>
  )
}
