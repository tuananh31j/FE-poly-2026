import {
  BellOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  BgColorsOutlined,
  DashboardOutlined,
  FolderOpenOutlined,
  GiftOutlined,
  MessageOutlined,
  OrderedListOutlined,
  PlusSquareOutlined,
  SettingOutlined,
  ShoppingCartOutlined,
  ShoppingOutlined,
  StarOutlined,
  TagOutlined,
  TagsOutlined,
  TeamOutlined,
  TrademarkOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import { Badge, Button, Empty, Layout, List, Menu, message, Popover, Space, Tag, Typography } from 'antd'
import { useMemo, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { useAppDispatch, useAppSelector } from '@/app/store/hooks'
import { logout } from '@/features/auth/api/auth.api'
import { useMeQuery } from '@/features/auth/hooks/useMeQuery'
import { clearAuth } from '@/features/auth/store/auth.slice'
import { useBackofficeRealtimeNotifications } from '@/features/notifications/hooks/useBackofficeRealtimeNotifications'
import {
  buildDashboardMasterDataPath,
  buildDashboardProductsPath,
  ROUTE_PATHS,
} from '@/shared/constants/routes'
import { clearRefreshTokenCookie, getRefreshTokenCookie } from '@/shared/utils/cookie'

const { Header, Content, Sider } = Layout

const MENU_KEYS = {
  CENTER: 'dashboard-center',
  STATISTICS: 'dashboard-statistics',
  ORDERS: 'dashboard-orders',
  REVIEWS: 'dashboard-reviews',
  COMMENTS: 'dashboard-comments',
  PRODUCTS_LIST: 'dashboard-products-list',
  PRODUCTS_CREATE: 'dashboard-products-create',
  VOUCHERS: 'dashboard-vouchers',
  ATTRIBUTE_CATEGORIES: 'dashboard-attribute-categories',
  ATTRIBUTE_BRANDS: 'dashboard-attribute-brands',
  ATTRIBUTE_COLORS: 'dashboard-attribute-colors',
  ATTRIBUTE_SIZES: 'dashboard-attribute-sizes',
  ACCOUNTS: 'dashboard-accounts',
} as const

const SUBMENU_KEYS = {
  OVERVIEW: 'submenu-overview',
  SALES: 'submenu-sales',
  CATALOG: 'submenu-catalog',
  PRODUCTS: 'submenu-products',
  ATTRIBUTES: 'submenu-attributes',
  SYSTEM: 'submenu-system',
} as const

export const PrivateLayout = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()

  const cachedUser = useAppSelector((state) => state.auth.user)
  const accessToken = useAppSelector((state) => state.auth.accessToken)
  const { data: meData } = useMeQuery()

  const user = meData ?? cachedUser
  const {
    items: notificationItems,
    unreadCount,
    isConnected: isNotificationConnected,
    permission: notificationPermission,
    requestPermission: requestNotificationPermission,
    markAsRead: markNotificationAsRead,
    markAllAsRead: markAllNotificationsAsRead,
  } = useBackofficeRealtimeNotifications({
    accessToken,
    role: user?.role,
  })

  const selectedMenuKey = useMemo(() => {
    const params = new URLSearchParams(location.search)

    if (location.pathname.startsWith(ROUTE_PATHS.DASHBOARD_CENTER)) {
      return MENU_KEYS.CENTER
    }

    if (location.pathname.startsWith(ROUTE_PATHS.DASHBOARD_STATISTICS)) {
      return MENU_KEYS.STATISTICS
    }

    if (location.pathname.startsWith(ROUTE_PATHS.DASHBOARD_COMMENTS)) {
      return MENU_KEYS.COMMENTS
    }

    if (location.pathname.startsWith(ROUTE_PATHS.DASHBOARD_REVIEWS)) {
      return MENU_KEYS.REVIEWS
    }

    if (location.pathname.startsWith(ROUTE_PATHS.DASHBOARD_ORDERS)) {
      return MENU_KEYS.ORDERS
    }

    if (location.pathname.startsWith(ROUTE_PATHS.DASHBOARD_MASTER_DATA)) {
      const activeTab = params.get('tab')

      if (activeTab === 'brands') {
        return MENU_KEYS.ATTRIBUTE_BRANDS
      }

      if (activeTab === 'colors') {
        return MENU_KEYS.ATTRIBUTE_COLORS
      }

      if (activeTab === 'sizes') {
        return MENU_KEYS.ATTRIBUTE_SIZES
      }

      return MENU_KEYS.ATTRIBUTE_CATEGORIES
    }

    if (location.pathname.startsWith(ROUTE_PATHS.DASHBOARD_PRODUCTS_CREATE)) {
      return MENU_KEYS.PRODUCTS_CREATE
    }

    if (location.pathname.startsWith(ROUTE_PATHS.DASHBOARD_PRODUCTS)) {
      return MENU_KEYS.PRODUCTS_LIST
    }

    if (location.pathname.startsWith(ROUTE_PATHS.DASHBOARD_VOUCHERS)) {
      return MENU_KEYS.VOUCHERS
    }

    if (location.pathname.startsWith(ROUTE_PATHS.DASHBOARD_ACCOUNTS)) {
      return MENU_KEYS.ACCOUNTS
    }

    if (location.pathname.startsWith(ROUTE_PATHS.DASHBOARD_USERS)) {
      return MENU_KEYS.ACCOUNTS
    }

    if (location.pathname.startsWith(ROUTE_PATHS.DASHBOARD)) {
      return MENU_KEYS.CENTER
    }

    return MENU_KEYS.CENTER
  }, [location.pathname, location.search])

  const selectedKeys = useMemo(() => [selectedMenuKey], [selectedMenuKey])
  const [manualOpenKeys, setManualOpenKeys] = useState<string[]>([])
  const openKeys = useMemo(() => {
    const next = new Set(manualOpenKeys)

    const shouldOpenOverview =
      selectedMenuKey === MENU_KEYS.CENTER || selectedMenuKey === MENU_KEYS.STATISTICS
    const shouldOpenSales =
      selectedMenuKey === MENU_KEYS.ORDERS ||
      selectedMenuKey === MENU_KEYS.REVIEWS ||
      selectedMenuKey === MENU_KEYS.COMMENTS ||
      selectedMenuKey === MENU_KEYS.VOUCHERS
    const shouldOpenCatalog =
      selectedMenuKey === MENU_KEYS.PRODUCTS_LIST ||
      selectedMenuKey === MENU_KEYS.PRODUCTS_CREATE ||
      selectedMenuKey === MENU_KEYS.ATTRIBUTE_CATEGORIES ||
      selectedMenuKey === MENU_KEYS.ATTRIBUTE_BRANDS ||
      selectedMenuKey === MENU_KEYS.ATTRIBUTE_COLORS ||
      selectedMenuKey === MENU_KEYS.ATTRIBUTE_SIZES
    const shouldOpenProducts =
      selectedMenuKey === MENU_KEYS.PRODUCTS_LIST || selectedMenuKey === MENU_KEYS.PRODUCTS_CREATE
    const shouldOpenAttributes =
      selectedMenuKey === MENU_KEYS.ATTRIBUTE_CATEGORIES ||
      selectedMenuKey === MENU_KEYS.ATTRIBUTE_BRANDS ||
      selectedMenuKey === MENU_KEYS.ATTRIBUTE_COLORS ||
      selectedMenuKey === MENU_KEYS.ATTRIBUTE_SIZES
    const shouldOpenSystem = selectedMenuKey === MENU_KEYS.ACCOUNTS

    if (shouldOpenOverview) {
      next.add(SUBMENU_KEYS.OVERVIEW)
    }

    if (shouldOpenSales) {
      next.add(SUBMENU_KEYS.SALES)
    }

    if (shouldOpenCatalog) {
      next.add(SUBMENU_KEYS.CATALOG)
    }

    if (shouldOpenProducts) {
      next.add(SUBMENU_KEYS.PRODUCTS)
    }

    if (shouldOpenAttributes) {
      next.add(SUBMENU_KEYS.ATTRIBUTES)
    }

    if (shouldOpenSystem) {
      next.add(SUBMENU_KEYS.SYSTEM)
    }

    return Array.from(next)
  }, [manualOpenKeys, selectedMenuKey])

  const handleLogout = async () => {
    try {
      await logout(getRefreshTokenCookie())
    } catch {
      // Ignore logout API failures and clear local session anyway.
    }

    clearRefreshTokenCookie()
    dispatch(clearAuth())
    queryClient.clear()
    void message.success('Đăng xuất thành công')
    navigate(ROUTE_PATHS.LOGIN, { replace: true })
  }

  const notificationListContent = (
    <div className="w-[360px]">
      <div className="mb-3 flex items-center justify-between">
        <Typography.Text strong>Thông báo realtime</Typography.Text>
        <Space size={8}>
          <Tag color={isNotificationConnected ? 'green' : 'orange'}>
            {isNotificationConnected ? 'Socket: Online' : 'Socket: Reconnecting'}
          </Tag>
          <Button
            size="small"
            type="link"
            className="!px-0"
            onClick={() => markAllNotificationsAsRead()}
          >
            Đánh dấu đã đọc
          </Button>
        </Space>
      </div>

      {notificationPermission === 'default' && (
        <Button
          size="small"
          className="mb-3"
          onClick={() => {
            void requestNotificationPermission()
          }}
        >
          Bật thông báo trình duyệt
        </Button>
      )}

      {notificationPermission === 'denied' && (
        <Typography.Text type="secondary" className="mb-3 block text-xs">
          Bạn đã chặn quyền Notification. Hãy bật lại trong cài đặt trình duyệt để nhận thông báo
          service worker khi tab đang ẩn/offline.
        </Typography.Text>
      )}

      <List
        size="small"
        locale={{
          emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có thông báo" />,
        }}
        dataSource={notificationItems.slice(0, 15)}
        renderItem={(item) => (
          <List.Item
            className="cursor-pointer"
            onClick={() => {
              markNotificationAsRead(item.id)
              navigate(item.url)
            }}
          >
            <List.Item.Meta
              title={
                <Space size={8}>
                  <Typography.Text strong={!item.isRead}>{item.title}</Typography.Text>
                  {!item.isRead && <Tag color="blue">Mới</Tag>}
                </Space>
              }
              description={
                <Space direction="vertical" size={2} className="w-full">
                  <Typography.Text type="secondary" className="text-xs">
                    {item.body}
                  </Typography.Text>
                  <Typography.Text type="secondary" className="text-[11px]">
                    {new Date(item.createdAt).toLocaleString('vi-VN', { hour12: false })}
                  </Typography.Text>
                </Space>
              }
            />
          </List.Item>
        )}
      />
    </div>
  )

  return (
    <Layout className="min-h-screen">
      <Sider breakpoint="lg" collapsedWidth="0" theme="light" width={240}>
        <div className="border-b border-slate-200 px-5 py-4">
          <Link to="/">
            <Typography.Title level={4} className="!mb-0 !text-blue-700">
              Golden Billiards
            </Typography.Title>
          </Link>
        </div>

        <Menu
          mode="inline"
          selectedKeys={selectedKeys}
          openKeys={openKeys}
          onOpenChange={setManualOpenKeys}
          items={[
            {
              key: MENU_KEYS.CENTER,
              icon: <DashboardOutlined />,
              label: <Link to={ROUTE_PATHS.DASHBOARD_CENTER}>Trung tâm</Link>,
            },

            {
              key: SUBMENU_KEYS.SALES,
              icon: <ShoppingCartOutlined />,
              label: 'Bán hàng',
              children: [
                {
                  key: MENU_KEYS.ORDERS,
                  icon: <OrderedListOutlined />,
                  label: <Link to={ROUTE_PATHS.DASHBOARD_ORDERS}>Đơn hàng</Link>,
                },
                {
                  key: MENU_KEYS.REVIEWS,
                  icon: <StarOutlined />,
                  label: <Link to={ROUTE_PATHS.DASHBOARD_REVIEWS}>Đánh giá</Link>,
                },
                {
                  key: MENU_KEYS.COMMENTS,
                  icon: <MessageOutlined />,
                  label: <Link to={ROUTE_PATHS.DASHBOARD_COMMENTS}>Bình luận</Link>,
                },
                ...(user?.role === 'admin'
                  ? [
                      {
                        key: MENU_KEYS.VOUCHERS,
                        icon: <GiftOutlined />,
                        label: <Link to={ROUTE_PATHS.DASHBOARD_VOUCHERS}>Voucher</Link>,
                      },
                    ]
                  : []),
              ],
            },
            ...(user?.role === 'admin'
              ? [
                  {
                    key: SUBMENU_KEYS.CATALOG,
                    icon: <AppstoreOutlined />,
                    label: 'Catalog',
                    children: [
                      {
                        key: SUBMENU_KEYS.PRODUCTS,
                        icon: <ShoppingOutlined />,
                        label: 'Sản phẩm',
                        children: [
                          {
                            key: MENU_KEYS.PRODUCTS_LIST,
                            icon: <UnorderedListOutlined />,
                            label: (
                              <Link to={buildDashboardProductsPath('list')}>
                                Danh sách sản phẩm
                              </Link>
                            ),
                          },
                          {
                            key: MENU_KEYS.PRODUCTS_CREATE,
                            icon: <PlusSquareOutlined />,
                            label: <Link to={buildDashboardProductsPath('create')}>Thêm mới</Link>,
                          },
                        ],
                      },
                      {
                        key: SUBMENU_KEYS.ATTRIBUTES,
                        icon: <TagsOutlined />,
                        label: 'Thuộc tính',
                        children: [
                          {
                            key: MENU_KEYS.ATTRIBUTE_CATEGORIES,
                            icon: <FolderOpenOutlined />,
                            label: (
                              <Link to={buildDashboardMasterDataPath('categories')}>Danh mục</Link>
                            ),
                          },
                          {
                            key: MENU_KEYS.ATTRIBUTE_BRANDS,
                            icon: <TrademarkOutlined />,
                            label: (
                              <Link to={buildDashboardMasterDataPath('brands')}>Thương hiệu</Link>
                            ),
                          },
                          {
                            key: MENU_KEYS.ATTRIBUTE_COLORS,
                            icon: <BgColorsOutlined />,
                            label: <Link to={buildDashboardMasterDataPath('colors')}>Màu sắc</Link>,
                          },
                          {
                            key: MENU_KEYS.ATTRIBUTE_SIZES,
                            icon: <TagOutlined />,
                            label: (
                              <Link to={buildDashboardMasterDataPath('sizes')}>Kích thước</Link>
                            ),
                          },
                        ],
                      },
                    ],
                  },
                  {
                    key: SUBMENU_KEYS.SYSTEM,
                    icon: <SettingOutlined />,
                    label: 'Hệ thống',
                    children: [
                      {
                        key: MENU_KEYS.ACCOUNTS,
                        icon: <TeamOutlined />,
                        label: <Link to={ROUTE_PATHS.DASHBOARD_ACCOUNTS}>Tài khoản</Link>,
                      },
                      {
                        key: MENU_KEYS.STATISTICS,
                        icon: <BarChartOutlined />,
                        label: <Link to={ROUTE_PATHS.DASHBOARD_STATISTICS}>Thống kê</Link>,
                      },
                    ],
                  },
                ]
              : []),
          ]}
          className="border-r-0"
        />
      </Sider>

      <Layout>
        <Header className="flex items-center justify-between border-b border-slate-200 bg-white px-6">
          <Typography.Text strong>
            Xin chào, {user?.fullName || user?.email || 'Authenticated user'}
          </Typography.Text>
          <Space size={12}>
            {(user?.role === 'staff' || user?.role === 'admin') && (
              <Popover
                placement="bottomRight"
                trigger="click"
                content={notificationListContent}
                overlayClassName="max-w-[90vw]"
              >
                <Badge count={unreadCount} size="small" overflowCount={99}>
                  <Button icon={<BellOutlined />} />
                </Badge>
              </Popover>
            )}
            <Button type="default" onClick={handleLogout}>
              Đăng xuất
            </Button>
          </Space>
        </Header>

        <Content className="p-6">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
