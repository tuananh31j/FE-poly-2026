import { httpClient } from '@/shared/api/httpClient'
import { extractApiData, toApiClientError } from '@/shared/api/response'
import type { ApiSuccess } from '@/shared/types/api.types'

import type {
  DashboardBreakdowns,
  DashboardDailyRevenueItem,
  DashboardStatisticsResponse,
  DashboardSummary,
  DashboardTopProductItem,
  DashboardTopVariantItem,
  DashboardTrends,
} from '../model/dashboard-statistics.types'
import type { AdminOrderStatus, AdminPaymentMethod } from '../model/order-management.types'

const toId = (value: unknown) => {
  return typeof value === 'string' ? value : String(value ?? '')
}

const toRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined
  }

  return value as Record<string, unknown>
}

const normalizeOrderStatus = (value: unknown): AdminOrderStatus => {
  return value === 'confirmed' ||
    value === 'preparing' ||
    value === 'shipping' ||
    value === 'delivered' ||
    value === 'cancelled' ||
    value === 'returned'
    ? value
    : 'pending'
}

const normalizePaymentMethod = (value: unknown): AdminPaymentMethod => {
  return value === 'banking' ||
    value === 'momo' ||
    value === 'vnpay' ||
    value === 'zalopay'
    ? value
    : 'cod'
}

const normalizeSummary = (value: Record<string, unknown>): DashboardSummary => {
  return {
    totalOrders: Number(value.totalOrders ?? 0),
    deliveredOrders: Number(value.deliveredOrders ?? 0),
    processingOrders: Number(value.processingOrders ?? 0),
    cancelledOrders: Number(value.cancelledOrders ?? 0),
    grossRevenue: Number(value.grossRevenue ?? 0),
    deliveredRevenue: Number(value.deliveredRevenue ?? 0),
    averageDeliveredOrderValue: Number(value.averageDeliveredOrderValue ?? 0),
    totalItemsSold: Number(value.totalItemsSold ?? 0),
    totalUsers: Number(value.totalUsers ?? 0),
    customersCount: Number(value.customersCount ?? 0),
    staffCount: Number(value.staffCount ?? 0),
    adminCount: Number(value.adminCount ?? 0),
    activeUsers: Number(value.activeUsers ?? 0),
    inactiveUsers: Number(value.inactiveUsers ?? 0),
    totalProducts: Number(value.totalProducts ?? 0),
    availableProducts: Number(value.availableProducts ?? 0),
    outOfStockVariants: Number(value.outOfStockVariants ?? 0),
    lowStockVariants: Number(value.lowStockVariants ?? 0),
    totalReviews: Number(value.totalReviews ?? 0),
    totalComments: Number(value.totalComments ?? 0),
  }
}

const normalizeDailyRevenue = (value: Record<string, unknown>): DashboardDailyRevenueItem => {
  return {
    date: String(value.date ?? ''),
    revenue: Number(value.revenue ?? 0),
    orders: Number(value.orders ?? 0),
    deliveredOrders: Number(value.deliveredOrders ?? 0),
  }
}

const normalizeTrends = (value: Record<string, unknown>): DashboardTrends => {
  const rawDailyRevenue = Array.isArray(value.dailyRevenue) ? value.dailyRevenue : []

  return {
    days: Number(value.days ?? 7),
    fromDate: String(value.fromDate ?? ''),
    toDate: String(value.toDate ?? ''),
    dailyRevenue: rawDailyRevenue
      .map((item) => toRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item) => normalizeDailyRevenue(item)),
  }
}

