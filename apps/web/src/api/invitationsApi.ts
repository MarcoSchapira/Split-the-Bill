import { apiClient } from './client'
import type { FriendInvitation, GroupInvitation, Invitations } from './types'

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

export async function answerGroupInvitation(
  invitationId: string,
  decision: 'accept' | 'decline',
): Promise<GroupInvitation> {
  const response = await apiClient.patch<{ invitation: GroupInvitation }>(
    `/group-invitations/${invitationId}`,
    { decision },
  )
  return response.data.invitation
}
