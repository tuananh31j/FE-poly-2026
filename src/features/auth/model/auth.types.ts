export interface AuthUser {
  id: string
  email: string
  username?: string
  isActive: boolean
  fullName?: string
  phone?: string
  role: 'customer' | 'staff' | 'admin'
  avatarUrl?: string
  loyaltyPoints?: number
  membershipTier?: string
  staffDepartment?: string
  staffStartDate?: string
  createdAt: string
  updatedAt: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface AuthResponse {
  user: AuthUser
  tokens: AuthTokens
}

export interface LoginPayload {
  email: string
  password: string
}

export interface ForgotPasswordPayload {
  email: string
}

export interface ResetPasswordPayload {
  token: string
  newPassword: string
}

export interface RegisterPayload {
  email: string
  password: string
  username?: string
  fullName?: string
  phone?: string
}

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated'

export interface AuthState {
  accessToken: string | null
  user: AuthUser | null
  status: AuthStatus
}
