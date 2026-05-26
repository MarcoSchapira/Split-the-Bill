import { apiClient } from './client'
import type { ActivityEvent } from './types'

export async function listActivity(): Promise<ActivityEvent[]> {
  const response = await apiClient.get<{ activity: ActivityEvent[] }>('/activity')
  return response.data.activity
}
