import axios, { type InternalAxiosRequestConfig } from 'axios'
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

type RetriableRequest = InternalAxiosRequestConfig & {
  _billCompassRetried?: boolean;
}

let refreshInFlight: Promise<void> | null = null

const noRefreshPaths = [
  '/auth/login',
  '/auth/register',
  '/auth/register/send-code',
  '/auth/refresh',
  '/auth/logout',
  '/auth/account/send-delete-code',
  '/auth/account/verify-delete-code',
  '/auth/account/confirm-delete',
]

function shouldAttemptRefresh(config: RetriableRequest | undefined): boolean {
  if (!config || config._billCompassRetried) return false
  const requestPath = config.url?.split('?')[0]
  return !noRefreshPaths.includes(requestPath ?? '')
}

function announceUnauthorized() {
  clearAuth()
  window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT))
}

export async function refreshBrowserSession(): Promise<void> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        await apiClient.post('/auth/refresh')
      } catch (refreshError) {
        announceUnauthorized()
        throw refreshError
      } finally {
        refreshInFlight = null
      }
    })()
  }
  return refreshInFlight
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const config = error.config as RetriableRequest | undefined

      if (!config || !shouldAttemptRefresh(config)) {
        return Promise.reject(error)
      }

      config._billCompassRetried = true
      try {
        await refreshBrowserSession()
        return apiClient.request(config)
      } catch (refreshError) {
        return Promise.reject(refreshError)
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
  return data.error?.message ?? fallback
}
