import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { apiErrorMessage } from '../api/client'
import { inviteFriend, listFriends } from '../api/friendsApi'
import type { FriendshipSummary } from '../api/types'
import { useAuth } from '../auth/useAuth'
import { BillForm } from '../components/BillForm'
import { Modal } from '../components/Modal'
import { DATA_CHANGED_EVENT, notifyDataChanged } from '../utils/events'

const navigation = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/activity', label: 'Recent Activity' },
  { to: '/bills', label: 'Bills' },
  { to: '/friends', label: 'Friends' },
  { to: '/invitations', label: 'Invitations' },
]

export function AppLayout() {
  const [dialog, setDialog] = useState<'friend' | null>(null)
  const [showBillForm, setShowBillForm] = useState(false)
  const [friends, setFriends] = useState<FriendshipSummary[]>([])
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const auth = useAuth()
  const navigate = useNavigate()

  const loadBillFormData = useCallback(async () => {
    const nextFriends = await listFriends()
    setFriends(nextFriends)
  }, [])

  useEffect(() => {
    const reload = () => {
      if (showBillForm) {
        void loadBillFormData()
      }
    }
    window.addEventListener(DATA_CHANGED_EVENT, reload)
    return () => window.removeEventListener(DATA_CHANGED_EVENT, reload)
  }, [loadBillFormData, showBillForm])

  useEffect(() => {
    if (!notice) {
      return
    }

    const timeoutId = window.setTimeout(() => setNotice(null), 4000)
    return () => window.clearTimeout(timeoutId)
  }, [notice])

  function openFriendDialog() {
    setError(null)
    setDialog('friend')
  }

  function closeDialog() {
    setDialog(null)
    setError(null)
    setEmail('')
  }

  async function openBillForm() {
    setError(null)
    try {
      await loadBillFormData()
      setShowBillForm(true)
    } catch (requestError) {
      setNotice(apiErrorMessage(requestError, 'Unable to open bill form.'))
    }
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
      navigate('/invitations')
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Unable to send invitation.'))
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
          <div className="sidebar-account-info">
            <div className="sidebar-account-ident">
              <strong>{auth.user?.name ?? 'Your account'}</strong>
              <span>{auth.user?.email}</span>
            </div>
            <Link
              aria-label="Settings"
              className="icon-button sidebar-settings-button"
              to="/settings"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
            </Link>
          </div>
          <button className="quiet-button" onClick={logout} type="button">
            Log out
          </button>
        </div>
      </aside>
      <main className="workspace-main">
        <div className="floating-actions">
          {notice ? <span className="floating-notice">{notice}</span> : null}
          <div className="floating-actions-buttons">
            <button className="secondary-button floating-button" onClick={openFriendDialog} type="button">
              + Add friend
            </button>
            <button className="primary-button compact floating-button" onClick={() => void openBillForm()} type="button">
              + New bill
            </button>
          </div>
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
      {showBillForm ? (
        <Modal onClose={() => setShowBillForm(false)} title="Add a bill">
          <BillForm
            friends={friends}
            onCancel={() => setShowBillForm(false)}
            onSaved={() => {
              setShowBillForm(false)
              setNotice('Bill saved.')
              notifyDataChanged()
            }}
          />
        </Modal>
      ) : null}
    </div>
  )
}
