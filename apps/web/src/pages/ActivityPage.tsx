import { useCallback, useEffect, useState } from 'react'
import { listActivity } from '../api/activityApi'
import { apiErrorMessage } from '../api/client'
import type { ActivityEvent } from '../api/types'
import { DATA_CHANGED_EVENT } from '../utils/events'
import { displayName } from '../utils/format'

export function ActivityPage() {
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [error, setError] = useState<string | null>(null)

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
          <p className="empty-state">No activity yet.</p>
        ) : (
          <div className="activity-list">
            {activity.map((event) => (
              <article className="activity-row" key={event.id}>
                <div className="activity-mark" />
                <p>
                  <strong>{displayName(event.actor)}</strong> {event.message}
                  <span>{new Date(event.createdAt).toLocaleString()}</span>
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}
