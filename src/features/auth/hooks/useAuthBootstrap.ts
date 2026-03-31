import { useEffect, useRef } from 'react'

import { useAppDispatch } from '@/app/store/hooks'
import { refresh } from '@/features/auth/api/auth.api'
import { clearAuth, setAccessToken, setAuthStatus } from '@/features/auth/store/auth.slice'
import {
  clearRefreshTokenCookie,
  getRefreshTokenCookie,
  setRefreshTokenCookie,
} from '@/shared/utils/cookie'

export const useAuthBootstrap = () => {
  const dispatch = useAppDispatch()
  const hasBootstrapped = useRef(false)

  useEffect(() => {
    if (hasBootstrapped.current) {
      return
    }

    hasBootstrapped.current = true

    const bootstrapAuth = async () => {
      const refreshToken = getRefreshTokenCookie()

      if (!refreshToken) {
        dispatch(clearAuth())
        return
      }

      dispatch(setAuthStatus('loading'))

      try {
        const tokens = await refresh(refreshToken)

        dispatch(setAccessToken(tokens.accessToken))
        setRefreshTokenCookie(tokens.refreshToken)
        dispatch(setAuthStatus('authenticated'))
      } catch {
        clearRefreshTokenCookie()
        dispatch(clearAuth())
      }
    }

    void bootstrapAuth()
  }, [dispatch])
}
