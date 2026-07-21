import { zodResolver } from '@hookform/resolvers/zod'
import * as Dialog from '@radix-ui/react-dialog'
import * as Tabs from '@radix-ui/react-tabs'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Check,
  Clock3,
  MailPlus,
  Search,
  Send,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { listBills } from '../api/billsApi'
import { apiErrorMessage } from '../api/client'
import { getDashboard } from '../api/dashboardApi'
import { inviteFriend, listFriends } from '../api/friendsApi'
import {
  answerFriendInvitation,
  cancelFriendInvitation,
  getInvitations,
} from '../api/invitationsApi'
import { invalidatePeopleData, queryKeys } from '../api/queryClient'
import type { FriendInvitation } from '../api/types'
import { useAuth } from '../auth/useAuth'
import { useToast } from '../components/ui/useToast'
import { useDialogFocus } from '../components/ui/useDialogFocus'
import { displayName, formatCad } from '../utils/format'
import { requestItemsForFriend } from '../utils/requests'
import '../styles/social.css'

const inviteSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
})

type InviteForm = z.infer<typeof inviteSchema>

const INVITE_FORM_ERROR_ID = 'invite-form-error'
const INVITE_EMAIL_ERROR_ID = 'invite-email-error'

export function FriendsPage() {
  const auth = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)
  const inviteDialogFocus = useDialogFocus()
  const selectedTab = searchParams.get('tab') === 'invitations' ? 'invitations' : 'people'

  const friendsQuery = useQuery({ queryKey: queryKeys.friends, queryFn: listFriends })
  const dashboardQuery = useQuery({ queryKey: queryKeys.dashboard, queryFn: getDashboard })
  const invitationsQuery = useQuery({ queryKey: queryKeys.invitations, queryFn: getInvitations })
  const billsQuery = useQuery({ queryKey: queryKeys.bills, queryFn: () => listBills() })

  const pendingReceived = (invitationsQuery.data?.receivedFriends ?? []).filter(
    (invitation) => invitation.status === 'pending',
  )
  const filteredFriends = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const friends = friendsQuery.data ?? []
    if (!normalizedQuery) return friends
    return friends.filter(({ friend }) =>
      displayName(friend).toLowerCase().includes(normalizedQuery) ||
      friend.email.toLowerCase().includes(normalizedQuery),
    )
  }, [friendsQuery.data, query])

  return (
    <section className="bc-page social-page">
      <header className="bc-page-header">
        <div className="bc-page-header__copy">
          <p className="bc-eyebrow">Connections</p>
          <h1 className="bc-page-title">People</h1>
          <p className="bc-page-subtitle">Invite people you trust, then see every balance and shared request in one place.</p>
        </div>
        <button className="bc-button bc-button--primary" onClick={() => { inviteDialogFocus.capture(); setInviteOpen(true) }} type="button">
          <UserPlus aria-hidden="true" size={17} />Invite someone
        </button>
      </header>

      <Tabs.Root value={selectedTab} onValueChange={(value) => setSearchParams(value === 'invitations' ? { tab: 'invitations' } : {})}>
      <Tabs.List aria-label="People sections" className="social-tabs">
        <Tabs.Trigger
          className={selectedTab === 'people' ? 'is-active' : ''}
          value="people"
        >
          <UsersRound aria-hidden="true" size={18} />
          Friends
          <span>{friendsQuery.data?.length ?? 0}</span>
        </Tabs.Trigger>
        <Tabs.Trigger
          className={selectedTab === 'invitations' ? 'is-active' : ''}
          value="invitations"
        >
          <MailPlus aria-hidden="true" size={18} />
          Invitations
          {pendingReceived.length > 0 ? <span className="is-attention">{pendingReceived.length}</span> : null}
        </Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content className="social-tab-panel" value={selectedTab}>

      {selectedTab === 'people' ? (
        <PeoplePanel
          authUserId={auth.user?.id ?? ''}
          balances={dashboardQuery.data?.balances ?? []}
          bills={billsQuery.data ?? []}
          error={friendsQuery.error ?? dashboardQuery.error ?? billsQuery.error}
          friends={filteredFriends}
          isLoading={friendsQuery.isPending || dashboardQuery.isPending || billsQuery.isPending}
          onInvite={() => { inviteDialogFocus.capture(); setInviteOpen(true) }}
          onQueryChange={setQuery}
          query={query}
        />
      ) : (
        <InvitationsPanel
          currentUserId={auth.user?.id ?? ''}
          error={invitationsQuery.error}
          invitations={invitationsQuery.data}
          isLoading={invitationsQuery.isPending}
          onInvite={() => { inviteDialogFocus.capture(); setInviteOpen(true) }}
        />
      )}
      </Tabs.Content>
      </Tabs.Root>

      <InviteDialog onCloseAutoFocus={inviteDialogFocus.restore} onOpenChange={setInviteOpen} open={inviteOpen} />
    </section>
  )
}

