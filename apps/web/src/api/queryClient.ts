import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000,
    },
    mutations: {
      retry: 0,
    },
  },
})

export const queryKeys = {
  activity: ['activity'] as const,
  bills: ['bills'] as const,
  bill: (billId: string) => ['bills', billId] as const,
  dashboard: ['dashboard'] as const,
  friends: ['friends'] as const,
  friend: (friendshipId: string) => ['friends', friendshipId] as const,
  groups: ['groups'] as const,
  group: (groupId: string) => ['groups', groupId] as const,
  invitations: ['invitations'] as const,
}

async function invalidateKeys(keys: ReadonlyArray<readonly unknown[]>): Promise<void> {
  await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
}

export function invalidateBillData(): Promise<void> {
  return invalidateKeys([
    queryKeys.dashboard,
    queryKeys.bills,
    queryKeys.friends,
    queryKeys.groups,
    queryKeys.activity,
  ])
}

export function invalidatePeopleData(): Promise<void> {
  return invalidateKeys([
    queryKeys.dashboard,
    queryKeys.friends,
    queryKeys.invitations,
    queryKeys.activity,
  ])
}

export function invalidateGroupData(): Promise<void> {
  return invalidateKeys([
    queryKeys.dashboard,
    queryKeys.groups,
    queryKeys.activity,
  ])
}
