import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { apiClient, AUTH_UNAUTHORIZED_EVENT } from '../api/client'
import { queryClient } from '../api/queryClient'
import type { User } from '../api/types'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './useAuth'

const server = setupServer()

const storedUser: User = {
  id: 'user-1',
  email: 'person@example.com',
  name: 'Person',
  createdAt: '2026-07-01T12:00:00.000Z',
  aiReceiptConsentAt: null,
}

function AuthProbe() {
  const auth = useAuth()

  return (
    <output data-testid="auth-state">
      {auth.isLoading ? 'loading' : 'ready'}|{auth.user?.email ?? 'signed-out'}
    </output>
  )
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

afterEach(() => {
  cleanup()
  server.resetHandlers()
  localStorage.clear()
  queryClient.clear()
})

afterAll(() => server.close())

describe('browser session recovery', () => {
  it('shares one refresh across concurrent 401 responses and retries both requests once', async () => {
    let refreshed = false
    let refreshCalls = 0
    let protectedCalls = 0
    const onUnauthorized = vi.fn()
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized)

    server.use(
      http.get('*/api/single-flight-test', () => {
        protectedCalls += 1
        return refreshed
          ? HttpResponse.json({ ok: true })
          : new HttpResponse(null, { status: 401 })
      }),
      http.post('*/api/auth/refresh', async () => {
        refreshCalls += 1
        await delay(25)
        refreshed = true
        return new HttpResponse(null, { status: 204 })
      }),
    )

    try {
      const responses = await Promise.all([
        apiClient.get<{ ok: boolean }>('/single-flight-test'),
        apiClient.get<{ ok: boolean }>('/single-flight-test'),
      ])

      expect(responses.map((response) => response.data.ok)).toEqual([true, true])
      expect(refreshCalls).toBe(1)
      expect(protectedCalls).toBe(4)
      expect(onUnauthorized).not.toHaveBeenCalled()
    } finally {
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized)
    }
  })

  it('clears the session once when a shared refresh fails', async () => {
    localStorage.setItem('equisplit_user', JSON.stringify(storedUser))
    let refreshCalls = 0
    const onUnauthorized = vi.fn()
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized)

    server.use(
      http.get('*/api/failed-refresh-test', () => new HttpResponse(null, { status: 401 })),
      http.post('*/api/auth/refresh', async () => {
        refreshCalls += 1
        await delay(25)
        return new HttpResponse(null, { status: 401 })
      }),
    )

    try {
      const results = await Promise.allSettled([
        apiClient.get('/failed-refresh-test'),
        apiClient.get('/failed-refresh-test'),
      ])

      expect(results.every((result) => result.status === 'rejected')).toBe(true)
      expect(refreshCalls).toBe(1)
      expect(onUnauthorized).toHaveBeenCalledTimes(1)
      expect(localStorage.getItem('equisplit_user')).toBeNull()
    } finally {
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized)
    }
  })

  it('preserves the stored session when the startup identity request fails transiently', async () => {
    localStorage.setItem('equisplit_user', JSON.stringify(storedUser))
    server.use(
      http.get('*/api/auth/me', () =>
        HttpResponse.json(
          { error: { message: 'Temporary outage' } },
          { status: 500 },
        ),
      ),
    )

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )

    expect(screen.getByTestId('auth-state')).toHaveTextContent('loading|person@example.com')
    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('ready|person@example.com')
    })
    expect(JSON.parse(localStorage.getItem('equisplit_user') ?? 'null')).toEqual(storedUser)
  })
})
