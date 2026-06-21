import { useCallback, useEffect, useState } from 'react'
import { deleteActivity, listActivity } from '../api/activityApi'
import { apiErrorMessage } from '../api/client'
import type { ActivityEvent } from '../api/types'
import { DATA_CHANGED_EVENT } from '../utils/events'
import { displayName } from '../utils/format'

export function ActivityPage() {
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    try {
      setActivity(await listActivity())
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Unable to load recent activity.'))
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

  async function removeActivity(eventId: string) {
    setError(null)
    setDeletingIds((current) => new Set(current).add(eventId))

    try {
      await deleteActivity(eventId)
      setActivity((current) => current.filter((event) => event.id !== eventId))
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Unable to remove activity.'))
    } finally {
      setDeletingIds((current) => {
        const next = new Set(current)
        next.delete(eventId)
        return next
      })
    }
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Ledger updates</p>
          <h1>Recent Activity</h1>
          <p>Bill changes and invitation responses involving you.</p>
        </div>
      </header>
      <section className="panel">
        {error ? <p className="form-error">{error}</p> : null}
        {activity.length === 0 ? (
          <div className="empty-state-panel">
            <strong>No activity yet</strong>
            <p className="muted">Bill updates and invitation responses will show up here.</p>
          </div>
        ) : (
          <div className="activity-list">
            {activity.map((event) => (
              <article className="activity-row" key={event.id}>
                <div className="activity-mark" />
                <p>
                  <strong>{displayName(event.actor)}</strong> {event.message}
                  <span>{new Date(event.createdAt).toLocaleString()}</span>
                </p>
                <button
                  aria-label="Remove activity"
                  className="activity-delete-button"
                  disabled={deletingIds.has(event.id)}
                  onClick={() => void removeActivity(event.id)}
                  type="button"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M10 11v7M14 11v7M6 7l1 13a1 1 0 0 0 1 .9h8a1 1 0 0 0 1-.9l1-13" />
                  </svg>
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}
