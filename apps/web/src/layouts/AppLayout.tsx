import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  Activity,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  ReceiptText,
  Settings,
  Shapes,
  UsersRound,
  WalletCards,
} from 'lucide-react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { displayName } from '../utils/format'

const primaryNavigation = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/bills', label: 'Bills', icon: ReceiptText },
  { to: '/requests', label: 'Requests', icon: WalletCards },
  { to: '/groups', label: 'Groups', icon: Shapes },
  { to: '/friends', label: 'People', icon: UsersRound },
  { to: '/activity', label: 'Activity', icon: Activity },
]

const mobileNavigation = primaryNavigation.slice(0, 4)

function Brand() {
  return (
    <Link aria-label="BillCompass dashboard" className="bc-brand" to="/dashboard">
      <span className="bc-brand__mark"><ReceiptText aria-hidden="true" size={20} /></span>
      <span>
        <strong>BillCompass</strong>
        <small>Shared expenses, clear</small>
      </span>
    </Link>
  )
}

export function AppLayout() {
  const auth = useAuth()
  const navigate = useNavigate()

  async function logout() {
    await auth.logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="bc-workspace">
      <a className="bc-skip-link" href="#main-content">Skip to main content</a>
      <aside className="bc-sidebar">
        <Brand />
        <Link className="bc-button bc-button--primary bc-sidebar__create" to="/bills/new">
          <Plus aria-hidden="true" size={18} />
          New bill
        </Link>
        <nav aria-label="Primary navigation" className="bc-nav">
          {primaryNavigation.map(({ icon: Icon, label, to }) => (
            <NavLink className={({ isActive }) => `bc-nav__link${isActive ? ' is-active' : ''}`} key={to} to={to}>
              <Icon aria-hidden="true" size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="bc-sidebar__account">
          <div className="bc-avatar" aria-hidden="true">
            {(auth.user?.name?.trim()[0] ?? auth.user?.email[0] ?? '?').toUpperCase()}
          </div>
          <div className="bc-sidebar__identity">
            <strong>{displayName(auth.user)}</strong>
            <span>{auth.user?.email}</span>
          </div>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger aria-label="Open account menu" className="bc-icon-button">
              <ChevronRight aria-hidden="true" size={18} />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" className="bc-menu" sideOffset={10}>
                <DropdownMenu.Item asChild>
                  <Link className="bc-menu__item" to="/settings"><Settings size={17} />Settings</Link>
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="bc-menu__separator" />
                <DropdownMenu.Item className="bc-menu__item bc-menu__item--danger" onSelect={() => void logout()}>
                  <LogOut size={17} />Log out
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </aside>

      <header className="bc-mobile-header">
        <Brand />
        <div className="bc-mobile-header__actions">
          <Link aria-label="Create a new bill" className="bc-icon-button bc-icon-button--accent" to="/bills/new">
            <Plus aria-hidden="true" size={20} />
          </Link>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger aria-label="Open menu" className="bc-icon-button">
              <Menu aria-hidden="true" size={21} />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" className="bc-menu" sideOffset={10}>
                <DropdownMenu.Label className="bc-menu__label">{displayName(auth.user)}</DropdownMenu.Label>
                <DropdownMenu.Item asChild>
                  <Link className="bc-menu__item" to="/friends"><UsersRound size={17} />People</Link>
                </DropdownMenu.Item>
                <DropdownMenu.Item asChild>
                  <Link className="bc-menu__item" to="/activity"><Activity size={17} />Activity</Link>
                </DropdownMenu.Item>
                <DropdownMenu.Item asChild>
                  <Link className="bc-menu__item" to="/settings"><Settings size={17} />Settings</Link>
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="bc-menu__separator" />
                <DropdownMenu.Item className="bc-menu__item bc-menu__item--danger" onSelect={() => void logout()}>
                  <LogOut size={17} />Log out
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </header>

      <main className="bc-main" id="main-content" tabIndex={-1}>
        <Outlet />
      </main>

      <nav aria-label="Mobile navigation" className="bc-bottom-nav">
        {mobileNavigation.map(({ icon: Icon, label, to }) => (
          <NavLink className={({ isActive }) => `bc-bottom-nav__link${isActive ? ' is-active' : ''}`} key={to} to={to}>
            <Icon aria-hidden="true" size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
