import { apiClient } from './client'
import type { ActivityEvent } from './types'

export async function listActivity(): Promise<ActivityEvent[]> {
  const response = await apiClient.get<{ activity: ActivityEvent[] }>('/activity')
  return response.data.activity
}

export async function deleteActivity(eventId: string): Promise<void> {
  await apiClient.delete(`/activity/${eventId}`)
}
