import { api } from './client';
import type {
  GroupDetail,
  GroupIconKey,
  GroupSummary,
} from './types';

export type CreateGroupInput = {
  name: string;
  iconKey: GroupIconKey;
};

export type UpdateGroupInput = {
  name?: string;
  iconKey?: GroupIconKey;
};

export type AddGroupMemberInput = {
  userId: string;
};

export async function listGroups() {
  const response = await api.get<{ groups: GroupSummary[] }>('/groups');
  return response.data.groups;
}

export async function getGroup(groupId: string) {
  const response = await api.get<{ group: GroupDetail }>(`/groups/${groupId}`);
  return response.data.group;
}

export async function createGroup(input: CreateGroupInput) {
  const response = await api.post<{ group: GroupSummary }>('/groups', input);
  return response.data.group;
}

export async function updateGroup(groupId: string, input: UpdateGroupInput) {
  const response = await api.patch<{ group: GroupSummary }>(
    `/groups/${groupId}`,
    input,
  );
  return response.data.group;
}

export async function deleteGroup(groupId: string) {
  await api.delete(`/groups/${groupId}`);
}

export async function addGroupMember(groupId: string, input: AddGroupMemberInput) {
  const response = await api.post<{ group: GroupDetail }>(
    `/groups/${groupId}/members`,
    input,
  );
  return response.data.group;
}

export async function removeGroupMember(groupId: string, userId: string) {
  const response = await api.delete<{ group: GroupDetail }>(
    `/groups/${groupId}/members/${userId}`,
  );
  return response.data?.group ?? null;
}

export async function leaveGroup(groupId: string) {
  const response = await api.post<{ group: GroupDetail }>(
    `/groups/${groupId}/leave`,
  );
  return response.data?.group ?? null;
}
