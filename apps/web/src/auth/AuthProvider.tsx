import { useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import {
  getCurrentUser,
  loginUser,
  registerUser,
  type LoginInput,
  type RegisterInput,
} from '../api/authApi'
import { AUTH_UNAUTHORIZED_EVENT } from '../api/client'
import type { User } from '../api/types'
import { AuthContext } from './AuthContext'
import { clearAuth, getToken, saveAuth } from './authStorage'

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null)
  const [storedToken] = useState(() => getToken())
  const [isLoading, setIsLoading] = useState(storedToken !== null)

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

    if (!storedToken) {
      return
    }

    void getCurrentUser()
      .then((currentUser) => {
        if (isActive) {
          saveAuth(storedToken, currentUser)
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
  }, [storedToken])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      async login(input: LoginInput) {
        const auth = await loginUser(input)
        saveAuth(auth.token, auth.user)
        setUser(auth.user)
      },
      async register(input: RegisterInput) {
        const auth = await registerUser(input)
        saveAuth(auth.token, auth.user)
        setUser(auth.user)
      },
      logout() {
        clearAuth()
        setUser(null)
      },
    }),
    [isLoading, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
