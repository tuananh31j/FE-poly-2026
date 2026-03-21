import type { AuthUser } from '@/features/auth/model/auth.types'
import { httpClient } from '@/shared/api/httpClient'
import { extractApiData, toApiClientError } from '@/shared/api/response'
import type { ApiSuccess } from '@/shared/types/api.types'

import type {
  AddressItem,
  ChangePasswordPayload,
  CheckoutVoucherItem,
  CreateOrderPayload,
  CreateReturnRequestPayload,
  MyOrderItem,
  MyOrdersQueryParams,
  MyOrdersResponse,
  OrderItemSnapshot,
  OrderStatusHistoryItem,
  RefundMethod,
  ReturnRequest,
  ReturnRequestItem,
  UpdateAddressPayload,
  UpdateMyProfilePayload,
  UpdateMyProfileResponse,
  UpsertAddressPayload,
  VerifyVnpayReturnPayload,
  VerifyVnpayReturnResponse,
  VerifyZalopayRedirectPayload,
  VerifyZalopayRedirectResponse,
} from '../model/account.types'

// worklog: 2026-03-04 22:03:47 | trantu | fix | toId
const toId = (value: unknown) => {
  return typeof value === 'string' ? value : String(value ?? '')
}

const toRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined
  }

  return value as Record<string, unknown>
}

// worklog: 2026-03-04 17:03:09 | ducanh | feature | toStringArray
// worklog: 2026-03-04 17:55:11 | ducanh | cleanup | toStringArray
const toStringArray = (value: unknown) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string')
}

const normalizeVoucherDiscountType = (value: unknown): CheckoutVoucherItem['discountType'] => {
  return value === 'fixed_amount' ? 'fixed_amount' : 'percentage'
}

const normalizeAuthUser = (value: Record<string, unknown>): AuthUser => {
  return {
    id: toId(value.id ?? value._id),
    email: String(value.email ?? ''),
    isActive: typeof value.isActive === 'boolean' ? value.isActive : true,
    fullName: typeof value.fullName === 'string' ? value.fullName : undefined,
    phone: typeof value.phone === 'string' ? value.phone : undefined,
    role:
      value.role === 'admin' || value.role === 'staff' || value.role === 'customer'
        ? value.role
        : 'customer',
    avatarUrl: typeof value.avatarUrl === 'string' ? value.avatarUrl : undefined,
    loyaltyPoints: typeof value.loyaltyPoints === 'number' ? value.loyaltyPoints : undefined,
    membershipTier: typeof value.membershipTier === 'string' ? value.membershipTier : undefined,
    staffDepartment:
      typeof value.staffDepartment === 'string' ? value.staffDepartment : undefined,
    staffStartDate: typeof value.staffStartDate === 'string' ? value.staffStartDate : undefined,
    createdAt: String(value.createdAt ?? ''),
    updatedAt: String(value.updatedAt ?? ''),
  }
}

const normalizeAddress = (value: Record<string, unknown>): AddressItem => {
  return {
    id: toId(value.id ?? value._id),
    userId: toId(value.userId),
    label: String(value.label ?? 'Home'),
    recipientName: String(value.recipientName ?? ''),
    phone: String(value.phone ?? ''),
    street: String(value.street ?? ''),
    city: String(value.city ?? ''),
    district: String(value.district ?? ''),
    ward: String(value.ward ?? ''),
    isDefault: Boolean(value.isDefault),
  }
}

