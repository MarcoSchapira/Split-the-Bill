import * as AlertDialog from '@radix-ui/react-alert-dialog'
import * as Dialog from '@radix-ui/react-dialog'
import * as Tabs from '@radix-ui/react-tabs'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  LogOut,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Trash2,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-react'
import { createElement } from 'react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { apiErrorMessage } from '../api/client'
import { listFriends } from '../api/friendsApi'
import {
  addGroupMember,
  deleteGroup,
  getGroup,
  leaveGroup,
  removeGroupMember,
} from '../api/groupsApi'
import { invalidateGroupData, queryKeys } from '../api/queryClient'
import type { Bill, GroupDetail, GroupMemberDetail, User } from '../api/types'
import { useAuth } from '../auth/useAuth'
import { GroupFormDialog } from '../components/GroupFormDialog'
import { useDialogFocus } from '../components/ui/useDialogFocus'
import { useToast } from '../components/ui/useToast'
import { displayName, formatCad } from '../utils/format'
import { groupIcon } from '../utils/groupIcons'
import '../styles/social.css'

type GroupTab = 'overview' | 'bills' | 'members'

export function GroupDetailPage() {
  const { groupId = '' } = useParams()
  const auth = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [editOpen, setEditOpen] = useState(false)
  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<GroupMemberDetail | null>(null)
  const editDialogFocus = useDialogFocus()
  const addMemberDialogFocus = useDialogFocus()
  const removeMemberDialogFocus = useDialogFocus()
  const leaveDialogFocus = useDialogFocus()
  const deleteDialogFocus = useDialogFocus()
  const requestedTab = searchParams.get('tab')
  const selectedTab: GroupTab = requestedTab === 'bills' || requestedTab === 'members' ? requestedTab : 'overview'

  const groupQuery = useQuery({
    enabled: Boolean(groupId),
    queryKey: queryKeys.group(groupId),
    queryFn: () => getGroup(groupId),
  })
  const friendsQuery = useQuery({ queryKey: queryKeys.friends, queryFn: listFriends })
  const group = groupQuery.data
  const currentUserId = auth.user?.id ?? ''
  const isCreator = group?.creatorId === currentUserId

  async function refreshGroup() {
    await invalidateGroupData()
  }

  const removeMemberMutation = useMutation({
    mutationFn: (member: GroupMemberDetail) => removeGroupMember(groupId, member.user.id),
    onSuccess: async (_, member) => {
      setMemberToRemove(null)
      showToast(`${displayName(member.user)} was removed. Existing bills were not changed.`, 'success')
      await refreshGroup()
    },
    onError: (error) => showToast(apiErrorMessage(error, 'Unable to remove member.'), 'error'),
  })
  const leaveMutation = useMutation({
    mutationFn: () => leaveGroup(groupId),
    onSuccess: async () => {
      setLeaveOpen(false)
      showToast('You left the group. Existing bill history was kept.', 'success')
      await invalidateGroupData()
      navigate('/groups', { replace: true })
    },
    onError: (error) => showToast(apiErrorMessage(error, 'Unable to leave group.'), 'error'),
  })
  const deleteMutation = useMutation({
    mutationFn: () => deleteGroup(groupId),
    onSuccess: async () => {
      setDeleteOpen(false)
      showToast('Group deleted.', 'success')
      await invalidateGroupData()
      navigate('/groups', { replace: true })
    },
    onError: (error) => showToast(apiErrorMessage(error, 'Unable to delete group.'), 'error'),
  })

  function selectTab(tab: GroupTab) {
    setSearchParams(tab === 'overview' ? {} : { tab })
  }

  if (!groupId) return <p className="bc-error">Group not found.</p>
  if (groupQuery.isPending) return <section className="bc-page"><div className="bc-skeleton social-detail-skeleton" /><div className="bc-skeleton" /></section>
  if (groupQuery.error || !group) {
    return (
      <section className="bc-page">
        <Link className="social-back-link" to="/groups"><ArrowLeft aria-hidden="true" size={16} />Back to groups</Link>
        <div className="bc-error" role="alert">{apiErrorMessage(groupQuery.error, 'Unable to load group.')}</div>
      </section>
    )
  }

  const balance = group.netBalanceCents
  const BalanceIcon = balance >= 0 ? ArrowDownLeft : ArrowUpRight
  const memberIds = new Set(group.members.map((member) => member.user.id))
  const availableFriends = (friendsQuery.data ?? [])
    .map((friendship) => friendship.friend)
    .filter((friend) => !memberIds.has(friend.id))

  return (
    <section className="bc-page social-page">
      <Link className="social-back-link" to="/groups"><ArrowLeft aria-hidden="true" size={16} />Back to groups</Link>
      <header className="social-group-hero bc-card">
        <div className="social-group-hero__identity">
          <div className="social-group-icon social-group-icon--large">{createElement(groupIcon(group.iconKey), { 'aria-hidden': true, size: 30 })}</div>
          <div><p className="bc-eyebrow">{group.members.length} {group.members.length === 1 ? 'member' : 'members'} · Created {formatShortDate(group.createdAt)}</p><h1>{group.name}</h1><span>Created by {displayName(group.creator)}</span></div>
        </div>
        <div className="social-group-hero__actions">
          <Link className="bc-button bc-button--primary" to={`/bills/new?groupId=${group.id}`}><Plus aria-hidden="true" size={17} />Add expense</Link>
          <button className="bc-button" onClick={() => { addMemberDialogFocus.capture(); setAddMemberOpen(true) }} type="button"><UserPlus aria-hidden="true" size={17} />Add member</button>
          <button className="bc-icon-button" aria-label="Edit group" onClick={() => { editDialogFocus.capture(); setEditOpen(true) }} type="button"><Pencil aria-hidden="true" size={17} /></button>
        </div>
        <div className="social-group-metrics">
          <div className={balance > 0 ? 'is-positive' : balance < 0 ? 'is-negative' : ''}>
            <BalanceIcon aria-hidden="true" size={18} />
            <span><small>{balance > 0 ? 'You are owed' : balance < 0 ? 'You owe' : 'Your balance'}</small><strong>{balance === 0 ? 'Settled up' : formatCad(Math.abs(balance))}</strong></span>
          </div>
          <div><ReceiptText aria-hidden="true" size={18} /><span><small>Total group spending</small><strong>{formatCad(group.totalGroupSpendCents)}</strong></span></div>
          <div className={group.unsettledBillCount > 0 ? 'is-warning' : ''}><Clock3 aria-hidden="true" size={18} /><span><small>Unresolved bills</small><strong>{group.unsettledBillCount}</strong></span></div>
        </div>
      </header>

      <Tabs.Root value={selectedTab} onValueChange={(value) => selectTab(value as GroupTab)}>
      <Tabs.List aria-label="Group sections" className="social-tabs social-tabs--three">
        <Tabs.Trigger className={selectedTab === 'overview' ? 'is-active' : ''} value="overview">Overview</Tabs.Trigger>
        <Tabs.Trigger className={selectedTab === 'bills' ? 'is-active' : ''} value="bills"><ReceiptText aria-hidden="true" size={18} />Bills<span>{group.billCount}</span></Tabs.Trigger>
        <Tabs.Trigger className={selectedTab === 'members' ? 'is-active' : ''} value="members"><UsersRound aria-hidden="true" size={18} />Members<span>{group.members.length}</span></Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content className="social-tab-panel" value={selectedTab}>

      {selectedTab === 'overview' ? (
        <GroupOverview group={group} onAddMember={() => { addMemberDialogFocus.capture(); setAddMemberOpen(true) }} onShowBills={() => selectTab('bills')} />
      ) : selectedTab === 'bills' ? (
        <GroupBills bills={group.bills} groupId={group.id} />
      ) : (
        <GroupMembers
          currentUserId={currentUserId}
          group={group}
          isCreator={isCreator}
          onAddMember={() => { addMemberDialogFocus.capture(); setAddMemberOpen(true) }}
          onDelete={() => { deleteDialogFocus.capture(); setDeleteOpen(true) }}
          onLeave={() => { leaveDialogFocus.capture(); setLeaveOpen(true) }}
          onRemove={(member) => { removeMemberDialogFocus.capture(); setMemberToRemove(member) }}
        />
      )}
      </Tabs.Content>
      </Tabs.Root>

      <GroupFormDialog group={group} onCloseAutoFocus={editDialogFocus.restore} onOpenChange={setEditOpen} open={editOpen} />
      <AddMemberDialog
        error={friendsQuery.error}
        friends={availableFriends}
        group={group}
        isLoading={friendsQuery.isPending}
        onCloseAutoFocus={addMemberDialogFocus.restore}
        onOpenChange={setAddMemberOpen}
        onRetry={() => void friendsQuery.refetch()}
        onSaved={() => void refreshGroup()}
        open={addMemberOpen}
      />
      <MembershipConfirmDialog
        actionLabel="Remove member"
        description={memberToRemove ? `${displayName(memberToRemove.user)} will remain on all current bills, but will not be included in future group expenses.` : ''}
        isPending={removeMemberMutation.isPending}
        onCloseAutoFocus={removeMemberDialogFocus.restore}
        onConfirm={() => { if (memberToRemove) removeMemberMutation.mutate(memberToRemove) }}
        onOpenChange={(open) => { if (!open) setMemberToRemove(null) }}
        open={memberToRemove !== null}
        title={memberToRemove ? `Remove ${displayName(memberToRemove.user)}?` : 'Remove member?'}
      />
      <MembershipConfirmDialog
        actionLabel="Leave group"
        description={`You will remain on every current bill in ${group.name}, but you will not be included in future expenses.${isCreator && group.members.length > 1 ? ' Group ownership will transfer to the longest-tenured remaining member.' : ''}`}
        isPending={leaveMutation.isPending}
        onCloseAutoFocus={leaveDialogFocus.restore}
        onConfirm={() => leaveMutation.mutate()}
        onOpenChange={setLeaveOpen}
        open={leaveOpen}
        title={`Leave ${group.name}?`}
      />
      <MembershipConfirmDialog
        actionLabel="Delete group"
        danger
        description={`Permanently delete ${group.name}. This is available only while the group has no bills.`}
        isPending={deleteMutation.isPending}
        onCloseAutoFocus={deleteDialogFocus.restore}
        onConfirm={() => deleteMutation.mutate()}
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
        title={`Delete ${group.name}?`}
      />
    </section>
  )
}

