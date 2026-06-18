import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { ProtectedRoute, PublicOnlyRoute } from './auth/ProtectedRoute'
import { AppLayout } from './layouts/AppLayout'
import { ActivityPage } from './pages/ActivityPage'
import { BillDetailPage } from './pages/BillDetailPage'
import { BillsPage } from './pages/BillsPage'
import { DashboardPage } from './pages/DashboardPage'
import { FriendDetailPage } from './pages/FriendDetailPage'
import { FriendsPage } from './pages/FriendsPage'
import { GroupDetailPage } from './pages/GroupDetailPage'
import { LandingPage } from './pages/LandingPage'
import { OldLandingPage } from './pages/OldLandingPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/old-home" element={<OldLandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/activity" element={<ActivityPage />} />
              <Route path="/bills" element={<BillsPage />} />
              <Route path="/bills/:billId" element={<BillDetailPage />} />
              <Route path="/friends" element={<FriendsPage />} />
              <Route path="/friends/:friendshipId" element={<FriendDetailPage />} />
              <Route path="/groups/:groupId" element={<GroupDetailPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
