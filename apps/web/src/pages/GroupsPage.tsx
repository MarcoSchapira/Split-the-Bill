import { useQuery } from '@tanstack/react-query'
import { ArrowDownLeft, ArrowUpRight, Plus, Search, UsersRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiErrorMessage } from '../api/client'
import { listGroups } from '../api/groupsApi'
import { queryKeys } from '../api/queryClient'
import { GroupFormDialog } from '../components/GroupFormDialog'
import { useDialogFocus } from '../components/ui/useDialogFocus'
import { formatCad } from '../utils/format'
import { groupIcon } from '../utils/groupIcons'
import '../styles/social.css'

export function GroupsPage() {
  const [createOpen, setCreateOpen] = useState(false)
  const createDialogFocus = useDialogFocus()
  const [query, setQuery] = useState('')
  const groupsQuery = useQuery({ queryKey: queryKeys.groups, queryFn: listGroups })
  const groups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return groupsQuery.data ?? []
    return (groupsQuery.data ?? []).filter((group) => group.name.toLowerCase().includes(normalizedQuery))
  }, [groupsQuery.data, query])

  return (
    <section className="bc-page social-page">
      <header className="bc-page-header">
        <div className="bc-page-header__copy">
          <p className="bc-eyebrow">Shared spaces</p>
          <h1 className="bc-page-title">Groups</h1>
          <p className="bc-page-subtitle">Keep trips, homes, teams, and recurring shared costs organized together.</p>
        </div>
        <button className="bc-button bc-button--primary" onClick={() => { createDialogFocus.capture(); setCreateOpen(true) }} type="button"><Plus aria-hidden="true" size={17} />New group</button>
      </header>

      <section className="bc-card social-groups-card">
        <div className="social-toolbar">
          <label className="social-search">
            <Search aria-hidden="true" size={18} />
            <span className="social-sr-only">Search groups</span>
            <input onChange={(event) => setQuery(event.target.value)} placeholder="Search groups" type="search" value={query} />
          </label>
          <p>{groupsQuery.data?.length ?? 0} {(groupsQuery.data?.length ?? 0) === 1 ? 'group' : 'groups'}</p>
        </div>

        {groupsQuery.error ? <p className="bc-error" role="alert">{apiErrorMessage(groupsQuery.error, 'Unable to load groups.')}</p> : null}
        {groupsQuery.isPending ? (
          <div className="social-group-grid"><div className="bc-skeleton" /><div className="bc-skeleton" /><div className="bc-skeleton" /></div>
        ) : groups.length === 0 ? (
          <div className="bc-empty social-empty">
            <UsersRound aria-hidden="true" size={29} />
            <strong>{query ? 'No groups match your search' : 'Create your first group'}</strong>
            <p>{query ? 'Try a different group name.' : 'Groups make it easy to split repeat expenses with the same people.'}</p>
            {!query ? <button className="bc-button bc-button--primary" onClick={() => { createDialogFocus.capture(); setCreateOpen(true) }} type="button">Create group</button> : null}
          </div>
        ) : (
          <div className="social-group-grid">
            {groups.map((group) => {
              const Icon = groupIcon(group.iconKey)
              const balance = group.netBalanceCents
              const BalanceIcon = balance >= 0 ? ArrowDownLeft : ArrowUpRight
              return (
                <Link className="social-group-card" key={group.id} to={`/groups/${group.id}`}>
                  <div className="social-group-card__top">
                    <div className="social-group-icon"><Icon aria-hidden="true" size={23} /></div>
                    <div className="social-avatar-stack" aria-label={`${group.memberCount} group members`}>
                      {group.memberPreview.slice(0, 3).map((member) => <span key={member.id}>{(member.name?.trim()[0] ?? member.email[0] ?? '?').toUpperCase()}</span>)}
                      {group.memberCount > 3 ? <small>+{group.memberCount - 3}</small> : null}
                    </div>
                  </div>
                  <div className="social-group-card__copy"><h2>{group.name}</h2><p>{group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}</p></div>
                  <div className={`social-group-card__balance ${balance > 0 ? 'is-positive' : balance < 0 ? 'is-negative' : ''}`}>
                    {balance === 0 ? <span>Settled up</span> : <><BalanceIcon aria-hidden="true" size={15} /><span>{balance > 0 ? 'You are owed' : 'You owe'}</span><strong>{formatCad(Math.abs(balance))}</strong></>}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>
      <GroupFormDialog onCloseAutoFocus={createDialogFocus.restore} onOpenChange={setCreateOpen} open={createOpen} />
    </section>
  )
}
