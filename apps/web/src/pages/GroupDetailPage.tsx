import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { listBills } from '../api/billsApi'
import { apiErrorMessage } from '../api/client'
import { listFriends } from '../api/friendsApi'
import { getGroup, inviteGroupMember, listGroups } from '../api/groupsApi'
import type { Bill, FriendshipSummary, GroupDetail, GroupSummary } from '../api/types'
import { BillForm } from '../components/BillForm'
import { BillList } from '../components/BillList'
import { Modal } from '../components/Modal'
import { DATA_CHANGED_EVENT, notifyDataChanged } from '../utils/events'
import { displayName } from '../utils/format'

export function GroupDetailPage() {
  const { groupId } = useParams()
  const [group, setGroup] = useState<GroupDetail | null>(null)
  const [bills, setBills] = useState<Bill[]>([])
  const [friends, setFriends] = useState<FriendshipSummary[]>([])
  const [groups, setGroups] = useState<GroupSummary[]>([])
  const [email, setEmail] = useState('')
  const [showBillForm, setShowBillForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteNotice, setInviteNotice] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isInviting, setIsInviting] = useState(false)

  const load = useCallback(async () => {
    if (!groupId) {
      return
    }

    try {
      const [nextGroup, nextBills, nextFriends, nextGroups] = await Promise.all([
        getGroup(groupId),
        listBills({ targetType: 'group', targetId: groupId }),
        listFriends(),
        listGroups(),
      ])
      setGroup(nextGroup)
      setBills(nextBills)
      setFriends(nextFriends)
      setGroups(nextGroups)
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Unable to load this group.'))
    } finally {
      setIsLoading(false)
    }
  }, [groupId])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0)
    const reload = () => void load()
    window.addEventListener(DATA_CHANGED_EVENT, reload)
    return () => {
      window.clearTimeout(initialLoad)
      window.removeEventListener(DATA_CHANGED_EVENT, reload)
    }
  }, [load])

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!groupId) {
      return
    }

    setInviteError(null)
    setInviteNotice(null)
    setIsInviting(true)
    try {
      await inviteGroupMember(groupId, email)
      setEmail('')
      setInviteNotice('Invitation sent. They will appear after accepting.')
      notifyDataChanged()
    } catch (requestError) {
      setInviteError(apiErrorMessage(requestError, 'Unable to send invitation.'))
    } finally {
      setIsInviting(false)
    }
  }

  if (!groupId) {
    return <p className="form-error">Group not found.</p>
  }

  return (
    <section className="page">
      <Link className="back-link" to="/groups">
        Back to groups
      </Link>
      {isLoading ? <p className="screen-message">Loading group...</p> : null}
      {error ? <p className="form-error detail-error">{error}</p> : null}
      {group ? (
        <>
          <header className="page-header group-page-header">
            <div>
              <p className="eyebrow">{group.role} access</p>
              <h1>{group.name}</h1>
              <p>{group.members.length} accepted member{group.members.length === 1 ? '' : 's'}</p>
            </div>
            <button className="primary-button compact" onClick={() => setShowBillForm(true)} type="button">
              + Add bill
            </button>
          </header>
          <div className="detail-grid">
            <section className="panel bills-panel">
              <div className="panel-title">
                <h2>Bills</h2>
                <span className="count-pill">{bills.length}</span>
              </div>
              <BillList bills={bills} friends={friends} groups={groups} onChanged={() => void load()} />
            </section>
            <div className="detail-aside">
              <section className="panel">
                <h2>Members</h2>
                <div className="members-list">
                  {group.members.map((member) => (
                    <div className="member-row" key={member.id}>
                      <div>
                        <strong>{displayName(member.user)}</strong>
                        <span>{member.user.email}</span>
                      </div>
                      <small className="role">{member.role}</small>
                    </div>
                  ))}
                </div>
              </section>
              <section className="panel">
                <h2>Invite member</h2>
                <p>Any accepted member can send a group invitation.</p>
                <form className="stack-form" onSubmit={invite}>
                  <label>
                    Registered email
                    <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
                  </label>
                  {inviteNotice ? <p className="form-success">{inviteNotice}</p> : null}
                  {inviteError ? <p className="form-error">{inviteError}</p> : null}
                  <button className="primary-button" disabled={isInviting} type="submit">
                    {isInviting ? 'Sending...' : 'Send invite'}
                  </button>
                </form>
              </section>
            </div>
          </div>
          {showBillForm ? (
            <Modal
              onClose={() => setShowBillForm(false)}
              size="wide"
              title={`Add bill to ${group.name}`}
            >
              <BillForm
                fixedTarget={{ targetType: 'group', targetId: group.id }}
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
