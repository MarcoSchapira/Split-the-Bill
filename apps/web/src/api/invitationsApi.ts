import { apiClient } from './client'
import type { FriendInvitation, Invitations } from './types'

export async function getInvitations(): Promise<Invitations> {
  const response = await apiClient.get<Invitations>('/invitations')
  return response.data
}

export async function answerFriendInvitation(
  invitationId: string,
  decision: 'accept' | 'decline',
): Promise<FriendInvitation> {
  const response = await apiClient.patch<{ invitation: FriendInvitation }>(
    `/friend-invitations/${invitationId}`,
    { decision },
  )
  return response.data.invitation
}

export async function cancelFriendInvitation(invitationId: string): Promise<void> {
  await apiClient.delete(`/friend-invitations/${invitationId}`)
}

