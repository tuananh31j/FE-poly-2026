import { Card, Menu, Typography } from 'antd'
import { useMemo } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'

import { ROUTE_PATHS } from '@/shared/constants/routes'

export const AccountLayout = () => {
  const location = useLocation()

  const selectedKeys = useMemo(() => {
    if (location.pathname.startsWith(ROUTE_PATHS.ACCOUNT_ADDRESSES)) {
      return [ROUTE_PATHS.ACCOUNT_ADDRESSES]
    }

    if (location.pathname.startsWith(ROUTE_PATHS.ACCOUNT_ORDERS)) {
      return [ROUTE_PATHS.ACCOUNT_ORDERS]
    }

    if (location.pathname.startsWith(ROUTE_PATHS.ACCOUNT_CHANGE_PASSWORD)) {
      return [ROUTE_PATHS.ACCOUNT_CHANGE_PASSWORD]
    }

    return [ROUTE_PATHS.ACCOUNT_PROFILE]
  }, [location.pathname])

  return (
    <div className="py-6">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="h-fit lg:sticky lg:top-24">
          <Typography.Title level={5} className="!mb-4">
            Tài khoản của tôi
          </Typography.Title>
          <Menu
            mode="inline"
            selectedKeys={selectedKeys}
            items={[
              {
                key: ROUTE_PATHS.ACCOUNT_PROFILE,
                label: <Link to={ROUTE_PATHS.ACCOUNT_PROFILE}>Thông tin tài khoản</Link>,
              },
              {
                key: ROUTE_PATHS.ACCOUNT_ADDRESSES,
                label: <Link to={ROUTE_PATHS.ACCOUNT_ADDRESSES}>Sổ địa chỉ</Link>,
              },
              {
                key: ROUTE_PATHS.ACCOUNT_ORDERS,
                label: <Link to={ROUTE_PATHS.ACCOUNT_ORDERS}>Đơn hàng của tôi</Link>,
              },
              {
                key: ROUTE_PATHS.ACCOUNT_CHANGE_PASSWORD,
                label: <Link to={ROUTE_PATHS.ACCOUNT_CHANGE_PASSWORD}>Đổi mật khẩu</Link>,
              },
              {
                key: ROUTE_PATHS.DASHBOARD_CENTER,
                label: <Link to={ROUTE_PATHS.DASHBOARD_CENTER}>Quản lý cửa hàng</Link>,
              },
            ]}
          />
        </Card>

        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  )
}