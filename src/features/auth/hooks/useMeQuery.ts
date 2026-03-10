import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/store/hooks'
import { me } from '@/features/auth/api/auth.api'
import { clearAuth, setUser } from '@/features/auth/store/auth.slice'
import { queryKeys } from '@/shared/api/queryKeys'
import { ApiClientError } from '@/shared/types/api.types'
import { clearRefreshTokenCookie } from '@/shared/utils/cookie'


// worklog: 2026-03-04 19:43:30 | ducanh | refactor | useMeQuery
// worklog: 2026-03-04 18:01:37 | trantu | cleanup | useMeQuery
export const useMeQuery = () => {
  const dispatch = useAppDispatch()
  const accessToken = useAppSelector((state) => state.auth.accessToken)

  const query = useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: me,
    enabled: Boolean(accessToken),
  })

  useEffect(() => {
    if (query.data) {
      dispatch(setUser(query.data))
    }
  }, [dispatch, query.data])

  useEffect(() => {
    if (!query.isError) {
      return
    }

     const error = query.error


      if (error instanceof ApiClientError && error.statusCode === 401) {
      clearRefreshTokenCookie()
      dispatch(clearAuth())
    }
  }, [dispatch, query.error, query.isError])

  return query
}