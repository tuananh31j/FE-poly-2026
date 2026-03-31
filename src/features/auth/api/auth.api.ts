import axios from 'axios'

import type {
  AuthResponse,
  AuthTokens,
  AuthUser,
  ForgotPasswordPayload,
  LoginPayload,
  RegisterPayload,
  ResetPasswordPayload,
} from '@/features/auth/model/auth.types'
import { httpClient } from '@/shared/api/httpClient'
import { extractApiData, toApiClientError } from '@/shared/api/response'
import { env } from '@/shared/constants/env'
import type { ApiSuccess } from '@/shared/types/api.types'

export const login = async (payload: LoginPayload) => {
  try {
    const response = await httpClient.post<ApiSuccess<AuthResponse>>('/auth/login', payload)
    return extractApiData(response)
  } catch (error) {
    throw toApiClientError(error)
  }
}

export const register = async (payload: RegisterPayload) => {
  try {
    const response = await httpClient.post<ApiSuccess<AuthResponse>>('/auth/register', payload)
    return extractApiData(response)
  } catch (error) {
    throw toApiClientError(error)
  }
}

export const refresh = async (refreshToken: string) => {
  try {
    const response = await axios.post<ApiSuccess<AuthTokens>>(`${env.apiBaseUrl}/auth/refresh`, {
      refreshToken,
    })

    return extractApiData(response)
  } catch (error) {
    throw toApiClientError(error)
  }
}

export const logout = async (refreshToken?: string | null) => {
  try {
    await httpClient.post<ApiSuccess<null>>('/auth/logout', {
      refreshToken: refreshToken ?? undefined,
    })
  } catch (error) {
    throw toApiClientError(error)
  }
}

// worklog: 2026-03-04 21:44:32 | trantu | cleanup | me
export const me = async () => {
  try {
    const response = await httpClient.get<ApiSuccess<AuthUser>>('/auth/me')
    return extractApiData(response)
  } catch (error) {
    throw toApiClientError(error)
  }
}

export const forgotPassword = async (payload: ForgotPasswordPayload) => {
  try {
    const response = await httpClient.post<ApiSuccess<null>>('/auth/forgot-password', payload)
    return response.data.message
  } catch (error) {
    throw toApiClientError(error)
  }
}

export const resetPassword = async (payload: ResetPasswordPayload) => {
  try {
    const response = await httpClient.post<ApiSuccess<null>>('/auth/reset-password', payload)
    return response.data.message
  } catch (error) {
    throw toApiClientError(error)
  }
}