function GroupOverview({ group, onAddMember, onShowBills }: { group: GroupDetail; onAddMember: () => void; onShowBills: () => void }) {
  const recentBills = group.bills.slice(0, 4)
  return (
    <div className="social-group-overview">
      <section className="bc-card social-detail-section">
        <div className="social-section-heading"><div><h2>Recent expenses</h2><p>The latest bills shared with this group.</p></div>{group.billCount > 0 ? <button className="bc-button bc-button--ghost" onClick={onShowBills} type="button">View all</button> : null}</div>
        {recentBills.length === 0 ? <div className="bc-empty"><ReceiptText aria-hidden="true" size={27} /><strong>No group bills yet</strong><p>Add an expense to split it evenly with current members.</p></div> : <BillRows bills={recentBills} />}
      </section>
      <section className="bc-card social-detail-section">
        <div className="social-section-heading"><div><h2>Members</h2><p>New membership changes apply only to future bills.</p></div><button className="bc-button bc-button--soft" onClick={onAddMember} type="button"><UserPlus aria-hidden="true" size={16} />Add</button></div>
        <div className="social-member-preview">
          {group.members.slice(0, 6).map((member) => <div key={member.id}><div className="social-avatar">{avatarInitial(member.user)}</div><span><strong>{displayName(member.user)}</strong><small>{member.isCreator ? 'Creator' : member.user.email}</small></span></div>)}
        </div>
      </section>
    </div>
  )
}

