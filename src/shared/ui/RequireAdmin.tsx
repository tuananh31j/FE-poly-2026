import { Button, Result } from 'antd'
import type { ReactNode } from 'react'
import { Navigate, Outlet, useNavigate } from 'react-router-dom'

import { useAppSelector } from '@/app/store/hooks'
import { useMeQuery } from '@/features/auth/hooks/useMeQuery'
import { ROUTE_PATHS } from '@/shared/constants/routes'

import { AppSpinner } from './AppSpinner'

interface RequireAdminProps {
    children?: ReactNode
}

export const RequireAdmin = ({ children }: RequireAdminProps) => {
    const navigate = useNavigate()
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

    if (userRole !== 'admin') {
        return (
            <Result
                status="403"
                title="Không có quyền truy cập"
                subTitle="Chỉ tài khoản admin mới được phép vào khu vực quản lý phân quyền."
                extra={
                <Button
                    type="primary"
                    onClick={() => {
                    navigate(ROUTE_PATHS.DASHBOARD, { replace: true })
                    }}
                >
                    Quay lại dashboard
                </Button>
                }
            />
        )
    }

    if (children) {
        return <>{children}</>
    }


    return <Outlet />

}