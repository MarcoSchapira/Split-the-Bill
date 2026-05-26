import axios from 'axios'
import { clearAuth, getToken } from '../auth/authStorage'

export const AUTH_UNAUTHORIZED_EVENT = 'equisplit:unauthorized'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
})

apiClient.interceptors.request.use((config) => {
  const token = getToken()

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      getToken()
    ) {
      clearAuth()
      window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT))
    }

    return Promise.reject(error)
  },
)

export function apiErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (!axios.isAxiosError(error)) {
    return fallback
  }

  if (!error.response) {
    return 'Unable to connect to the server.'
  }

  const data = error.response.data as { error?: { message?: string } }
  return data.error?.message ?? fallback
}