function PeoplePanel({
  authUserId,
  balances,
  bills,
  error,
  friends,
  isLoading,
  onInvite,
  onQueryChange,
  query,
}: {
  authUserId: string;
  balances: Awaited<ReturnType<typeof getDashboard>>['balances'];
  bills: Awaited<ReturnType<typeof listBills>>;
  error: unknown;
  friends: Awaited<ReturnType<typeof listFriends>>;
  isLoading: boolean;
  onInvite: () => void;
  onQueryChange: (value: string) => void;
  query: string;
}) {
  return (
    <section className="bc-card social-people-card">
      <div className="social-toolbar">
        <label className="social-search">
          <Search aria-hidden="true" size={18} />
          <span className="social-sr-only">Search friends</span>
          <input
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search by name or email"
            type="search"
            value={query}
          />
        </label>
        <p>{friends.length} {friends.length === 1 ? 'person' : 'people'}</p>
      </div>

      {error ? <p className="bc-error" role="alert">{apiErrorMessage(error, 'Some people data could not be loaded.')}</p> : null}
      {isLoading ? (
        <div className="social-person-grid">
          <div className="bc-skeleton" /><div className="bc-skeleton" /><div className="bc-skeleton" />
        </div>
      ) : friends.length === 0 ? (
        <div className="bc-empty social-empty">
          <UsersRound aria-hidden="true" size={28} />
          <strong>{query ? 'No friends match your search' : 'Splitting is better together'}</strong>
          <p>{query ? 'Try another name or email.' : 'Invite someone with a BillCompass account to start sharing expenses.'}</p>
          {!query ? <button className="bc-button bc-button--primary" onClick={onInvite} type="button">Invite someone</button> : null}
        </div>
      ) : (
        <div className="social-person-grid">
          {friends.map((friendship) => {
            const balance = balances.find((item) => item.friendshipId === friendship.id)?.balanceCents ?? 0
            const openRequests = authUserId
              ? requestItemsForFriend({
                  bills,
                  currentUserId: authUserId,
                  friendUserId: friendship.friend.id,
                }).length
              : 0
            return (
              <Link className="social-person-card" key={friendship.id} to={`/friends/${friendship.id}`}>
                <div className="social-avatar">{avatarInitial(friendship.friend)}</div>
                <div className="social-person-card__identity">
                  <strong>{displayName(friendship.friend)}</strong>
                  <span>{friendship.friend.email}</span>
                </div>
                <div className="social-person-card__balance">
                  <small>{balance > 0 ? 'owes you' : balance < 0 ? 'you owe' : 'balance'}</small>
                  <strong className={balance > 0 ? 'bc-positive' : balance < 0 ? 'bc-negative' : ''}>
                    {balance === 0 ? 'Settled' : formatCad(Math.abs(balance))}
                  </strong>
                </div>
                <div className={`social-person-card__requests ${openRequests > 0 ? 'has-open' : ''}`}>
                  <Clock3 aria-hidden="true" size={14} />
                  {openRequests > 0 ? `${openRequests} open` : 'No open requests'}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}

function InvitationsPanel({
  currentUserId,
  error,
  invitations,
  isLoading,
  onInvite,
}: {
  currentUserId: string;
  error: unknown;
  invitations: Awaited<ReturnType<typeof getInvitations>> | undefined;
  isLoading: boolean;
  onInvite: () => void;
}) {
  const { showToast } = useToast()
  const answerMutation = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'accept' | 'decline' }) =>
      answerFriendInvitation(id, decision),
    onSuccess: async (_, variables) => {
      showToast(variables.decision === 'accept' ? 'Invitation accepted.' : 'Invitation declined.', 'success')
      await invalidatePeopleData()
    },
    onError: (requestError) => showToast(apiErrorMessage(requestError, 'Unable to update invitation.'), 'error'),
  })
  const cancelMutation = useMutation({
    mutationFn: cancelFriendInvitation,
    onSuccess: async () => {
      showToast('Invitation cancelled.', 'success')
      await invalidatePeopleData()
    },
    onError: (requestError) => showToast(apiErrorMessage(requestError, 'Unable to cancel invitation.'), 'error'),
  })
  const received = invitations?.receivedFriends ?? []
  const sent = invitations?.sentFriends ?? []
  const pendingReceived = received.filter((invitation) => invitation.status === 'pending')
  const pendingSent = sent.filter((invitation) => invitation.status === 'pending')
  const history = [...received, ...sent]
    .filter((invitation) => invitation.status !== 'pending')
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))

  if (isLoading) {
    return <div className="social-invitation-grid"><div className="bc-skeleton" /><div className="bc-skeleton" /></div>
  }

  return (
    <div className="social-invitation-stack">
      {error ? <p className="bc-error" role="alert">{apiErrorMessage(error, 'Unable to load invitations.')}</p> : null}
      <div className="social-invitation-grid">
        <section className="bc-card">
          <div className="bc-card-header">
            <div><p className="bc-eyebrow">Received</p><h2 className="bc-card-title">Waiting for you</h2></div>
            <span className="bc-badge bc-badge--warning">{pendingReceived.length}</span>
          </div>
          {pendingReceived.length === 0 ? (
            <div className="bc-empty"><Check aria-hidden="true" size={25} /><strong>You’re all caught up</strong><p>No invitations need your response.</p></div>
          ) : (
            <div className="social-invitation-list">
              {pendingReceived.map((invitation) => (
                <article className="social-invitation" key={invitation.id}>
                  <div className="social-avatar">{avatarInitial(invitation.sender)}</div>
                  <div><strong>{displayName(invitation.sender)}</strong><span>{invitation.sender.email}</span><small>Sent {formatInviteDate(invitation.createdAt)}</small></div>
                  <div className="social-invitation__actions">
                    <button
                      className="bc-button bc-button--ghost"
                      disabled={answerMutation.isPending}
                      onClick={() => answerMutation.mutate({ id: invitation.id, decision: 'decline' })}
                      type="button"
                    >Decline</button>
                    <button
                      className="bc-button bc-button--primary"
                      disabled={answerMutation.isPending}
                      onClick={() => answerMutation.mutate({ id: invitation.id, decision: 'accept' })}
                      type="button"
                    >Accept</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="bc-card">
          <div className="bc-card-header">
            <div><p className="bc-eyebrow">Sent</p><h2 className="bc-card-title">Awaiting a response</h2></div>
            <span className="bc-badge">{pendingSent.length}</span>
          </div>
          {pendingSent.length === 0 ? (
            <div className="bc-empty"><Send aria-hidden="true" size={25} /><strong>No pending invitations</strong><p>Invite another BillCompass user when you’re ready.</p><button className="bc-button bc-button--soft" onClick={onInvite} type="button">Send invitation</button></div>
          ) : (
            <div className="social-invitation-list">
              {pendingSent.map((invitation) => (
                <article className="social-invitation" key={invitation.id}>
                  <div className="social-avatar">{avatarInitial(invitation.recipient)}</div>
                  <div><strong>{invitationRecipient(invitation)}</strong><span>{invitation.recipient?.email ?? invitation.recipientEmail}</span><small>Sent {formatInviteDate(invitation.createdAt)}</small></div>
                  <button
                    className="bc-button bc-button--danger"
                    disabled={cancelMutation.isPending && cancelMutation.variables === invitation.id}
                    onClick={() => cancelMutation.mutate(invitation.id)}
                    type="button"
                  >{cancelMutation.isPending && cancelMutation.variables === invitation.id ? 'Cancelling…' : 'Cancel'}</button>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {history.length > 0 ? (
        <section className="bc-card social-invitation-history">
          <div className="bc-card-header"><h2 className="bc-card-title">Recent invitation history</h2></div>
          <div className="social-history-list">
            {history.slice(0, 8).map((invitation) => (
              <div key={invitation.id}>
                <span>{invitationCounterparty(invitation, currentUserId)}</span>
                <small>{formatInviteDate(invitation.createdAt)}</small>
                <b className={`bc-badge ${invitation.status === 'accepted' ? 'bc-badge--positive' : 'bc-badge--danger'}`}>{invitation.status}</b>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

function InviteDialog({ open, onCloseAutoFocus, onOpenChange }: { open: boolean; onCloseAutoFocus: (event: Event) => void; onOpenChange: (open: boolean) => void }) {
  const { showToast } = useToast()
  const form = useForm<InviteForm>({ resolver: zodResolver(inviteSchema), defaultValues: { email: '' } })
  const inviteMutation = useMutation({
    mutationFn: ({ email }: InviteForm) => inviteFriend(email),
    onSuccess: async () => {
      form.reset()
      onOpenChange(false)
      showToast('Friend invitation sent.', 'success')
      await invalidatePeopleData()
    },
    onError: (error) => form.setError('root', { message: apiErrorMessage(error, 'Unable to send invitation.') }),
  })

  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="social-dialog-overlay" />
        <Dialog.Content className="social-dialog" aria-describedby="invite-description" onCloseAutoFocus={onCloseAutoFocus}>
          <div className="social-dialog__header">
            <div><p className="bc-eyebrow">New connection</p><Dialog.Title>Invite someone</Dialog.Title></div>
            <Dialog.Close aria-label="Close invitation dialog" className="bc-icon-button"><X aria-hidden="true" size={18} /></Dialog.Close>
          </div>
          <Dialog.Description id="invite-description">They need an existing BillCompass account. Friendship starts only after they accept.</Dialog.Description>
          <form
            aria-describedby={form.formState.errors.root ? INVITE_FORM_ERROR_ID : undefined}
            className="bc-form"
            onSubmit={form.handleSubmit((values) => inviteMutation.mutate(values))}
          >
            {form.formState.errors.root ? <p className="bc-error" id={INVITE_FORM_ERROR_ID} role="alert">{form.formState.errors.root.message}</p> : null}
            <label className="bc-field">Email address
              <input
                aria-describedby={form.formState.errors.email ? INVITE_EMAIL_ERROR_ID : undefined}
                aria-invalid={Boolean(form.formState.errors.email)}
                autoComplete="email"
                autoFocus
                placeholder="friend@example.com"
                type="email"
                {...form.register('email')}
              />
              {form.formState.errors.email ? <span className="bc-field__error" id={INVITE_EMAIL_ERROR_ID} role="alert">{form.formState.errors.email.message}</span> : null}
            </label>
            <div className="social-dialog__actions">
              <Dialog.Close asChild><button className="bc-button" type="button">Cancel</button></Dialog.Close>
              <button className="bc-button bc-button--primary" disabled={inviteMutation.isPending} type="submit">
                <Send aria-hidden="true" size={16} />{inviteMutation.isPending ? 'Sending…' : 'Send invitation'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function avatarInitial(user: { name: string | null; email: string } | null | undefined): string {
  return (user?.name?.trim()[0] ?? user?.email?.[0] ?? '?').toUpperCase()
}

function invitationRecipient(invitation: FriendInvitation): string {
  return invitation.recipient ? displayName(invitation.recipient) : invitation.recipientEmail ?? 'Pending recipient'
}

function invitationCounterparty(invitation: FriendInvitation, currentUserId: string): string {
  return invitation.sender.id === currentUserId
    ? invitationRecipient(invitation)
    : displayName(invitation.sender)
}

function formatInviteDate(value: string): string {
  return new Intl.DateTimeFormat('en-CA', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}
