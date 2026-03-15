import { httpClient } from '@/shared/api/httpClient'
import { extractApiData, toApiClientError } from '@/shared/api/response'
import type { ApiSuccess } from '@/shared/types/api.types'

import type {
  AdminOrderItem,
  AdminOrderItemSnapshot,
  AdminOrdersResponse,
  AdminOrderStatus,
  AdminOrderStatusHistoryItem,
  ListAdminOrdersParams,
  UpdateAdminOrderStatusPayload,
} from '../model/order-management.types'

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

const normalizeOrderSnapshot = (value: Record<string, unknown>): AdminOrderItemSnapshot => {
  return {
    productId: toId(value.productId),
    productName: String(value.productName ?? ''),
    variantId: toId(value.variantId),
    variantSku: String(value.variantSku ?? ''),
    variantColor: String(value.variantColor ?? ''),
    productImage: typeof value.productImage === 'string' ? value.productImage : undefined,
    quantity: Number(value.quantity ?? 0),
    price: Number(value.price ?? 0),
    total: Number(value.total ?? 0),
  }
}

const normalizeOrderStatusHistory = (
  value: Record<string, unknown>
): AdminOrderStatusHistoryItem => {
  return {
    status: normalizeOrderStatus(value.status),
    changedBy: toId(value.changedBy),
    note: typeof value.note === 'string' ? value.note : undefined,
    changedAt: String(value.changedAt ?? ''),
  }
}

const normalizeOrder = (value: Record<string, unknown>): AdminOrderItem => {
  const rawItems = Array.isArray(value.items) ? value.items : []
  const rawStatusHistory = Array.isArray(value.statusHistory) ? value.statusHistory : []

  return {
    id: toId(value.id ?? value._id),
    orderCode: String(value.orderCode ?? ''),
    userId: toId(value.userId),
    shippingRecipientName: String(value.shippingRecipientName ?? ''),
    shippingPhone: String(value.shippingPhone ?? ''),
    shippingAddress: String(value.shippingAddress ?? ''),
    subtotal: Number(value.subtotal ?? 0),
    shippingFee: Number(value.shippingFee ?? 0),
    discountAmount: Number(value.discountAmount ?? 0),
    totalAmount: Number(value.totalAmount ?? 0),
    paymentMethod:
      value.paymentMethod === 'banking' ||
      value.paymentMethod === 'momo' ||
      value.paymentMethod === 'vnpay' ||
      value.paymentMethod === 'zalopay'
        ? value.paymentMethod
        : 'cod',
    paymentStatus:
      value.paymentStatus === 'paid' ||
      value.paymentStatus === 'failed' ||
      value.paymentStatus === 'refunded'
        ? value.paymentStatus
        : 'pending',
    voucherId: value.voucherId ? toId(value.voucherId) : undefined,
    status: normalizeOrderStatus(value.status),
    items: rawItems
      .map((item) => toRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item) => normalizeOrderSnapshot(item)),
    statusHistory: rawStatusHistory
      .map((item) => toRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item) => normalizeOrderStatusHistory(item)),
    createdAt: String(value.createdAt ?? ''),
    updatedAt: String(value.updatedAt ?? ''),
  }
}

const normalizeOrdersResponse = (value: Record<string, unknown>): AdminOrdersResponse => {
  const rawItems = Array.isArray(value.items) ? value.items : []

  return {
    items: rawItems
      .map((item) => toRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item) => normalizeOrder(item)),
    page: Number(value.page ?? 1),
    limit: Number(value.limit ?? 20),
    totalItems: Number(value.totalItems ?? 0),
    totalPages: Number(value.totalPages ?? 1),
  }
}

export const listAdminOrders = async (
  params: ListAdminOrdersParams = {}
): Promise<AdminOrdersResponse> => {
  try {
    const response = await httpClient.get<ApiSuccess<Record<string, unknown>>>('/orders/admin/all', {
      params,
    })

    return normalizeOrdersResponse(extractApiData(response))
  } catch (error) {
    throw toApiClientError(error)
  }
}

export const updateAdminOrderStatus = async (
  orderId: string,
  payload: UpdateAdminOrderStatusPayload
): Promise<AdminOrderItem> => {
  try {
    const response = await httpClient.patch<ApiSuccess<Record<string, unknown>>>(
      `/orders/${orderId}/status`,
      payload
    )

    return normalizeOrder(extractApiData(response))
  } catch (error) {
    throw toApiClientError(error)
  }
}