function GroupBills({ bills, groupId }: { bills: Bill[]; groupId: string }) {
  return (
    <section className="bc-card social-detail-section">
      <div className="social-section-heading"><div><h2>Group bills</h2><p>Historical participants stay attached even when membership changes.</p></div><Link className="bc-button bc-button--primary" to={`/bills/new?groupId=${groupId}`}><Plus aria-hidden="true" size={16} />Add expense</Link></div>
      {bills.length === 0 ? <div className="bc-empty"><ReceiptText aria-hidden="true" size={28} /><strong>No expenses yet</strong><p>Create the first group bill when you’re ready.</p></div> : <BillRows bills={bills} />}
    </section>
  )
}

function BillRows({ bills }: { bills: Bill[] }) {
  return (
    <div className="social-bill-list">
      {bills.map((bill) => (
        <Link className="social-bill-row" key={bill.id} to={`/bills/${bill.id}`}>
          <div className="social-bill-row__icon"><ReceiptText aria-hidden="true" size={18} /></div>
          <div><strong>{bill.description || bill.storeName || 'Bill'}</strong><span>{formatShortDate(bill.incurredAt)} · Paid by {displayName(bill.payer)}</span></div>
          <div><small>Total</small><strong>{formatCad(bill.totalCents)}</strong></div>
        </Link>
      ))}
    </div>
  )
}

