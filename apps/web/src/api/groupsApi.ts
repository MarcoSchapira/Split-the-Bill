import { apiClient } from './client'
import type { GroupDetail, GroupMember, GroupSummary } from './types'

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

export async function addMember(
  groupId: string,
  email: string,
): Promise<GroupMember> {
  const response = await apiClient.post<{ member: GroupMember }>(
    `/groups/${groupId}/members`,
    { email },
  )
  return response.data.member
}
