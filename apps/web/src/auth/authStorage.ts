import type { User } from '../api/types'

const USER_KEY = 'equisplit_user'

export function saveUser(user: User): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function getStoredUser(): User | null {
  const storedUser = localStorage.getItem(USER_KEY)

  if (!storedUser) {
    return null
  }

  try {
    return JSON.parse(storedUser) as User
  } catch {
    clearAuth()
    return null
  }
}

export function clearAuth(): void {
  localStorage.removeItem(USER_KEY)
}

export function getCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)equisplit_csrf=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}
