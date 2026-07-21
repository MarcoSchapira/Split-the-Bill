import { useMemo, useRef } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowUpRight, Clock3, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { deleteActivity, listActivity } from '../api/activityApi'
import { apiErrorMessage } from '../api/client'
import { queryClient, queryKeys } from '../api/queryClient'
import type { ActivityEvent } from '../api/types'
import { useToast } from '../components/ui/useToast'
import { activityRoute } from '../utils/activityNavigation'
import { displayName } from '../utils/format'
import '../styles/activity.css'

function dateLabel(value: string) {
  const date = new Date(value)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const key = date.toDateString()
  if (key === today.toDateString()) return 'Today'
  if (key === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

export function ActivityPage() {
  const { showToast } = useToast()
  const dismissalFocusRef = useRef<HTMLElement | null>(null)
  const activityQuery = useQuery({ queryKey: queryKeys.activity, queryFn: listActivity })
  const dismissMutation = useMutation({
    mutationFn: deleteActivity,
    onSuccess: async (_, eventId) => {
      queryClient.setQueryData<ActivityEvent[]>(queryKeys.activity, (current) => current?.filter((event) => event.id !== eventId) ?? [])
      await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
      showToast('Activity dismissed.')
      window.requestAnimationFrame(() => {
        const target = dismissalFocusRef.current
        if (target?.isConnected) {
          target.focus()
          return
        }
        document.querySelector<HTMLElement>('#main-content h1')?.focus()
      })
    },
    onError: (error) => showToast(apiErrorMessage(error, 'Unable to dismiss activity.'), 'error'),
  })

  const groups = useMemo(() => {
    const grouped = new Map<string, ActivityEvent[]>()
    for (const event of activityQuery.data ?? []) {
      const label = dateLabel(event.createdAt)
      grouped.set(label, [...(grouped.get(label) ?? []), event])
    }
    return [...grouped.entries()]
  }, [activityQuery.data])

  return (
    <section className="bc-page">
      <header className="bc-page-header">
        <div className="bc-page-header__copy">
          <p className="bc-eyebrow">Ledger updates</p>
          <h1 className="bc-page-title">Activity</h1>
          <p className="bc-page-subtitle">A chronological record of bills, invitations, groups, and settlements.</p>
        </div>
      </header>

      {activityQuery.isPending ? (
        <section className="bc-card bc-stack"><div className="bc-skeleton" /><div className="bc-skeleton" /><div className="bc-skeleton" /></section>
      ) : activityQuery.isError ? (
        <div className="bc-error">{apiErrorMessage(activityQuery.error, 'Unable to load activity.')}</div>
      ) : groups.length === 0 ? (
        <div className="bc-card bc-empty"><Clock3 size={26} /><strong>No activity yet</strong><p>Updates from shared bills, friends, and groups will appear here.</p></div>
      ) : (
        <div className="bc-activity-groups">
          {groups.map(([label, events]) => (
            <section className="bc-activity-group" key={label}>
              <h2>{label}</h2>
              <div className="bc-card bc-activity-list">
                {events.map((event) => {
                  const route = activityRoute(event)
                  const content = (
                    <>
                      <span className="bc-activity-dot" />
                      <span className="bc-activity-copy">
                        <strong>{displayName(event.actor)}</strong>
                        <span>{event.message}</span>
                        <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })}</time>
                      </span>
                      {route ? <ArrowUpRight aria-hidden="true" className="bc-activity-arrow" size={17} /> : null}
                    </>
                  )
                  return (
                    <article className="bc-activity-row" data-activity-id={event.id} key={event.id}>
                      {route ? <Link className="bc-activity-target" to={route}>{content}</Link> : <div className="bc-activity-target">{content}</div>}
                      <button
                        aria-label={`Dismiss activity from ${displayName(event.actor)}`}
                        className="bc-icon-button bc-activity-dismiss"
                        disabled={dismissMutation.isPending && dismissMutation.variables === event.id}
                        onClick={(clickEvent) => {
                          const row = clickEvent.currentTarget.closest<HTMLElement>('[data-activity-id]')
                          const adjacentRow = row?.nextElementSibling ?? row?.previousElementSibling
                          dismissalFocusRef.current = adjacentRow?.querySelector<HTMLElement>('a, button') ?? null
                          dismissMutation.mutate(event.id)
                        }}
                        type="button"
                      >
                        <Trash2 aria-hidden="true" size={16} />
                      </button>
                    </article>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  )
}