function GroupMembers({
  currentUserId,
  group,
  isCreator,
  onAddMember,
  onDelete,
  onLeave,
  onRemove,
}: {
  currentUserId: string;
  group: GroupDetail;
  isCreator: boolean;
  onAddMember: () => void;
  onDelete: () => void;
  onLeave: () => void;
  onRemove: (member: GroupMemberDetail) => void;
}) {
  return (
    <div className="social-members-layout">
      <section className="bc-card social-detail-section">
        <div className="social-section-heading"><div><h2>Group members</h2><p>Only the creator can remove another member.</p></div><button className="bc-button bc-button--soft" onClick={onAddMember} type="button"><UserPlus aria-hidden="true" size={16} />Add member</button></div>
        <div className="social-member-list">
          {group.members.map((member) => {
            const isSelf = member.user.id === currentUserId
            return (
              <article key={member.id}>
                <div className="social-avatar">{avatarInitial(member.user)}</div>
                <div><strong>{displayName(member.user)}{isSelf ? ' (you)' : ''}</strong><span>{member.user.email}</span><small><CalendarDays aria-hidden="true" size={12} />Joined {formatShortDate(member.joinedAt)}</small></div>
                {member.isCreator ? <span className="bc-badge bc-badge--positive">Creator</span> : isCreator && !isSelf ? <button aria-label={`Remove ${displayName(member.user)}`} className="bc-icon-button social-danger-icon" onClick={() => onRemove(member)} type="button"><X aria-hidden="true" size={17} /></button> : null}
              </article>
            )
          })}
        </div>
      </section>
      <aside className="bc-card social-danger-zone">
        <div><AlertTriangle aria-hidden="true" size={21} /><span><h2>Membership</h2><p>Leaving or removing someone changes future bills only. Current bill shares remain intact.</p></span></div>
        <button className="bc-button" onClick={onLeave} type="button"><LogOut aria-hidden="true" size={16} />Leave group</button>
        {isCreator ? (
          <div className="social-delete-group">
            <button className="bc-button bc-button--danger" disabled={group.permissions?.canDelete !== true} onClick={onDelete} type="button"><Trash2 aria-hidden="true" size={16} />Delete group</button>
            {group.permissions?.canDelete !== true ? <small>Groups with current or historical bill records cannot be deleted.</small> : null}
          </div>
        ) : null}
      </aside>
    </div>
  )
}

