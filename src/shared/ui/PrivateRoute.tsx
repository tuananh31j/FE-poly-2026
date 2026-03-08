import type { ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router-dom'

import { useAppSelector } from '@/app/store/hooks'
import { useMeQuery } from '@/features/auth/hooks/useMeQuery'
import { isBackofficeRole, ROUTE_PATHS } from '@/shared/constants/routes'
import { AppSpinner } from '@/shared/ui/AppSpinner'

interface PrivateRouteProps {
    children?: ReactNode
}

export const PrivateRoute = ({ children }: PrivateRouteProps) => {
    const accessToken = useAppSelector((state) => state.auth.accessToken)
    const userRole = useAppSelector((state) => state.auth.user?.role)
    const authStatus = useAppSelector((state) => state.auth.status)
    const meQuery = useMeQuery()

    if (authStatus === 'idle' || authStatus === 'loading') {
        return <AppSpinner fullScreen />
    }

    if (!accessToken) {
        return <Navigate to={ROUTE_PATHS.LOGIN} replace />
    }

    if (!userRole && meQuery.isLoading) {
        return <AppSpinner fullScreen />
    }

    if (!isBackofficeRole(userRole)) {
        return <Navigate to={ROUTE_PATHS.ROOT} replace />
    }

    if (children) {
        return <>{children}</>
    }


    return <Outlet />
}