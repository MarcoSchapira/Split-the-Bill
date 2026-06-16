import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiErrorMessage } from '../api/client'
import { getFriendship, listFriends, settleFriend } from '../api/friendsApi'
import { listGroups } from '../api/groupsApi'
import type { FriendshipDetail, FriendshipSummary, GroupSummary } from '../api/types'
import { BillForm } from '../components/BillForm'
import { BillList } from '../components/BillList'
import { Modal } from '../components/Modal'
import { DATA_CHANGED_EVENT, notifyDataChanged } from '../utils/events'
import { displayName } from '../utils/format'

export function FriendDetailPage() {
  const { friendshipId } = useParams()
  const [friendship, setFriendship] = useState<FriendshipDetail | null>(null)
  const [friends, setFriends] = useState<FriendshipSummary[]>([])
  const [groups, setGroups] = useState<GroupSummary[]>([])
  const [showBillForm, setShowBillForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [settleMessage, setSettleMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!friendshipId) {
      return
    }

    try {
      const [nextFriendship, nextFriends, nextGroups] = await Promise.all([
        getFriendship(friendshipId),
        listFriends(),
        listGroups(),
      ])
      setFriendship(nextFriendship)
      setFriends(nextFriends)
      setGroups(nextGroups)
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Unable to load friend details.'))
    }
  }, [friendshipId])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0)
    const reload = () => void load()
    window.addEventListener(DATA_CHANGED_EVENT, reload)
    return () => {
      window.clearTimeout(initialLoad)
      window.removeEventListener(DATA_CHANGED_EVENT, reload)
    }
  }, [load])

  async function settleAll() {
    if (!friendshipId) {
      return
    }

    setError(null)
    setSettleMessage(null)
    try {
      const result = await settleFriend(friendshipId)
      if (result.settledCount === 0) {
        setSettleMessage('Already settled up.')
      } else {
        setSettleMessage('All bills settled up.')
      }
      notifyDataChanged()
      await load()
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Unable to settle up with this friend.'))
    }
  }

  if (!friendshipId) {
    return <p className="form-error">Friend not found.</p>
  }

  const friendName = friendship ? displayName(friendship.friend) : 'this friend'
  const sharedGroups = friendship?.sharedGroups ?? []
  const sharedGroupBillCount = sharedGroups.reduce((sum, group) => sum + group.bills.length, 0)

  return (
    <section className="page">
      <Link className="back-link" to="/friends">
        Back to friends
      </Link>
      {error ? <p className="form-error">{error}</p> : null}
      {settleMessage ? <p className="form-success">{settleMessage}</p> : null}
      {friendship ? (
        <>
          <header className="page-header">
            <div>
              <p className="eyebrow">Friend</p>
              <h1>{displayName(friendship.friend)}</h1>
              <p>{friendship.friend.email}</p>
            </div>
            <div className="page-header-actions">
              <button className="secondary-button compact" onClick={() => void settleAll()} type="button">
                Settle up
              </button>
              <button className="primary-button compact" onClick={() => setShowBillForm(true)} type="button">
                + Add bill
              </button>
            </div>
          </header>
          <section className="panel">
            <div className="panel-title">
              <h2>Direct bills</h2>
              <span className="count-pill">{friendship.bills.length}</span>
            </div>
            <BillList
              bills={friendship.bills}
              friends={friends}
              groups={groups}
              onChanged={() => void load()}
            />
          </section>
          {sharedGroups.length > 0 ? (
            <section className="friend-shared-groups">
              <header className="friend-shared-groups-header">
                <p className="eyebrow">Shared groups</p>
                <h2>Group bills with {friendName}</h2>
                <p>Only group bills where you and {friendName} owe each other directly.</p>
              </header>
              <div className="friend-shared-groups-list">
                {sharedGroups.map((group) => (
                  <section className="panel friend-group-panel" key={group.id}>
                    <div className="panel-title">
                      <h2>
                        <Link to={`/groups/${group.id}`}>{group.name}</Link>
                      </h2>
                      <span className="count-pill">{group.bills.length}</span>
                    </div>
                    <BillList
                      bills={group.bills}
                      emptyMessage={`No direct balances from group bills with ${friendName}.`}
                      friend={friendship.friend}
                      friends={friends}
                      groups={groups}
                      onChanged={() => void load()}
                    />
                  </section>
                ))}
              </div>
              <p className="friend-shared-groups-meta">
                {sharedGroupBillCount} bill{sharedGroupBillCount === 1 ? '' : 's'} across{' '}
                {sharedGroups.length} shared group
                {sharedGroups.length === 1 ? '' : 's'}
              </p>
            </section>
          ) : null}
          {showBillForm ? (
            <Modal onClose={() => setShowBillForm(false)} title={`Add bill with ${displayName(friendship.friend)}`}>
              <BillForm
                fixedTarget={{ targetType: 'friendship', targetId: friendship.id }}
                friends={friends}
                groups={groups}
                onCancel={() => setShowBillForm(false)}
                onSaved={() => {
                  setShowBillForm(false)
                  void load()
                }}
              />
            </Modal>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
