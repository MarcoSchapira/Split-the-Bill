import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiErrorMessage } from '../api/client'
import { addMember, getGroup } from '../api/groupsApi'
import type { GroupDetail } from '../api/types'

export function GroupDetailPage() {
  const { groupId } = useParams()
  const [group, setGroup] = useState<GroupDetail | null>(null)
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [memberError, setMemberError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAddingMember, setIsAddingMember] = useState(false)

  useEffect(() => {
    let isActive = true

    if (!groupId) {
      return
    }

    void getGroup(groupId)
      .then((nextGroup) => {
        if (isActive) {
          setGroup(nextGroup)
        }
      })
      .catch((requestError) => {
        if (isActive) {
          setError(apiErrorMessage(requestError, 'Unable to load this group.'))
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [groupId])

  if (!groupId) {
    return (
      <main className="app-shell">
        <Link className="back-link" to="/dashboard">
          Back to groups
        </Link>
        <p className="form-error detail-error">Group not found.</p>
      </main>
    )
  }

  async function handleAddMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!groupId || !group) {
      return
    }

    setMemberError(null)
    setIsAddingMember(true)

    try {
      const member = await addMember(groupId, email)
      setGroup({ ...group, members: [...group.members, member] })
      setEmail('')
    } catch (requestError) {
      setMemberError(apiErrorMessage(requestError, 'Unable to add member.'))
    } finally {
      setIsAddingMember(false)
    }
  }

  return (
    <main className="app-shell">
      <Link className="back-link" to="/dashboard">
        Back to groups
      </Link>
      {isLoading ? <p className="screen-message">Loading group...</p> : null}
      {error ? <p className="form-error detail-error">{error}</p> : null}
      {group ? (
        <>
          <header className="group-header">
            <div>
              <p className="eyebrow">{group.role} access</p>
              <h1>{group.name}</h1>
            </div>
            <span className="count-pill">
              {group.members.length} member{group.members.length === 1 ? '' : 's'}
            </span>
          </header>
          <div className="detail-grid">
            <section className="panel">
              <h2>Members</h2>
              <div className="members-list">
                {group.members.map((member) => (
                  <div className="member-row" key={member.id}>
                    <div>
                      <strong>{member.user.name ?? member.user.email}</strong>
                      <span>{member.user.email}</span>
                    </div>
                    <small className="role">{member.role}</small>
                  </div>
                ))}
              </div>
            </section>
            {group.role === 'owner' ? (
              <section className="panel">
                <h2>Add member</h2>
                <p className="muted">Members must already have an account.</p>
                <form className="stack-form" onSubmit={handleAddMember}>
                  <label>
                    Registered email
                    <input
                      required
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </label>
                  {memberError ? <p className="form-error">{memberError}</p> : null}
                  <button
                    className="primary-button"
                    disabled={isAddingMember}
                    type="submit"
                  >
                    {isAddingMember ? 'Adding...' : 'Add member'}
                  </button>
                </form>
              </section>
            ) : null}
          </div>
        </>
      ) : null}
    </main>
  )
}
