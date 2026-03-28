export const queryKeys = {
  chatbot: {
    presets: ['chatbot', 'presets'] as const,
  },
  auth: {
    me: ['auth', 'me'] as const,
  },
  health: {
    status: ['health', 'status'] as const,
  },
  cart: {
    me: ['cart', 'me'] as const,
  },
  account: {
    profile: ['account', 'profile'] as const,
    addresses: ['account', 'addresses'] as const,
    checkoutVouchers: (filters?: Record<string, unknown>) =>
      ['account', 'checkout-vouchers', filters ?? {}] as const,
    orders: (filters?: Record<string, unknown>) => ['account', 'orders', filters ?? {}] as const,
    paymentVerification: (gateway: 'vnpay' | 'zalopay', payload: Record<string, unknown>) =>
      ['account', 'payment-verification', gateway, payload] as const,
  },
  admin: {
    dashboardStatistics: (filters?: Record<string, unknown>) =>
      ['admin', 'dashboard-statistics', filters ?? {}] as const,
    users: (filters?: Record<string, unknown>) => ['admin', 'users', filters ?? {}] as const,
    orders: (filters?: Record<string, unknown>) => ['admin', 'orders', filters ?? {}] as const,
    reviews: (filters?: Record<string, unknown>) => ['admin', 'reviews', filters ?? {}] as const,
    comments: (filters?: Record<string, unknown>) => ['admin', 'comments', filters ?? {}] as const,
    vouchers: (filters?: Record<string, unknown>) => ['admin', 'vouchers', filters ?? {}] as const,
    products: (filters?: Record<string, unknown>) =>
      ['admin', 'products', filters ?? {}] as const,
    chatbotPresets: ['admin', 'chatbot-presets'] as const,
    productVariants: (productId: string, filters?: Record<string, unknown>) =>
      ['admin', 'product-variants', productId, filters ?? {}] as const,
    productMeta: {
      categories: ['admin', 'product-meta', 'categories'] as const,
      brands: ['admin', 'product-meta', 'brands'] as const,
      colors: ['admin', 'product-meta', 'colors'] as const,
      sizes: ['admin', 'product-meta', 'sizes'] as const,
    },
    masterData: {
      categories: (filters?: Record<string, unknown>) =>
        ['admin', 'master-data', 'categories', filters ?? {}] as const,
      brands: (filters?: Record<string, unknown>) =>
        ['admin', 'master-data', 'brands', filters ?? {}] as const,
      colors: (filters?: Record<string, unknown>) =>
        ['admin', 'master-data', 'colors', filters ?? {}] as const,
      sizes: (filters?: Record<string, unknown>) =>
        ['admin', 'master-data', 'sizes', filters ?? {}] as const,
    },
  },
  products: {
    filters: ['products', 'filters'] as const,
    topSelling: ['products', 'top-selling'] as const,
    newest: ['products', 'newest'] as const,
    list: (filters?: Record<string, unknown>) => ['products', 'list', filters ?? {}] as const,
    detail: (productId: string) => ['products', 'detail', productId] as const,
    reviews: (productId: string) => ['products', 'reviews', productId] as const,
    comments: (productId: string) => ['products', 'comments', productId] as const,
    related: (productId: string, categoryId?: string) =>
      ['products', 'related', productId, categoryId ?? 'none'] as const,
  },
}
