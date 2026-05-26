import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiErrorMessage } from '../api/client'
import { createGroup, listGroups } from '../api/groupsApi'
import type { GroupSummary } from '../api/types'
import { useAuth } from '../auth/useAuth'

export function DashboardPage() {
  const [groups, setGroups] = useState<GroupSummary[]>([])
  const [groupName, setGroupName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const auth = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    let isActive = true

    void listGroups()
      .then((groupList) => {
        if (isActive) {
          setGroups(groupList)
        }
      })
      .catch((requestError) => {
        if (isActive) {
          setError(apiErrorMessage(requestError, 'Unable to load groups.'))
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
  }, [])

  async function handleCreateGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsCreating(true)

    try {
      const group = await createGroup(groupName)
      setGroups((currentGroups) => [group, ...currentGroups])
      setGroupName('')
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Unable to create group.'))
    } finally {
      setIsCreating(false)
    }
  }

  function handleLogout() {
    auth.logout()
    navigate('/login', { replace: true })
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">EquiSplit</p>
          <h1>Your groups</h1>
        </div>
        <div className="account-actions">
          <span>{auth.user?.name ?? auth.user?.email}</span>
          <button className="quiet-button" onClick={handleLogout} type="button">
            Log out
          </button>
        </div>
      </header>
      <div className="dashboard-grid">
        <section className="panel create-panel">
          <h2>Create a group</h2>
          <p>Start a new shared expense space and become its owner.</p>
          <form className="stack-form" onSubmit={handleCreateGroup}>
            <label>
              Group name
              <input
                maxLength={100}
                required
                type="text"
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
              />
            </label>
            <button className="primary-button" disabled={isCreating} type="submit">
              {isCreating ? 'Creating...' : 'Create group'}
            </button>
          </form>
        </section>
        <section className="panel groups-panel">
          <div className="panel-title">
            <h2>Memberships</h2>
            <span className="count-pill">{groups.length}</span>
          </div>
          {error ? <p className="form-error">{error}</p> : null}
          {isLoading ? <p className="muted">Loading groups...</p> : null}
          {!isLoading && groups.length === 0 ? (
            <p className="empty-state">Create your first group to get started.</p>
          ) : null}
          <div className="group-list">
            {groups.map((group) => (
              <Link className="group-row" key={group.id} to={`/groups/${group.id}`}>
                <div>
                  <strong>{group.name}</strong>
                  <span>Created {new Date(group.createdAt).toLocaleDateString()}</span>
                </div>
                <small className="role">{group.role}</small>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
