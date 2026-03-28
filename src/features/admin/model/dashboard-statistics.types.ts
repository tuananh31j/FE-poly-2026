import type { AdminOrderStatus, AdminPaymentMethod } from './order-management.types'

export type DashboardStatisticsPeriod = 'rolling' | 'day' | 'week' | 'month' | 'custom'

export interface DashboardStatisticsFilters extends Record<string, unknown> {
  days?: number
  period?: Exclude<DashboardStatisticsPeriod, 'rolling'>
  fromDate?: string
  toDate?: string
}

export interface DashboardSummary {
  totalOrders: number
  deliveredOrders: number
  processingOrders: number
  cancelledOrders: number
  grossRevenue: number
  deliveredRevenue: number
  averageDeliveredOrderValue: number
  totalItemsSold: number
  totalUsers: number
  customersCount: number
  newCustomersCount: number
  purchasingCustomers: number
  staffCount: number
  adminCount: number
  activeUsers: number
  inactiveUsers: number
  totalCategories: number
  categoriesWithOrders: number
  totalProducts: number
  soldProducts: number
  soldVariants: number
  availableProducts: number
  outOfStockVariants: number
  lowStockVariants: number
  totalReviews: number
  totalComments: number
}

export interface DashboardDailyRevenueItem {
  date: string
  revenue: number
  orders: number
  deliveredOrders: number
}

export interface DashboardTrends {
  days: number
  period: DashboardStatisticsPeriod
  label: string
  fromDate: string
  toDate: string
  dailyRevenue: DashboardDailyRevenueItem[]
}

export interface DashboardStatusBreakdownItem {
  status: AdminOrderStatus
  count: number
  revenue: number
}

export interface DashboardPaymentMethodBreakdownItem {
  paymentMethod: AdminPaymentMethod
  count: number
  revenue: number
}

export interface DashboardCategoryBreakdownItem {
  categoryId: string | null
  categoryName: string
  orders: number
  deliveredOrders: number
  items: number
  revenue: number
}

export interface DashboardBreakdowns {
  byStatus: DashboardStatusBreakdownItem[]
  byPaymentMethod: DashboardPaymentMethodBreakdownItem[]
  byCategory: DashboardCategoryBreakdownItem[]
}

export interface DashboardTopProductItem {
  productId: string
  name: string
  brand: string
  soldCount: number
  reviewCount: number
  averageRating: number
  isAvailable: boolean
  thumbnailUrl: string | null
}

export interface DashboardTopVariantItem {
  variantId: string
  productId: string
  productName: string
  variantSku: string
  variantColor: string
  size: string
  soldCount: number
  revenue: number
  stockQuantity: number
  isAvailable: boolean
  thumbnailUrl: string | null
}

export interface DashboardStatisticsResponse {
  summary: DashboardSummary
  trends: DashboardTrends
  breakdowns: DashboardBreakdowns
  topProducts: DashboardTopProductItem[]
  bottomProducts: DashboardTopProductItem[]
  topVariants: DashboardTopVariantItem[]
  bottomVariants: DashboardTopVariantItem[]
}
