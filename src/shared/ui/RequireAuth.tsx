import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAppSelector } from '@/app/store/hooks'
import { useMeQuery } from '@/features/auth/hooks/useMeQuery'
import { ROUTE_PATHS } from '@/shared/constants/routes'

import { AppSpinner } from './AppSpinner'

interface RequireAuthProps {
    children?: ReactNode
}

export const RequireAuth = ({ children }: RequireAuthProps) => {
    const location = useLocation()
    const accessToken = useAppSelector((state) => state.auth.accessToken)
    const user = useAppSelector((state) => state.auth.user)
    const authStatus = useAppSelector((state) => state.auth.status)
    const meQuery = useMeQuery()

    if (authStatus === 'idle' || authStatus === 'loading') {
        return <AppSpinner fullScreen />
    }

    if (!accessToken) {
        const redirect = `${location.pathname}${location.search}${location.hash}`
         return <Navigate to={`${ROUTE_PATHS.LOGIN}?redirect=${encodeURIComponent(redirect)}`} replace />
    }

    if (!user && meQuery.isLoading) {
        return <AppSpinner fullScreen />
    }

    if (children) {
        return <>{children}</>
    }

    return <Outlet />
}