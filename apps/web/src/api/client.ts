import axios from 'axios'
import { clearAuth, getCsrfToken } from '../auth/authStorage'

export const AUTH_UNAUTHORIZED_EVENT = 'equisplit:unauthorized'

function resolveBaseUrl(): string {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }

  // Local dev uses the Vite proxy; production uses the Cloudflare Pages /api rewrite.
  return '/api'
}

export const apiClient = axios.create({
  baseURL: resolveBaseUrl(),
  withCredentials: true,
})

apiClient.interceptors.request.use((config) => {
  const method = config.method?.toUpperCase()
  if (method && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    const csrfToken = getCsrfToken()
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken
    }
  }

  return config
})

let logoutInFlight = false

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      !error.config?.url?.includes('/auth/login') &&
      !error.config?.url?.includes('/auth/register') &&
      !error.config?.url?.includes('/auth/register/send-code') &&
      !logoutInFlight
    ) {
      logoutInFlight = true
      try {
        await apiClient.post('/auth/logout', undefined, {
          headers: { 'X-CSRF-Token': getCsrfToken() ?? '' },
        })
      } catch {
        clearAuth()
      } finally {
        logoutInFlight = false
        clearAuth()
        window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT))
      }
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

  const data = error.response.data as { error?: { message?: string; code?: string } }
  if (data.error?.code === 'USER_NOT_FOUND') {
    return 'Invitation sent.'
  }
  return data.error?.message ?? fallback
}
