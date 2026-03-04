import { Card } from 'antd'
import { Navigate, Outlet } from 'react-router-dom'

import { useAppSelector } from '@/app/store/hooks'
import { getDefaultRouteByRole } from '@/shared/constants/routes'
import { AppSpinner } from '@/shared/ui/AppSpinner'

export const AuthLayout = () => {
  const accessToken = useAppSelector((state) => state.auth.accessToken)
  const authStatus = useAppSelector((state) => state.auth.status)
  const role = useAppSelector((state) => state.auth.user?.role)

  if (authStatus === 'idle' || authStatus === 'loading') {
    return <AppSpinner fullScreen />
  }

  if (accessToken) {
    return <Navigate to={getDefaultRouteByRole(role)} replace />
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md shadow-lg">
        <Outlet />
      </Card>
    </main>
  )
}
