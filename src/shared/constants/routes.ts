export const ROUTE_PATHS = {
  ROOT: '/',
  ABOUT: '/about',
  PRODUCTS: '/products',
  CART: '/cart',
  CHECKOUT: '/checkout',
  PAYMENT_SUCCESS: '/success',
  ACCOUNT: '/account',
  ACCOUNT_PROFILE: '/account/profile',
  ACCOUNT_ADDRESSES: '/account/addresses',
  ACCOUNT_ORDERS: '/account/orders',
  ACCOUNT_CHANGE_PASSWORD: '/account/change-password',
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  DASHBOARD: '/dashboard',
  DASHBOARD_CENTER: '/dashboard/center',
  DASHBOARD_STATISTICS: '/dashboard/statistics',
  DASHBOARD_ORDERS: '/dashboard/orders',
  DASHBOARD_REVIEWS: '/dashboard/reviews',
  DASHBOARD_COMMENTS: '/dashboard/comments',
  DASHBOARD_PRODUCTS: '/dashboard/products',
  DASHBOARD_PRODUCTS_DETAIL: '/dashboard/products/:productId',
  DASHBOARD_PRODUCTS_EDIT: '/dashboard/products/:productId/edit',
  DASHBOARD_PRODUCTS_CREATE: '/dashboard/products/create',
  DASHBOARD_VOUCHERS: '/dashboard/vouchers',
  DASHBOARD_USERS: '/dashboard/users',
  DASHBOARD_ACCOUNTS: '/dashboard/accounts',
  DASHBOARD_MASTER_DATA: '/dashboard/master-data',
  DASHBOARD_SUPPORT_CHAT: '/dashboard/support-chat',
  DASHBOARD_CHATBOT_PRESETS: '/dashboard/chatbot-presets',
  PRODUCT_DETAIL: '/products/:productId',
} as const

export const buildProductDetailPath = (productId: string) => {
  return ROUTE_PATHS.PRODUCT_DETAIL.replace(':productId', productId)
}

export const buildCheckoutPath = (selectedVariantIds?: string[]) => {
  const normalizedVariantIds = (selectedVariantIds ?? []).map((id) => id.trim()).filter(Boolean)

  if (normalizedVariantIds.length === 0) {
    return ROUTE_PATHS.CHECKOUT
  }

  const params = new URLSearchParams()
  params.set('variantIds', normalizedVariantIds.join(','))
  return `${ROUTE_PATHS.CHECKOUT}?${params.toString()}`
}

export type ProductManagementMode = 'list' | 'create'

export const buildDashboardProductsPath = (mode: ProductManagementMode = 'list') => {
  return mode === 'create' ? ROUTE_PATHS.DASHBOARD_PRODUCTS_CREATE : ROUTE_PATHS.DASHBOARD_PRODUCTS
}

export const buildDashboardProductEditPath = (productId: string) => {
  return ROUTE_PATHS.DASHBOARD_PRODUCTS_EDIT.replace(':productId', productId)
}

export const buildDashboardProductDetailPath = (productId: string) => {
  return ROUTE_PATHS.DASHBOARD_PRODUCTS_DETAIL.replace(':productId', productId)
}

export type MasterDataTabKey = 'categories' | 'brands' | 'colors' | 'sizes'

export const buildDashboardMasterDataPath = (tab?: MasterDataTabKey) => {
  if (!tab) {
    return ROUTE_PATHS.DASHBOARD_MASTER_DATA
  }

  return `${ROUTE_PATHS.DASHBOARD_MASTER_DATA}?tab=${tab}`
}

export type AuthRole = 'customer' | 'staff' | 'admin'

export const isBackofficeRole = (role?: AuthRole | null) => {
  return role === 'staff' || role === 'admin'
}

export const getDefaultRouteByRole = (role?: AuthRole | null) => {
  return isBackofficeRole(role) ? ROUTE_PATHS.DASHBOARD : ROUTE_PATHS.ROOT
}