const normalizeBreakdowns = (value: Record<string, unknown>): DashboardBreakdowns => {
  const rawByStatus = Array.isArray(value.byStatus) ? value.byStatus : []
  const rawByPaymentMethod = Array.isArray(value.byPaymentMethod) ? value.byPaymentMethod : []
  const rawByCategory = Array.isArray(value.byCategory) ? value.byCategory : []

  return {
    byStatus: rawByStatus
      .map((item) => toRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item) => ({
        status: normalizeOrderStatus(item.status),
        count: Number(item.count ?? 0),
        revenue: Number(item.revenue ?? 0),
      })),
    byPaymentMethod: rawByPaymentMethod
      .map((item) => toRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item) => ({
        paymentMethod: normalizePaymentMethod(item.paymentMethod),
        count: Number(item.count ?? 0),
        revenue: Number(item.revenue ?? 0),
      })),
    byCategory: rawByCategory
      .map((item) => toRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item) => ({
        categoryId: item.categoryId ? toId(item.categoryId) : null,
        categoryName: String(item.categoryName ?? 'Không xác định'),
        orders: Number(item.orders ?? 0),
        deliveredOrders: Number(item.deliveredOrders ?? 0),
        items: Number(item.items ?? 0),
        revenue: Number(item.revenue ?? 0),
      })),
  }
}

const normalizeTopProduct = (value: Record<string, unknown>): DashboardTopProductItem => {
  return {
    productId: toId(value.productId ?? value.id ?? value._id),
    name: String(value.name ?? ''),
    brand: String(value.brand ?? 'Generic'),
    soldCount: Number(value.soldCount ?? 0),
    reviewCount: Number(value.reviewCount ?? 0),
    averageRating: Number(value.averageRating ?? 0),
    isAvailable: Boolean(value.isAvailable),
    thumbnailUrl: typeof value.thumbnailUrl === 'string' ? value.thumbnailUrl : null,
  }
}

const normalizeTopVariant = (value: Record<string, unknown>): DashboardTopVariantItem => {
  return {
    variantId: toId(value.variantId ?? value.id ?? value._id),
    productId: toId(value.productId),
    productName: String(value.productName ?? ''),
    variantSku: String(value.variantSku ?? ''),
    variantColor: String(value.variantColor ?? ''),
    size: String(value.size ?? 'Standard'),
    soldCount: Number(value.soldCount ?? 0),
    revenue: Number(value.revenue ?? 0),
    stockQuantity: Number(value.stockQuantity ?? 0),
    isAvailable: Boolean(value.isAvailable),
    thumbnailUrl: typeof value.thumbnailUrl === 'string' ? value.thumbnailUrl : null,
  }
}

const normalizeDashboardStatistics = (value: Record<string, unknown>): DashboardStatisticsResponse => {
  const summaryRecord = toRecord(value.summary)
  const trendsRecord = toRecord(value.trends)
  const breakdownsRecord = toRecord(value.breakdowns)
  const rawTopProducts = Array.isArray(value.topProducts) ? value.topProducts : []
  const rawBottomProducts = Array.isArray(value.bottomProducts) ? value.bottomProducts : []
  const rawTopVariants = Array.isArray(value.topVariants) ? value.topVariants : []
  const rawBottomVariants = Array.isArray(value.bottomVariants) ? value.bottomVariants : []

  return {
    summary: normalizeSummary(summaryRecord ?? {}),
    trends: normalizeTrends(trendsRecord ?? {}),
    breakdowns: normalizeBreakdowns(breakdownsRecord ?? {}),
    topProducts: rawTopProducts
      .map((item) => toRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item) => normalizeTopProduct(item)),
    bottomProducts: rawBottomProducts
      .map((item) => toRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item) => normalizeTopProduct(item)),
    topVariants: rawTopVariants
      .map((item) => toRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item) => normalizeTopVariant(item)),
    bottomVariants: rawBottomVariants
      .map((item) => toRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item) => normalizeTopVariant(item)),
  }
}

export const getAdminDashboardStatistics = async (days = 7): Promise<DashboardStatisticsResponse> => {
  try {
    const response = await httpClient.get<ApiSuccess<Record<string, unknown>>>(
      '/orders/admin/statistics',
      {
        params: {
          days,
        },
      }
    )

    return normalizeDashboardStatistics(extractApiData(response))
  } catch (error) {
    throw toApiClientError(error)
  }
}