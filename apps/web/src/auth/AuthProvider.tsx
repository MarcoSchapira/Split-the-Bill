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
import { queryClient } from '../api/queryClient'
import { AuthContext } from './AuthContext'
import { clearAuth, getStoredUser, saveUser } from './authStorage'

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(() => getStoredUser())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const clearSession = () => {
      clearAuth()
      queryClient.clear()
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
        // A verified 401 is handled by AUTH_UNAUTHORIZED_EVENT after the
        // single refresh attempt fails. Keep the last authenticated user for
        // transient network and server errors so the app does not flash out.
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
        } catch {
          // Local logout must still complete if the session was already
          // revoked (for example by "log out all") or the network is down.
        } finally {
          clearAuth()
          setUser(null)
          queryClient.clear()
        }
      },
      replaceUser(nextUser: User) {
        saveUser(nextUser)
        setUser(nextUser)
      },
    }),
    [isLoading, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
