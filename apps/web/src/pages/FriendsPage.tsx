import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiErrorMessage } from '../api/client'
import { getDashboard } from '../api/dashboardApi'
import { listFriends } from '../api/friendsApi'
import { listGroups } from '../api/groupsApi'
import {
  answerFriendInvitation,
  answerGroupInvitation,
  getInvitations,
} from '../api/invitationsApi'
import type { BalanceContact, FriendInvitation, FriendshipSummary, GroupInvitation, GroupSummary, Invitations } from '../api/types'
import { DATA_CHANGED_EVENT, notifyDataChanged } from '../utils/events'
import { displayName, formatCad } from '../utils/format'

export function FriendsPage() {
  const [friends, setFriends] = useState<FriendshipSummary[]>([])
  const [groups, setGroups] = useState<GroupSummary[]>([])
  const [invitations, setInvitations] = useState<Invitations | null>(null)
  const [balances, setBalances] = useState<BalanceContact[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [nextFriends, dashboard, nextGroups, nextInvitations] = await Promise.all([
        listFriends(),
        getDashboard(),
        listGroups(),
        getInvitations(),
      ])
      setFriends(nextFriends)
      setBalances(dashboard.balances)
      setGroups(nextGroups)
      setInvitations(nextInvitations)
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Unable to load friends data.'))
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

  async function answer(
    kind: 'friend' | 'group',
    invitationId: string,
    decision: 'accept' | 'decline',
  ) {
    setError(null)
    try {
      if (kind === 'friend') {
        await answerFriendInvitation(invitationId, decision)
      } else {
        await answerGroupInvitation(invitationId, decision)
      }
      notifyDataChanged()
      await load()
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Unable to update invitation.'))
    }
  }

  const receivedFriends = invitations?.receivedFriends ?? []
  const receivedGroups = invitations?.receivedGroups ?? []
  const sentFriends = invitations?.sentFriends ?? []
  const sentGroups = invitations?.sentGroups ?? []
  const receivedPending =
    receivedFriends.filter((invite) => invite.status === 'pending').length +
    receivedGroups.filter((invite) => invite.status === 'pending').length

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Connections</p>
          <h1>Friends</h1>
          <p>Direct bills are available once an invitation is accepted.</p>
        </div>
      </header>
      <section className="panel">
        <div className="panel-title">
          <h2>Accepted friends</h2>
          <span className="count-pill">{friends.length}</span>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        {friends.length === 0 ? (
          <p className="empty-state">Send a friend invitation using the quick action above.</p>
        ) : (
          <div className="group-list">
            {friends.map((friendship) => {
              const balance = balances.find((item) => item.friendshipId === friendship.id)
              const balanceCents = balance?.balanceCents ?? 0
              const balanceClass =
                balanceCents > 0
                  ? 'positive'
                  : balanceCents < 0
                    ? 'negative'
                    : 'settled'
              const balanceLabel =
                balanceCents > 0
                  ? formatCad(balanceCents)
                  : balanceCents < 0
                    ? formatCad(-balanceCents)
                    : 'Settled'

              return (
                <Link className="group-row" key={friendship.id} to={`/friends/${friendship.id}`}>
                  <div>
                    <strong>{displayName(friendship.friend)}</strong>
                    <span>{friendship.friend.email}</span>
                  </div>
                  <small className={`balance-chip ${balanceClass}`}>{balanceLabel}</small>
                </Link>
              )
            })}
          </div>
        )}
      </section>
      <div className="invitation-grid">
        <section className="panel">
          <div className="panel-title">
            <h2>Pending invitations</h2>
            <span className="count-pill">{receivedPending}</span>
          </div>
          {receivedFriends
            .filter((invite) => invite.status === 'pending')
            .map((invite) => (
              <InvitationRow
                description={`${displayName(invite.sender)} wants to be friends.`}
                invite={invite}
                key={invite.id}
                onAnswer={(decision) => void answer('friend', invite.id, decision)}
              />
            ))}
          {receivedGroups
            .filter((invite) => invite.status === 'pending')
            .map((invite) => (
              <InvitationRow
                description={`${displayName(invite.sender)} invited you to ${invite.group.name}.`}
                invite={invite}
                key={invite.id}
                onAnswer={(decision) => void answer('group', invite.id, decision)}
              />
            ))}
          {invitations && receivedPending === 0 ? (
            <p className="empty-state">Nothing waiting for your response.</p>
          ) : null}
        </section>
        <section className="panel">
          <h2>Sent invitations</h2>
          <div className="sent-invitations">
            {sentFriends.map((invite) => (
              <SentRow
                description={`Friend request to ${inviteRecipientLabel(invite)}`}
                invite={invite}
                key={invite.id}
              />
            ))}
            {sentGroups.map((invite) => (
              <SentRow
                description={`${inviteRecipientLabel(invite)} to ${invite.group.name}`}
                invite={invite}
                key={invite.id}
              />
            ))}
            {invitations && sentFriends.length === 0 && sentGroups.length === 0 ? (
              <p className="empty-state">No invitations sent yet.</p>
            ) : null}
          </div>
        </section>
      </div>
      <section className="panel">
        <div className="panel-title">
          <h2>Groups (quick-select sets)</h2>
          <span className="count-pill">{groups.length}</span>
        </div>
        {groups.length === 0 ? (
          <p className="empty-state">Create a group using the quick action above.</p>
        ) : (
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
        )}
      </section>
    </section>
  )
}

function inviteRecipientLabel(invite: FriendInvitation | GroupInvitation): string {
  if (invite.recipient) {
    return displayName(invite.recipient)
  }
  return invite.recipientEmail ?? 'pending recipient'
}

function InvitationRow({
  description,
  invite,
  onAnswer,
}: {
  description: string;
  invite: FriendInvitation | GroupInvitation;
  onAnswer: (decision: 'accept' | 'decline') => void;
}) {
  return (
    <article className="invitation-row">
      <p>
        <strong>{description}</strong>
        <span>Sent {new Date(invite.createdAt).toLocaleDateString()}</span>
      </p>
      <div className="dialog-actions">
        <button className="quiet-button" onClick={() => onAnswer('decline')} type="button">
          Decline
        </button>
        <button className="primary-button compact" onClick={() => onAnswer('accept')} type="button">
          Accept
        </button>
      </div>
    </article>
  )
}

function SentRow({
  description,
  invite,
}: {
  description: string;
  invite: FriendInvitation | GroupInvitation;
}) {
  return (
    <article className="sent-row">
      <div>
        <strong>{description}</strong>
        <span>{new Date(invite.createdAt).toLocaleDateString()}</span>
      </div>
      <small className={`status ${invite.status}`}>{invite.status}</small>
    </article>
  )
}
