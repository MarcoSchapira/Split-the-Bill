import { apiClient } from './client'
import type { AuthResponse, User } from './types'

export type LoginInput = {
  email: string;
  password: string;
}

export type RegisterInput = LoginInput & {
  name?: string;
  code: string;
}

export async function sendRegistrationCode(email: string): Promise<void> {
  await apiClient.post('/auth/register/send-code', { email })
}

export async function loginUser(input: LoginInput): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/auth/login', input)
  return response.data
}

export async function registerUser(input: RegisterInput): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/auth/register', input)
  return response.data
}

export async function getCurrentUser(): Promise<User> {
  const response = await apiClient.get<{ user: User }>('/auth/me')
  return response.data.user
}

export async function logoutUser(): Promise<void> {
  await apiClient.post('/auth/logout')
}

export async function sendDeleteAccountCode(email: string): Promise<void> {
  await apiClient.post('/auth/account/send-delete-code', { email })
}

export async function verifyDeleteAccountCode(
  email: string,
  code: string,
): Promise<string> {
  const response = await apiClient.post<{ deletionToken: string }>(
    '/auth/account/verify-delete-code',
    { email, code },
  )
  return response.data.deletionToken
}

export async function confirmDeleteAccount(deletionToken: string): Promise<void> {
  await apiClient.post('/auth/account/confirm-delete', { deletionToken })
}

export async function refreshSession(): Promise<void> {
  await apiClient.post('/auth/refresh')
}