const normalizeCheckoutVoucher = (value: Record<string, unknown>): CheckoutVoucherItem => {
  const usageLimit = Number(value.usageLimit ?? 0)
  const normalizedMaxUsagePerUserRaw = Number(value.maxUsagePerUser)
  const maxUsagePerUser = Number.isFinite(normalizedMaxUsagePerUserRaw)
    ? normalizedMaxUsagePerUserRaw
    : Math.max(1, usageLimit - 1)

  return {
    id: toId(value.id ?? value._id),
    code: String(value.code ?? ''),
    description: typeof value.description === 'string' ? value.description : undefined,
    discountType: normalizeVoucherDiscountType(value.discountType),
    discountValue: Number(value.discountValue ?? 0),
    minOrderValue: Number(value.minOrderValue ?? 0),
    maxDiscountAmount:
      typeof value.maxDiscountAmount === 'number' ? value.maxDiscountAmount : undefined,
    startDate: String(value.startDate ?? ''),
    expirationDate: String(value.expirationDate ?? ''),
    usageLimit,
    maxUsagePerUser,
    usedCount: Number(value.usedCount ?? 0),
    isActive: Boolean(value.isActive),
    remainingUsage: Number(value.remainingUsage ?? 0),
    usedCountByCurrentUser: Number(value.usedCountByCurrentUser ?? 0),
    remainingUsagePerUser: Number(value.remainingUsagePerUser ?? 0),
    isEligible: Boolean(value.isEligible),
    estimatedDiscount: Number(value.estimatedDiscount ?? 0),
  }
}

const normalizeOrderSnapshot = (value: Record<string, unknown>): OrderItemSnapshot => {
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

const normalizeOrderStatusHistory = (value: Record<string, unknown>): OrderStatusHistoryItem => {
  return {
    status:
      value.status === 'confirmed' ||
      value.status === 'shipping' ||
      value.status === 'delivered' ||
      value.status === 'completed' ||
      value.status === 'cancelled' ||
      value.status === 'returned'
        ? value.status
        : 'pending',
    changedBy: toId(value.changedBy),
    note: typeof value.note === 'string' ? value.note : undefined,
    changedAt: String(value.changedAt ?? ''),
  }
}

const normalizeRefundMethod = (value: unknown): RefundMethod => {
  return value === 'wallet' ? 'wallet' : 'bank_transfer'
}

const normalizeReturnItem = (value: Record<string, unknown>): ReturnRequestItem => {
  return {
    productId: toId(value.productId),
    productName: String(value.productName ?? ''),
    variantId: toId(value.variantId),
    variantSku: String(value.variantSku ?? ''),
    quantity: Number(value.quantity ?? 0),
    price: Number(value.price ?? 0),
    total: Number(value.total ?? 0),
  }
}

const normalizeReturnRequest = (value: Record<string, unknown>): ReturnRequest => {
  const rawItems = Array.isArray(value.items) ? value.items : []

  return {
    id: toId(value.id ?? value._id),
    requestedBy: toId(value.requestedBy),
    status:
      value.status === 'approved' ||
      value.status === 'rejected' ||
      value.status === 'refunded'
        ? value.status
        : 'pending',
    refundMethod: normalizeRefundMethod(value.refundMethod),
    refundAmount: Number(value.refundAmount ?? 0),
    reason: typeof value.reason === 'string' ? value.reason : undefined,
    note: typeof value.note === 'string' ? value.note : undefined,
    refundEvidenceImages: toStringArray(value.refundEvidenceImages),
    items: rawItems
      .map((item) => toRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item) => normalizeReturnItem(item)),
    createdAt: String(value.createdAt ?? ''),
    updatedAt: String(value.updatedAt ?? ''),
  }
}

const normalizeOrder = (value: Record<string, unknown>): MyOrderItem => {
  const rawItems = Array.isArray(value.items) ? value.items : []
  const rawStatusHistory = Array.isArray(value.statusHistory) ? value.statusHistory : []
  const rawReturnRequests = Array.isArray(value.returnRequests) ? value.returnRequests : []

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
    zalopayChannel:
      value.zalopayChannel === 'bank_card' || value.zalopayChannel === 'wallet'
        ? value.zalopayChannel
        : undefined,
    paymentTxnRef: typeof value.paymentTxnRef === 'string' ? value.paymentTxnRef : undefined,
    paymentTransactionNo:
      typeof value.paymentTransactionNo === 'string' ? value.paymentTransactionNo : undefined,
    paymentGatewayResponseCode:
      typeof value.paymentGatewayResponseCode === 'string'
        ? value.paymentGatewayResponseCode
        : undefined,
    paymentUrl: typeof value.paymentUrl === 'string' ? value.paymentUrl : undefined,
    paidAt: typeof value.paidAt === 'string' ? value.paidAt : undefined,
    refundedAt: typeof value.refundedAt === 'string' ? value.refundedAt : undefined,
    voucherId: value.voucherId ? toId(value.voucherId) : undefined,
    status:
      value.status === 'confirmed' ||
      value.status === 'shipping' ||
      value.status === 'delivered' ||
      value.status === 'completed' ||
      value.status === 'cancelled' ||
      value.status === 'returned'
        ? value.status
        : 'pending',
    items: rawItems
      .map((item) => toRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item) => normalizeOrderSnapshot(item)),
    statusHistory: rawStatusHistory
      .map((item) => toRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item) => normalizeOrderStatusHistory(item)),
    returnRequests: rawReturnRequests
      .map((item) => toRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item) => normalizeReturnRequest(item)),
    createdAt: String(value.createdAt ?? ''),
    updatedAt: String(value.updatedAt ?? ''),
  }
}

