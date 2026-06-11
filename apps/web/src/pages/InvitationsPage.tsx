import { useCallback, useEffect, useState } from 'react'
import { apiErrorMessage } from '../api/client'
import {
  answerFriendInvitation,
  answerGroupInvitation,
  getInvitations,
} from '../api/invitationsApi'
import type { FriendInvitation, GroupInvitation, Invitations } from '../api/types'
import { DATA_CHANGED_EVENT, notifyDataChanged } from '../utils/events'
import { displayName } from '../utils/format'

export function InvitationsPage() {
  const [invitations, setInvitations] = useState<Invitations | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setInvitations(await getInvitations())
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Unable to load invitations.'))
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

  const receivedPending =
    (invitations?.receivedFriends.filter((invite) => invite.status === 'pending').length ?? 0) +
    (invitations?.receivedGroups.filter((invite) => invite.status === 'pending').length ?? 0)

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Requests</p>
          <h1>Invitations</h1>
          <p>Friendships and memberships activate only when accepted.</p>
        </div>
      </header>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="invitation-grid">
        <section className="panel">
          <div className="panel-title">
            <h2>Waiting for you</h2>
            <span className="count-pill">{receivedPending}</span>
          </div>
          {invitations?.receivedFriends
            .filter((invite) => invite.status === 'pending')
            .map((invite) => (
              <InvitationRow
                description={`${displayName(invite.sender)} wants to be friends.`}
                invite={invite}
                key={invite.id}
                onAnswer={(decision) => void answer('friend', invite.id, decision)}
              />
            ))}
          {invitations?.receivedGroups
            .filter((invite) => invite.status === 'pending')
            .map((invite) => (
              <InvitationRow
                description={`${displayName(invite.sender)} invited you to ${invite.group.name}.`}
                invite={invite}
                key={invite.id}
                onAnswer={(decision) => void answer('group', invite.id, decision)}
              />
            ))}
          {receivedPending === 0 ? <p className="empty-state">Nothing waiting for your response.</p> : null}
        </section>
        <section className="panel">
          <h2>Sent invitations</h2>
          <div className="sent-invitations">
            {invitations?.sentFriends.map((invite) => (
              <SentRow
                description={`Friend request to ${inviteRecipientLabel(invite)}`}
                invite={invite}
                key={invite.id}
              />
            ))}
            {invitations?.sentGroups.map((invite) => (
              <SentRow
                description={`${inviteRecipientLabel(invite)} to ${invite.group.name}`}
                invite={invite}
                key={invite.id}
              />
            ))}
            {invitations &&
            invitations.sentFriends.length === 0 &&
            invitations.sentGroups.length === 0 ? (
              <p className="empty-state">No invitations sent yet.</p>
            ) : null}
          </div>
        </section>
      </div>
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
