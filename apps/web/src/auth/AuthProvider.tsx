import { useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import {
  getCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
  type LoginInput,
  type RegisterInput,
} from '../api/authApi'
import { AUTH_UNAUTHORIZED_EVENT } from '../api/client'
import type { User } from '../api/types'
import { AuthContext } from './AuthContext'
import { clearAuth, getStoredUser, saveUser } from './authStorage'

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(() => getStoredUser())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const clearSession = () => {
      clearAuth()
      setUser(null)
      setIsLoading(false)
    }

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, clearSession)

    return () => {
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, clearSession)
    }
  }, [])

  useEffect(() => {
    let isActive = true

    void getCurrentUser()
      .then((currentUser) => {
        if (isActive) {
          saveUser(currentUser)
          setUser(currentUser)
        }
      })
      .catch(() => {
        if (isActive) {
          clearAuth()
          setUser(null)
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      async login(input: LoginInput) {
        const auth = await loginUser(input)
        saveUser(auth.user)
        setUser(auth.user)
      },
      async register(input: RegisterInput) {
        const auth = await registerUser(input)
        saveUser(auth.user)
        setUser(auth.user)
      },
      async logout() {
        try {
          await logoutUser()
        } finally {
          clearAuth()
          setUser(null)
        }
      },
    }),
    [isLoading, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