function AddMemberDialog({
  error,
  friends,
  group,
  isLoading,
  onCloseAutoFocus,
  onOpenChange,
  onRetry,
  onSaved,
  open,
}: {
  error: unknown;
  friends: User[];
  group: GroupDetail;
  isLoading: boolean;
  onCloseAutoFocus: (event: Event) => void;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
  onSaved: () => void;
  open: boolean;
}) {
  const { showToast } = useToast()
  const [query, setQuery] = useState('')
  const filteredFriends = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return friends
    return friends.filter((friend) => displayName(friend).toLowerCase().includes(normalized) || friend.email.toLowerCase().includes(normalized))
  }, [friends, query])
  const mutation = useMutation({
    mutationFn: (friend: User) => addGroupMember(group.id, { userId: friend.id }),
    onSuccess: (_, friend) => {
      setQuery('')
      onOpenChange(false)
      showToast(`${displayName(friend)} was added to ${group.name}.`, 'success')
      onSaved()
    },
    onError: (error) => showToast(apiErrorMessage(error, 'Unable to add member.'), 'error'),
  })

  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="social-dialog-overlay" />
        <Dialog.Content className="social-dialog social-add-member-dialog" aria-describedby="add-member-description" onCloseAutoFocus={onCloseAutoFocus}>
          <div className="social-dialog__header"><div><p className="bc-eyebrow">{group.name}</p><Dialog.Title>Add a member</Dialog.Title></div><Dialog.Close aria-label="Close add member dialog" className="bc-icon-button"><X aria-hidden="true" size={18} /></Dialog.Close></div>
          <Dialog.Description id="add-member-description">Choose one of your friends. They will join future group expenses only; existing bills never change.</Dialog.Description>
          <label className="social-search"><Search aria-hidden="true" size={18} /><span className="social-sr-only">Search available friends</span><input onChange={(event) => setQuery(event.target.value)} placeholder="Search friends" type="search" value={query} /></label>
          <div className="social-add-member-list">
            {error ? <div className="bc-error" role="alert"><span>{apiErrorMessage(error, 'Unable to load friends.')}</span><button className="bc-button" onClick={onRetry} type="button">Retry</button></div> : isLoading ? <div className="bc-skeleton" /> : filteredFriends.length === 0 ? <div className="bc-empty"><UsersRound aria-hidden="true" size={26} /><strong>No friends available</strong><p>{friends.length === 0 ? 'Invite or accept a friend before adding them to this group.' : 'No friends match your search.'}</p></div> : filteredFriends.map((friend) => (
              <button disabled={mutation.isPending} key={friend.id} onClick={() => mutation.mutate(friend)} type="button">
                <div className="social-avatar">{avatarInitial(friend)}</div><span><strong>{displayName(friend)}</strong><small>{friend.email}</small></span><UserPlus aria-hidden="true" size={18} />
              </button>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function MembershipConfirmDialog({
  actionLabel,
  danger = false,
  description,
  isPending,
  onCloseAutoFocus,
  onConfirm,
  onOpenChange,
  open,
  title,
}: {
  actionLabel: string;
  danger?: boolean;
  description: string;
  isPending: boolean;
  onCloseAutoFocus: (event: Event) => void;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}) {
  return (
    <AlertDialog.Root onOpenChange={onOpenChange} open={open}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="social-dialog-overlay" />
        <AlertDialog.Content className="social-dialog social-confirm-dialog" onCloseAutoFocus={onCloseAutoFocus}>
          <div className={`social-confirm-dialog__icon ${danger ? 'is-danger' : ''}`}>{danger ? <Trash2 aria-hidden="true" size={27} /> : <UsersRound aria-hidden="true" size={27} />}</div>
          <AlertDialog.Title>{title}</AlertDialog.Title>
          <AlertDialog.Description>{description}</AlertDialog.Description>
          <div className="social-dialog__actions"><AlertDialog.Cancel asChild><button className="bc-button" disabled={isPending} type="button">Cancel</button></AlertDialog.Cancel><button className={`bc-button ${danger ? 'bc-button--danger' : 'bc-button--primary'}`} disabled={isPending} onClick={onConfirm} type="button">{isPending ? 'Updating…' : actionLabel}</button></div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}

function avatarInitial(user: { name: string | null; email: string }): string {
  return (user.name?.trim()[0] ?? user.email[0] ?? '?').toUpperCase()
}

function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat('en-CA', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value))
}
