import { apiClient } from './client'
import type { GroupDetail, GroupInvitation, GroupSummary } from './types'

export async function listGroups(): Promise<GroupSummary[]> {
  const response = await apiClient.get<{ groups: GroupSummary[] }>('/groups')
  return response.data.groups
}

export async function createGroup(name: string): Promise<GroupSummary> {
  const response = await apiClient.post<{ group: GroupSummary }>('/groups', {
    name,
  })
  return response.data.group
}

export async function getGroup(groupId: string): Promise<GroupDetail> {
  const response = await apiClient.get<{ group: GroupDetail }>(
    `/groups/${groupId}`,
  )
  return response.data.group
}

export async function inviteGroupMember(
  groupId: string,
  email: string,
): Promise<GroupInvitation> {
  const response = await apiClient.post<{ invitation: GroupInvitation }>(
    `/groups/${groupId}/invitations`,
    { email },
  )
  return response.data.invitation
}
