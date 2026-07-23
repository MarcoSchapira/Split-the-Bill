import { lazy, Suspense, useEffect, type ReactElement } from 'react'
import { Navigate, Outlet, RouterProvider, createBrowserRouter, useLocation } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { ProtectedRoute, PublicOnlyRoute } from './auth/ProtectedRoute'
import { AppLayout } from './layouts/AppLayout'
import { LandingPage } from './pages/LandingPage'
import { OldLandingPage } from './pages/OldLandingPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import './App.css'
import './styles/workspace.css'

const ActivityPage = lazy(() =>
  import('./pages/ActivityPage').then(({ ActivityPage }) => ({ default: ActivityPage })),
)
const BillDetailPage = lazy(() =>
  import('./pages/BillDetailPage').then(({ BillDetailPage }) => ({ default: BillDetailPage })),
)
const BillComposerPage = lazy(() =>
  import('./pages/BillComposerPage').then(({ BillComposerPage }) => ({ default: BillComposerPage })),
)
const BillsPage = lazy(() =>
  import('./pages/BillsPage').then(({ BillsPage }) => ({ default: BillsPage })),
)
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then(({ DashboardPage }) => ({ default: DashboardPage })),
)
const DeleteAccountPage = lazy(() =>
  import('./pages/DeleteAccountPage').then(({ DeleteAccountPage }) => ({ default: DeleteAccountPage })),
)
const FriendDetailPage = lazy(() =>
  import('./pages/FriendDetailPage').then(({ FriendDetailPage }) => ({ default: FriendDetailPage })),
)
const FriendsPage = lazy(() =>
  import('./pages/FriendsPage').then(({ FriendsPage }) => ({ default: FriendsPage })),
)
const GroupDetailPage = lazy(() =>
  import('./pages/GroupDetailPage').then(({ GroupDetailPage }) => ({ default: GroupDetailPage })),
)
const GroupsPage = lazy(() =>
  import('./pages/GroupsPage').then(({ GroupsPage }) => ({ default: GroupsPage })),
)
const PrivacyPolicyPage = lazy(() =>
  import('./pages/PrivacyPolicyPage').then(({ PrivacyPolicyPage }) => ({ default: PrivacyPolicyPage })),
)
const RequestsPage = lazy(() =>
  import('./pages/RequestsPage').then(({ RequestsPage }) => ({ default: RequestsPage })),
)
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then(({ SettingsPage }) => ({ default: SettingsPage })),
)
const TermsOfServicePage = lazy(() =>
  import('./pages/TermsOfServicePage').then(({ TermsOfServicePage }) => ({ default: TermsOfServicePage })),
)

function deferredPage(element: ReactElement) {
  return (
    <Suspense
      fallback={
        <section aria-busy="true" aria-label="Loading page" className="bc-page" role="status">
          <div aria-hidden="true" className="bc-skeleton" />
          <div aria-hidden="true" className="bc-skeleton" />
        </section>
      }
    >
      {element}
    </Suspense>
  )
}

function titleForPath(pathname: string) {
  if (pathname === '/') return 'BillCompass — Shared expenses, clear balances'
  if (pathname === '/login') return 'Log in — BillCompass'
  if (pathname === '/register') return 'Create account — BillCompass'
  if (pathname === '/privacy') return 'Privacy Policy — BillCompass'
  if (pathname === '/terms') return 'Terms of Service — BillCompass'
  if (pathname === '/delete-account') return 'Delete account — BillCompass'
  if (pathname === '/dashboard') return 'Dashboard — BillCompass'
  if (pathname === '/bills/new') return 'New bill — BillCompass'
  if (/^\/bills\/[^/]+\/edit$/.test(pathname)) return 'Edit bill — BillCompass'
  if (/^\/bills\/[^/]+$/.test(pathname)) return 'Bill details — BillCompass'
  if (pathname.startsWith('/bills')) return 'Bills — BillCompass'
  if (pathname.startsWith('/requests')) return 'Requests — BillCompass'
  if (/^\/groups\/[^/]+$/.test(pathname)) return 'Group details — BillCompass'
  if (pathname.startsWith('/groups')) return 'Groups — BillCompass'
  if (/^\/friends\/[^/]+$/.test(pathname)) return 'Person details — BillCompass'
  if (pathname.startsWith('/friends') || pathname.startsWith('/invitations')) return 'People — BillCompass'
  if (pathname.startsWith('/activity')) return 'Activity — BillCompass'
  if (pathname.startsWith('/settings')) return 'Settings — BillCompass'
  return 'BillCompass'
}

function RouteEffects() {
  const { pathname } = useLocation()

  useEffect(() => {
    document.title = titleForPath(pathname)
    let observer: MutationObserver | null = null

    const focusPageHeading = () => {
      const heading = document.querySelector<HTMLElement>('#main-content h1')
      if (!heading) return false
      heading.tabIndex = -1
      heading.focus({ preventScroll: true })
      window.scrollTo({ top: 0, behavior: 'auto' })
      return true
    }

    if (!focusPageHeading()) {
      observer = new MutationObserver(() => {
        if (focusPageHeading()) observer?.disconnect()
      })
      observer.observe(document.body, { childList: true, subtree: true })
    }

    return () => observer?.disconnect()
  }, [pathname])

  return <Outlet />
}

const router = createBrowserRouter([
  {
    element: <RouteEffects />,
    children: [
      { path: '/privacy', element: deferredPage(<PrivacyPolicyPage />) },
      { path: '/terms', element: deferredPage(<TermsOfServicePage />) },
      { path: '/delete-account', element: deferredPage(<DeleteAccountPage />) },
      {
        element: <PublicOnlyRoute />,
        children: [
          { path: '/', element: <LandingPage /> },
          { path: '/old-home', element: <OldLandingPage /> },
          { path: '/login', element: <LoginPage /> },
          { path: '/register', element: <RegisterPage /> },
        ],
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { path: '/dashboard', element: deferredPage(<DashboardPage />) },
              { path: '/activity', element: deferredPage(<ActivityPage />) },
              { path: '/bills', element: deferredPage(<BillsPage />) },
              { path: '/bills/new', element: deferredPage(<BillComposerPage />) },
              { path: '/bills/:billId/edit', element: deferredPage(<BillComposerPage />) },
              { path: '/bills/:billId', element: deferredPage(<BillDetailPage />) },
              { path: '/requests', element: deferredPage(<RequestsPage />) },
              { path: '/groups', element: deferredPage(<GroupsPage />) },
              { path: '/groups/:groupId', element: deferredPage(<GroupDetailPage />) },
              { path: '/friends', element: deferredPage(<FriendsPage />) },
              { path: '/friends/:friendshipId', element: deferredPage(<FriendDetailPage />) },
              { path: '/invitations', element: <Navigate to="/friends?tab=invitations" replace /> },
              { path: '/settings', element: deferredPage(<SettingsPage />) },
            ],
          },
        ],
      },
      { path: '*', element: <Navigate to="/dashboard" replace /> },
    ],
  },
])

function App() {
  return <AuthProvider><RouterProvider router={router} /></AuthProvider>
}

export default App
