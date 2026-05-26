import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiErrorMessage } from '../api/client'
import { getFriendship, listFriends } from '../api/friendsApi'
import { listGroups } from '../api/groupsApi'
import type { FriendshipDetail, FriendshipSummary, GroupSummary } from '../api/types'
import { BillForm } from '../components/BillForm'
import { BillList } from '../components/BillList'
import { Modal } from '../components/Modal'
import { DATA_CHANGED_EVENT } from '../utils/events'
import { displayName } from '../utils/format'

export function FriendDetailPage() {
  const { friendshipId } = useParams()
  const [friendship, setFriendship] = useState<FriendshipDetail | null>(null)
  const [friends, setFriends] = useState<FriendshipSummary[]>([])
  const [groups, setGroups] = useState<GroupSummary[]>([])
  const [showBillForm, setShowBillForm] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  if (!friendshipId) {
    return <p className="form-error">Friend not found.</p>
  }

  return (
    <section className="page">
      <Link className="back-link" to="/friends">
        Back to friends
      </Link>
      {error ? <p className="form-error">{error}</p> : null}
      {friendship ? (
        <>
          <header className="page-header">
            <div>
              <p className="eyebrow">Friend</p>
              <h1>{displayName(friendship.friend)}</h1>
              <p>{friendship.friend.email}</p>
            </div>
            <button className="primary-button compact" onClick={() => setShowBillForm(true)} type="button">
              + Add bill
            </button>
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
