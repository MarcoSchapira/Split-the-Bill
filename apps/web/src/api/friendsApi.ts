import { apiClient } from './client'
import type { FriendInvitation, FriendshipDetail, FriendshipSummary } from './types'

export async function listFriends(): Promise<FriendshipSummary[]> {
  const response = await apiClient.get<{ friends: FriendshipSummary[] }>('/friends')
  return response.data.friends
}

export async function getFriendship(friendshipId: string): Promise<FriendshipDetail> {
  const response = await apiClient.get<{ friendship: FriendshipDetail }>(
    `/friends/${friendshipId}`,
  )
  return response.data.friendship
}

export async function inviteFriend(email: string): Promise<FriendInvitation> {
  const response = await apiClient.post<{ invitation: FriendInvitation }>(
    '/friend-invitations',
    { email },
  )
  return response.data.invitation
}

export async function settleFriend(friendshipId: string): Promise<{ settledCount: number }> {
  const response = await apiClient.post<{ settledCount: number }>(
    `/friends/${friendshipId}/settle`,
  )
  return response.data
}