const normalizeOrdersResponse = (value: Record<string, unknown>): MyOrdersResponse => {
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

export const updateMyProfile = async (
  payload: UpdateMyProfilePayload
): Promise<UpdateMyProfileResponse> => {
  try {
    const response = await httpClient.patch<ApiSuccess<Record<string, unknown>>>('/auth/me', payload)
    return normalizeAuthUser(extractApiData(response))
  } catch (error) {
    throw toApiClientError(error)
  }
}

// worklog: 2026-03-04 20:41:46 | quochuy | fix | changeMyPassword
export const changeMyPassword = async (payload: ChangePasswordPayload) => {
  try {
    await httpClient.post<ApiSuccess<null>>('/auth/change-password', payload)
  } catch (error) {
    throw toApiClientError(error)
  }
}

export const listMyAddresses = async () => {
  try {
    const response = await httpClient.get<ApiSuccess<unknown[]>>('/addresses')
    const data = extractApiData(response)

    return data
      .map((item) => toRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item) => normalizeAddress(item))
  } catch (error) {
    throw toApiClientError(error)
  }
}

// worklog: 2026-03-04 16:20:08 | trantu | feature | createMyAddress
export const createMyAddress = async (payload: UpsertAddressPayload) => {
  try {
    const response = await httpClient.post<ApiSuccess<Record<string, unknown>>>('/addresses', payload)
    return normalizeAddress(extractApiData(response))
  } catch (error) {
    throw toApiClientError(error)
  }
}

// worklog: 2026-03-04 10:16:25 | quochuy | cleanup | updateMyAddress
export const updateMyAddress = async (addressId: string, payload: UpdateAddressPayload) => {
  try {
    const response = await httpClient.patch<ApiSuccess<Record<string, unknown>>>(
      `/addresses/${addressId}`,
      payload
    )

    return normalizeAddress(extractApiData(response))
  } catch (error) {
    throw toApiClientError(error)
  }
}

// worklog: 2026-03-04 09:11:43 | ducanh | fix | deleteMyAddress
export const deleteMyAddress = async (addressId: string) => {
  try {
    await httpClient.delete<ApiSuccess<Record<string, unknown>>>(`/addresses/${addressId}`)
  } catch (error) {
    throw toApiClientError(error)
  }
}

export const listMyOrders = async (params: MyOrdersQueryParams = {}) => {
  try {
    const response = await httpClient.get<ApiSuccess<Record<string, unknown>>>('/orders', {
      params,
    })

    return normalizeOrdersResponse(extractApiData(response))
  } catch (error) {
    throw toApiClientError(error)
  }
}

export const getMyOrderById = async (orderId: string) => {
  try {
    const response = await httpClient.get<ApiSuccess<Record<string, unknown>>>(
      `/orders/${orderId}`
    )

    return normalizeOrder(extractApiData(response))
  } catch (error) {
    throw toApiClientError(error)
  }
}

export const cancelMyOrder = async (orderId: string, note?: string) => {
  try {
    const response = await httpClient.post<ApiSuccess<Record<string, unknown>>>(
      `/orders/${orderId}/cancel`,
      note?.trim() ? { note: note.trim() } : undefined
    )

    return normalizeOrder(extractApiData(response))
  } catch (error) {
    throw toApiClientError(error)
  }
}

