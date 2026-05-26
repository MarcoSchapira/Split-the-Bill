import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiErrorMessage } from '../api/client'
import { listGroups } from '../api/groupsApi'
import type { GroupSummary } from '../api/types'
import { DATA_CHANGED_EVENT } from '../utils/events'

export function GroupsPage() {
  const [groups, setGroups] = useState<GroupSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setGroups(await listGroups())
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Unable to load groups.'))
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
          <p className="eyebrow">Shared spaces</p>
          <h1>Groups</h1>
          <p>Expenses shared with every accepted member.</p>
        </div>
      </header>
      <section className="panel">
        <div className="panel-title">
          <h2>Your groups</h2>
          <span className="count-pill">{groups.length}</span>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        {isLoading ? <p className="muted">Loading groups...</p> : null}
        {!isLoading && groups.length === 0 ? (
          <p className="empty-state">Create a group with the quick action above.</p>
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
    </section>
  )
}
