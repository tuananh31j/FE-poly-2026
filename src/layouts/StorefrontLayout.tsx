import { SearchOutlined, ShoppingCartOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { MenuProps } from 'antd'
import {
  Avatar,
  Badge,
  Button,
  Dropdown,
  Input,
  Layout,
  Menu,
  message,
  Space,
  Typography,
} from 'antd'
import { sumBy } from 'lodash'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { useAppDispatch, useAppSelector } from '@/app/store/hooks'
import { logout } from '@/features/auth/api/auth.api'
import { clearAuth } from '@/features/auth/store/auth.slice'
import { getMyCart } from '@/features/cart/api/cart.api'
import { CartDrawer } from '@/features/cart/components/CartDrawer'
import { getProductFilters } from '@/features/product/api/product.api'
import { CustomerSupportChatWidget } from '@/features/chat/components/CustomerSupportChatWidget'
import { ProductSearchModal } from '@/features/product/components/ProductSearchModal'
import { queryKeys } from '@/shared/api/queryKeys'
import { BRAND } from '@/shared/constants/brand'
import { isBackofficeRole, ROUTE_PATHS } from '@/shared/constants/routes'
import { clearRefreshTokenCookie, getRefreshTokenCookie } from '@/shared/utils/cookie'

const { Header, Content, Footer } = Layout

export const StorefrontLayout = () => {
  const dispatch = useAppDispatch()
  const queryClient = useQueryClient()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false)

  const accessToken = useAppSelector((state) => state.auth.accessToken)
  const user = useAppSelector((state) => state.auth.user)
  const productFiltersQuery = useQuery({
    queryKey: queryKeys.products.filters,
    queryFn: getProductFilters,
  })
  const cartQuery = useQuery({
    queryKey: queryKeys.cart.me,
    queryFn: getMyCart,
    enabled: Boolean(accessToken),
  })

  useEffect(() => {
    const state = location.state as { authSuccess?: 'login' | 'register' } | null
    if (!state?.authSuccess) {
      return
    }

    const content = state.authSuccess === 'register' ? 'Đăng ký thành công' : 'Đăng nhập thành công'
    void message.success(content)
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null })
  }, [location.pathname, location.search, location.state, navigate])

  const selectedCategoryId = searchParams.get('categoryId')?.trim() ?? ''
  const selectedBrand = searchParams.get('brand')?.trim() ?? ''
  const cartItemCount = useMemo(() => {
    return sumBy(cartQuery.data?.items ?? [], (item) => item.quantity)
  }, [cartQuery.data?.items])

  const selectedMenuKey = useMemo(() => {
    if (location.pathname === ROUTE_PATHS.ABOUT) {
      return 'about'
    }

    if (location.pathname === ROUTE_PATHS.PRODUCTS) {
      return 'products'
    }

    return location.pathname === ROUTE_PATHS.ROOT ? 'home' : ''
  }, [location.pathname])

  const buildProductsPath = useCallback(
    (next: { search?: string; categoryId?: string; brand?: string }) => {
      const params = new URLSearchParams()

      const search = next.search ?? searchParams.get('search') ?? ''
      const categoryId = next.categoryId ?? selectedCategoryId
      const brand = next.brand ?? selectedBrand

      if (search.trim()) {
        params.set('search', search.trim())
      }

      if (categoryId.trim()) {
        params.set('categoryId', categoryId.trim())
      }

      if (brand.trim()) {
        params.set('brand', brand.trim())
      }

      params.delete('page')
      const query = params.toString()
      return query ? `${ROUTE_PATHS.PRODUCTS}?${query}` : ROUTE_PATHS.PRODUCTS
    },
    [searchParams, selectedCategoryId, selectedBrand]
  )

  const handleLogout = async () => {
    try {
      await logout(getRefreshTokenCookie())
    } catch {
      // Ignore API errors and still clear local session.
    }

    clearRefreshTokenCookie()
    dispatch(clearAuth())
    queryClient.clear()
    void message.success('Đăng xuất thành công')
  }

  const normalizedCategories = useMemo(() => {
    const categories = productFiltersQuery.data?.categories ?? []
    const uniqueByName = new Map<string, { id: string; name: string }>()

    for (const category of categories) {
      const name = category.name.trim()

      if (!name) {
        continue
      }

      const normalizedName = name.toLocaleLowerCase('vi')

      if (!uniqueByName.has(normalizedName)) {
        uniqueByName.set(normalizedName, {
          id: category.id,
          name,
        })
      }
    }

    return Array.from(uniqueByName.values()).sort((a, b) =>
      a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' })
    )
  }, [productFiltersQuery.data?.categories])

  const categoryMenuItems = useMemo<MenuProps['items']>(() => {
    const categoryGroups = new Map<string, Array<{ id: string; name: string }>>()

    for (const category of normalizedCategories) {
      const firstCharacter = category.name.charAt(0).toUpperCase()
      const groupKey = /[A-ZÀ-Ỹ]/.test(firstCharacter) ? firstCharacter : '#'
      const existingGroup = categoryGroups.get(groupKey) ?? []
      existingGroup.push(category)
      categoryGroups.set(groupKey, existingGroup)
    }

    const groupedItems = Array.from(categoryGroups.entries())
      .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey, 'vi'))
      .map(([groupKey, categories]) => ({
        type: 'group' as const,
        key: `category-group:${groupKey}`,
        label: groupKey === '#' ? 'Khác' : groupKey,
        children: categories.map((category) => ({
          key: `category:${category.id}`,
          label: category.name,
        })),
      }))

    return [
      {
        key: 'category:all',
        label: 'Tất cả danh mục',
      },
      {
        type: 'divider' as const,
        key: 'category-divider',
      },
      ...groupedItems,
    ]
  }, [normalizedCategories])

  const brandMenuItems = useMemo<MenuProps['items']>(() => {
    const brands = productFiltersQuery.data?.brands ?? []

    return [
      {
        key: 'brand:all',
        label: 'Tất cả thương hiệu',
      },
      ...brands.map((brand) => ({
        key: `brand:${encodeURIComponent(brand)}`,
        label: brand,
      })),
    ]
  }, [productFiltersQuery.data?.brands])

  const accountMenuItems = useMemo<MenuProps['items']>(() => {
    return [
      {
        key: 'account:profile',
        label: 'Tài khoản',
      },
      ...(isBackofficeRole(user?.role)
        ? [
            {
              key: 'account:dashboard',
              label: 'Dashboard',
            },
          ]
        : []),
      {
        type: 'divider',
      },
      {
        key: 'account:logout',
        label: 'Đăng xuất',
        danger: true,
      },
    ]
  }, [user?.role])

  const handleNavigationMenuClick: MenuProps['onClick'] = ({ key }) => {
    const itemKey = String(key)

    if (itemKey === 'home') {
      navigate(ROUTE_PATHS.ROOT)
      return
    }

    if (itemKey === 'about') {
      navigate(ROUTE_PATHS.ABOUT)
      return
    }

    if (itemKey === 'products') {
      navigate(ROUTE_PATHS.PRODUCTS)
      return
    }

    if (itemKey === 'category:all') {
      navigate(buildProductsPath({ categoryId: '' }))
      return
    }

    if (itemKey.startsWith('category:')) {
      const categoryId = itemKey.replace('category:', '')
      navigate(buildProductsPath({ categoryId }))
      return
    }

    if (itemKey === 'brand:all') {
      navigate(buildProductsPath({ brand: '' }))
      return
    }

    if (itemKey.startsWith('brand:')) {
      const brand = decodeURIComponent(itemKey.replace('brand:', ''))
      navigate(buildProductsPath({ brand }))
    }
  }

  const openSearchModal = () => {
    setSearchModalOpen(true)
  }

  const handleAccountMenuClick: MenuProps['onClick'] = ({ key }) => {
    const itemKey = String(key)

    if (itemKey === 'account:profile') {
      navigate(ROUTE_PATHS.ACCOUNT_PROFILE)
      return
    }

    if (itemKey === 'account:dashboard') {
      navigate(ROUTE_PATHS.DASHBOARD)
      return
    }

    if (itemKey === 'account:logout') {
      void handleLogout()
    }
  }

  return (
    <Layout className="min-h-screen bg-transparent">
      <Header className="!h-auto sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 !leading-normal backdrop-blur md:px-8">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-4">
          <Link to={ROUTE_PATHS.ROOT} className="flex shrink-0 items-center gap-3">
            <img src={BRAND.logoMark} alt={`${BRAND.name} logo`} className="h-10 w-10 rounded-xl" />
            <div className="hidden md:block">
              <Typography.Title level={5} className="!mb-0 !text-slate-900">
                {BRAND.name}
              </Typography.Title>
              <Typography.Text type="secondary" className="hidden text-xs 2xl:block">
                {BRAND.tagline}
              </Typography.Text>
            </div>
          </Link>

          <Menu
            mode="horizontal"
            disabledOverflow
            triggerSubMenuAction="hover"
            selectedKeys={selectedMenuKey ? [selectedMenuKey] : []}
            onClick={handleNavigationMenuClick}
            items={[
              {
                key: 'home',
                label: 'Trang chủ',
              },
              {
                key: 'about',
                label: 'Giới thiệu',
              },
              {
                key: 'products',
                label: 'Sản phẩm',
              },
              {
                key: 'categories',
                label: 'Danh mục',
                popupClassName: 'storefront-categories-submenu',
                popupOffset: [0, 8],
                children: categoryMenuItems,
              },
              {
                key: 'brands',
                label: 'Thương hiệu',
                popupClassName: 'storefront-brands-submenu',
                popupOffset: [0, 8],
                children: brandMenuItems,
              },
            ]}
            className="hidden min-w-max flex-none border-b-0 bg-transparent lg:flex"
          />

          <div className="hidden min-w-[180px] flex-1 lg:block xl:max-w-[320px]">
            <Input
              readOnly
              placeholder="Tìm kiếm sản phẩm Golden Billiards..."
              value={searchParams.get('search') ?? ''}
              prefix={<SearchOutlined />}
              className="cursor-pointer"
              onClick={openSearchModal}
              onPressEnter={openSearchModal}
            />
          </div>

          <Space size="small">
            <Button
              className="lg:!hidden"
              type="default"
              icon={<SearchOutlined />}
              aria-label="Mở tìm kiếm sản phẩm"
              onClick={openSearchModal}
            />

            {accessToken ? (
              <>
                <Dropdown
                  trigger={['click']}
                  placement="bottomRight"
                  menu={{
                    items: accountMenuItems,
                    onClick: handleAccountMenuClick,
                  }}
                >
                  <Button
                    icon={
                      <Avatar size={24} src={user?.avatarUrl}>
                        {(user?.fullName ?? user?.email ?? 'U').charAt(0).toUpperCase()}
                      </Avatar>
                    }
                  >
                    <span className="hidden max-w-[120px] truncate md:inline-block">
                      {user?.fullName || 'Tài khoản'}
                    </span>
                  </Button>
                </Dropdown>
              </>
            ) : (
              <>
                <Button onClick={() => navigate(ROUTE_PATHS.LOGIN)}>Đăng nhập</Button>
                <Button type="primary" onClick={() => navigate(ROUTE_PATHS.REGISTER)}>
                  Đăng ký
                </Button>
              </>
            )}
            <Badge count={cartItemCount} size="small" overflowCount={99}>
              <Button
                type="default"
                icon={<ShoppingCartOutlined />}
                onClick={() => {
                  setCartDrawerOpen(true)
                }}
              />
            </Badge>
          </Space>
        </div>
      </Header>

      <Content className="mx-auto w-full max-w-7xl flex-1 px-4 md:px-6">
        <Outlet />
      </Content>

      <ProductSearchModal
        open={searchModalOpen}
        onClose={() => {
          setSearchModalOpen(false)
        }}
      />
      <CartDrawer
        open={cartDrawerOpen}
        onClose={() => {
          setCartDrawerOpen(false)
        }}
      />

      {!isBackofficeRole(user?.role) && (
        <>
        <CustomerSupportChatWidget isAuthenticated={Boolean(accessToken)} />
        </>
      )}
      
      <Footer className="mt-10 border-t border-slate-200 bg-white px-4 py-10 md:px-8">
        <div className="mx-auto grid w-full max-w-7xl gap-8 md:grid-cols-3">
          <div>
            <img src={BRAND.logoFull} alt={`${BRAND.name} logo full`} className="h-12 w-auto" />
            <Typography.Paragraph className="!mb-0" type="secondary">
              {BRAND.description}
            </Typography.Paragraph>
          </div>

          <div>
            <Typography.Title level={5}>Thông tin liên hệ</Typography.Title>
            <Typography.Paragraph className="!mb-1" type="secondary">
              Hotline: 0900 000 000
            </Typography.Paragraph>
            <Typography.Paragraph className="!mb-1" type="secondary">
              Email: support@billarshop.vn
            </Typography.Paragraph>
            <Typography.Paragraph className="!mb-0" type="secondary">
              Địa chỉ: 13 Trịnh Văn Bô, Nam Từ Liêm, Hà Nội
            </Typography.Paragraph>
          </div>

          <div>
            <Typography.Title level={5}>Điều hướng nhanh</Typography.Title>
            <Space direction="vertical" size={4}>
              <Link to={ROUTE_PATHS.ROOT}>Trang chủ</Link>
              <Link to={ROUTE_PATHS.PRODUCTS}>Sản phẩm</Link>
              <Link to={ROUTE_PATHS.ABOUT}>Giới thiệu</Link>
              <Link to={ROUTE_PATHS.ACCOUNT_PROFILE}>Tài khoản</Link>
              <Link to={ROUTE_PATHS.ACCOUNT_ORDERS}>Đơn hàng của tôi</Link>
              {!accessToken && (
                <>
                  <Link to={ROUTE_PATHS.LOGIN}>Đăng nhập</Link>
                  <Link to={ROUTE_PATHS.REGISTER}>Đăng ký</Link>
                </>
              )}
            </Space>
          </div>
        </div>

        <Typography.Paragraph className="!mb-0 !mt-8 text-center" type="secondary">
          © {new Date().getFullYear()} {BRAND.legalName}. All rights reserved.
        </Typography.Paragraph>
      </Footer>
    </Layout>
  )
}