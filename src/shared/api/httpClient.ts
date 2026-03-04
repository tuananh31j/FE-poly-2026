import axios, { type InternalAxiosRequestConfig } from 'axios'

import { store } from '@/app/store'
import type { AuthTokens } from '@/features/auth/model/auth.types'
import { clearAuth, setAccessToken } from '@/features/auth/store/auth.slice'
import { toApiClientError } from '@/shared/api/response'
import { env } from '@/shared/constants/env'
import { ROUTE_PATHS } from '@/shared/constants/routes'
import type { ApiSuccess } from '@/shared/types/api.types'
import {
  clearRefreshTokenCookie,
  getRefreshTokenCookie,
  setRefreshTokenCookie,
} from '@/shared/utils/cookie'

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

const httpClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
  },
})

let refreshPromise: Promise<string | null> | null = null

const redirectToLogin = () => {
  if (typeof window === 'undefined') {
    return
  }

  if (window.location.pathname !== ROUTE_PATHS.LOGIN) {
    window.location.assign(ROUTE_PATHS.LOGIN)
  }
}

// worklog: 2026-03-04 18:01:37 | trantu | cleanup | clearAuthSession
// worklog: 2026-03-04 22:03:47 | trantu | fix | clearAuthSession
const clearAuthSession = () => {
  store.dispatch(clearAuth())
  clearRefreshTokenCookie()
  redirectToLogin()
}

// worklog: 2026-03-04 17:28:09 | trantu | fix | refreshAccessToken
const refreshAccessToken = async () => {
  const refreshToken = getRefreshTokenCookie()

  if (!refreshToken) {
    return null
  }

  try {
    const response = await axios.post<ApiSuccess<AuthTokens>>(`${env.apiBaseUrl}/auth/refresh`, {
      refreshToken,
    })

    const tokenData = response.data.data
    store.dispatch(setAccessToken(tokenData.accessToken))
    setRefreshTokenCookie(tokenData.refreshToken)

    return tokenData.accessToken
  } catch {
    return null
  }
}

httpClient.interceptors.request.use((config) => {
  const accessToken = store.getState().auth.accessToken

  if (accessToken) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${accessToken}`
  }

  return config
})

httpClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as RetriableRequestConfig | undefined
    const statusCode = error.response?.status

    if (!originalRequest || statusCode !== 401 || originalRequest._retry) {
      throw toApiClientError(error)
    }

    if (originalRequest.url?.includes('/auth/refresh')) {
      clearAuthSession()
      throw toApiClientError(error)
    }

    originalRequest._retry = true

    refreshPromise ??= refreshAccessToken().finally(() => {
      refreshPromise = null
    })

    const renewedAccessToken = await refreshPromise

    if (!renewedAccessToken) {
      clearAuthSession()
      throw toApiClientError(error)
    }

    originalRequest.headers = originalRequest.headers ?? {}
    originalRequest.headers.Authorization = `Bearer ${renewedAccessToken}`

    return httpClient(originalRequest)
  }
)

export { httpClient }
