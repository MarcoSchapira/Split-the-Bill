import { apiClient } from './client'
import type { Dashboard } from './types'

export async function getDashboard(): Promise<Dashboard> {
  const response = await apiClient.get<{ dashboard: Dashboard }>('/dashboard')
  return response.data.dashboard
}
