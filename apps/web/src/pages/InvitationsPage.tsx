import { Navigate } from 'react-router-dom'

export function InvitationsPage() {
  return <Navigate replace to="/friends?tab=invitations" />
}
