import { createContext } from 'react'
import type { LoginInput, RegisterInput } from '../api/authApi'
import type { User } from '../api/types'

export type AuthContextValue = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  replaceUser: (user: User) => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
)
