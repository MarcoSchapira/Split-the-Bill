import { useState, type FormEvent } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { apiErrorMessage } from '../api/client'
import { inviteFriend } from '../api/friendsApi'
import { createGroup } from '../api/groupsApi'
import { useAuth } from '../auth/useAuth'
import { Modal } from '../components/Modal'
import { notifyDataChanged } from '../utils/events'

const navigation = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/activity', label: 'Recent Activity' },
  { to: '/bills', label: 'Bills' },
  { to: '/friends', label: 'Friends' },
]

export function AppLayout() {
  const [dialog, setDialog] = useState<'friend' | 'group' | null>(null)
  const [email, setEmail] = useState('')
  const [groupName, setGroupName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const auth = useAuth()
  const navigate = useNavigate()

  function openDialog(nextDialog: 'friend' | 'group') {
    setError(null)
    setDialog(nextDialog)
  }

  function closeDialog() {
    setDialog(null)
    setError(null)
    setEmail('')
    setGroupName('')
  }

  async function submitFriend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSaving(true)

    try {
      await inviteFriend(email)
      setNotice('Friend invitation sent.')
      notifyDataChanged()
      closeDialog()
      navigate('/friends')
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Unable to send invitation.'))
    } finally {
      setIsSaving(false)
    }
  }

  async function submitGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSaving(true)

    try {
      await createGroup(groupName)
      setNotice('Group created.')
      notifyDataChanged()
      closeDialog()
      navigate('/friends')
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Unable to create group.'))
    } finally {
      setIsSaving(false)
    }
  }

  async function logout() {
    await auth.logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="workspace-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <p className="eyebrow">EquiSplit</p>
          <strong>Split the Bill</strong>
        </div>
        <nav className="sidebar-nav" aria-label="Primary navigation">
          {navigation.map((item) => (
            <NavLink
              className={({ isActive }) => `nav-tab${isActive ? ' active' : ''}`}
              key={item.to}
              to={item.to}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-account">
          <strong>{auth.user?.name ?? 'Your account'}</strong>
          <span>{auth.user?.email}</span>
          <button className="quiet-button" onClick={logout} type="button">
            Log out
          </button>
        </div>
      </aside>
      <main className="workspace-main">
        <div className="quick-actions">
          {notice ? <span className="action-notice">{notice}</span> : null}
          <button className="secondary-button" onClick={() => openDialog('friend')} type="button">
            + Add friend
          </button>
          <button className="primary-button compact" onClick={() => openDialog('group')} type="button">
            + Create new group
          </button>
        </div>
        <Outlet />
      </main>
      {dialog === 'friend' ? (
        <Modal onClose={closeDialog} title="Add a friend">
          <p className="muted">Send an invitation to an existing EquiSplit account.</p>
          <form className="stack-form" onSubmit={submitFriend}>
            <label>
              Registered email
              <input
                autoFocus
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <button className="primary-button" disabled={isSaving} type="submit">
              {isSaving ? 'Sending...' : 'Send invitation'}
            </button>
          </form>
        </Modal>
      ) : null}
      {dialog === 'group' ? (
        <Modal onClose={closeDialog} title="Create new group">
          <form className="stack-form" onSubmit={submitGroup}>
            <label>
              Group name
              <input
                autoFocus
                maxLength={100}
                required
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
              />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <button className="primary-button" disabled={isSaving} type="submit">
              {isSaving ? 'Creating...' : 'Create group'}
            </button>
          </form>
        </Modal>
      ) : null}
    </div>
  )
}
