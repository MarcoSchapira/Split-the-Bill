import { apiClient } from './client'
import type {
  GroupDetail,
  GroupIconKey,
  GroupSummary,
} from './types'

export type CreateGroupInput = {
  name: string;
  iconKey: GroupIconKey;
}

export type UpdateGroupInput = {
  name?: string;
  iconKey?: GroupIconKey;
}

export type AddGroupMemberInput = {
  userId: string;
}

export async function listGroups(): Promise<GroupSummary[]> {
  const response = await apiClient.get<{ groups: GroupSummary[] }>('/groups')
  return response.data.groups
}

export async function getGroup(groupId: string): Promise<GroupDetail> {
  const response = await apiClient.get<{ group: GroupDetail }>(`/groups/${groupId}`)
  return response.data.group
}

export async function createGroup(input: CreateGroupInput): Promise<GroupSummary> {
  const response = await apiClient.post<{ group: GroupSummary }>('/groups', input)
  return response.data.group
}

export async function updateGroup(groupId: string, input: UpdateGroupInput): Promise<GroupSummary> {
  const response = await apiClient.patch<{ group: GroupSummary }>(
    `/groups/${groupId}`,
    input,
  )
  return response.data.group
}

export async function deleteGroup(groupId: string): Promise<void> {
  await apiClient.delete(`/groups/${groupId}`)
}

export async function addGroupMember(groupId: string, input: AddGroupMemberInput): Promise<GroupDetail> {
  const response = await apiClient.post<{ group: GroupDetail }>(
    `/groups/${groupId}/members`,
    input,
  )
  return response.data.group
}

export async function removeGroupMember(groupId: string, userId: string): Promise<GroupDetail | null> {
  const response = await apiClient.delete<{ group: GroupDetail }>(
    `/groups/${groupId}/members/${userId}`,
  )
  return response.data?.group ?? null
}

export async function leaveGroup(groupId: string): Promise<GroupDetail | null> {
  const response = await apiClient.post<{ group: GroupDetail }>(
    `/groups/${groupId}/leave`,
  )
  return response.data?.group ?? null
}