export const confirmOrderReceived = async (orderId: string) => {
  try {
    const response = await httpClient.post<ApiSuccess<Record<string, unknown>>>(
      `/orders/${orderId}/received`
    )

    return normalizeOrder(extractApiData(response))
  } catch (error) {
    throw toApiClientError(error)
  }
}

export const createReturnRequest = async (
  orderId: string,
  payload: CreateReturnRequestPayload
) => {
  try {
    const response = await httpClient.post<ApiSuccess<Record<string, unknown>>>(
      `/orders/${orderId}/return`,
      payload
    )

    return normalizeOrder(extractApiData(response))
  } catch (error) {
    throw toApiClientError(error)
  }
}

export const createOrder = async (payload: CreateOrderPayload) => {
  try {
    const response = await httpClient.post<ApiSuccess<Record<string, unknown>>>('/orders', payload)
    return normalizeOrder(extractApiData(response))
  } catch (error) {
    throw toApiClientError(error)
  }
}

// worklog: 2026-03-04 20:51:53 | ducanh | feature | listAvailableCheckoutVouchers
// worklog: 2026-03-04 21:16:19 | ducanh | cleanup | listAvailableCheckoutVouchers
// worklog: 2026-03-04 18:01:37 | trantu | cleanup | listAvailableCheckoutVouchers
export const listAvailableCheckoutVouchers = async (subtotal?: number) => {
  try {
    const response = await httpClient.get<ApiSuccess<unknown[]>>('/vouchers/available', {
      params:
        typeof subtotal === 'number' && Number.isFinite(subtotal) && subtotal > 0
          ? { subtotal }
          : undefined,
    })
    const data = extractApiData(response)

    return data
      .map((item) => toRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item) => normalizeCheckoutVoucher(item))
  } catch (error) {
    throw toApiClientError(error)
  }
}

export const retryMyVnpayPayment = async (orderId: string) => {
  try {
    const response = await httpClient.post<ApiSuccess<Record<string, unknown>>>(
      `/orders/${orderId}/repay`
    )

    return normalizeOrder(extractApiData(response))
  } catch (error) {
    throw toApiClientError(error)
  }
}

const normalizeVerifyVnpayReturnResponse = (
  value: Record<string, unknown>
): VerifyVnpayReturnResponse => {
  const orderRecord = toRecord(value.order)

  if (!orderRecord) {
    throw new Error('Invalid order response')
  }

  return {
    order: normalizeOrder(orderRecord),
    isSuccess: Boolean(value.isSuccess),
    responseCode: String(value.responseCode ?? ''),
  }
}

export const verifyVnpayReturn = async (payload: VerifyVnpayReturnPayload) => {
  try {
    const response = await httpClient.post<ApiSuccess<Record<string, unknown>>>(
      '/orders/vnpay/verify-return',
      payload
    )

    return normalizeVerifyVnpayReturnResponse(extractApiData(response))
  } catch (error) {
    throw toApiClientError(error)
  }
}

const normalizeVerifyZalopayRedirectResponse = (
  value: Record<string, unknown>
): VerifyZalopayRedirectResponse => {
  const orderRecord = toRecord(value.order)

  if (!orderRecord) {
    throw new Error('Invalid order response')
  }

  return {
    order: normalizeOrder(orderRecord),
    isSuccess: Boolean(value.isSuccess),
    responseCode: String(value.responseCode ?? ''),
  }
}

export const verifyZalopayRedirect = async (payload: VerifyZalopayRedirectPayload) => {
  try {
    const response = await httpClient.post<ApiSuccess<Record<string, unknown>>>(
      '/orders/zalopay/verify-redirect',
      payload
    )

    return normalizeVerifyZalopayRedirectResponse(extractApiData(response))
  } catch (error) {
    throw toApiClientError(error)
  }
}

// worklog: 2026-03-04 14:54:15 | ducanh | refactor | toImageList
// worklog: 2026-03-04 12:58:05 | trantu | fix | toImageList
export const toImageList = (value: unknown) => {
  return toStringArray(value)
}
