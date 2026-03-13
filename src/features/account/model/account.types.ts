import type { AuthUser } from '@/features/auth/model/auth.types'

export interface UpdateMyProfilePayload {
  username?: string
  fullName?: string
  phone?: string
  avatarUrl?: string
}

export interface ChangePasswordPayload {
  currentPassword: string
  newPassword: string
}

export interface AddressItem {
  id: string
  userId: string
  label: string
  recipientName: string
  phone: string
  street: string
  city: string
  district: string
  ward: string
  isDefault: boolean
}

export interface UpsertAddressPayload {
  label?: string
  recipientName: string
  phone: string
  street: string
  city: string
  district: string
  ward: string
  isDefault?: boolean
}

export type UpdateAddressPayload = Partial<UpsertAddressPayload>

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'shipping'
  | 'delivered'
  | 'cancelled'
  | 'returned'

export type PaymentMethod = 'cod' | 'banking' | 'momo' | 'vnpay'
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'

export interface OrderItemSnapshot {
  productId: string
  productName: string
  variantId: string
  variantSku: string
  variantColor: string
  productImage?: string
  quantity: number
  price: number
  total: number
}

export interface OrderStatusHistoryItem {
  status: OrderStatus
  changedBy: string
  note?: string
  changedAt: string
}

export interface MyOrderItem {
  id: string
  orderCode: string
  userId: string
  shippingRecipientName: string
  shippingPhone: string
  shippingAddress: string
  subtotal: number
  shippingFee: number
  discountAmount: number
  totalAmount: number
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  paymentTxnRef?: string
  paymentTransactionNo?: string
  paymentGatewayResponseCode?: string
  paymentUrl?: string
  paidAt?: string
  refundedAt?: string
  voucherId?: string
  status: OrderStatus
  items: OrderItemSnapshot[]
  statusHistory: OrderStatusHistoryItem[]
  createdAt: string
  updatedAt: string
}

export interface PaginatedResponse<T> {
  items: T[]
  page: number
  limit: number
  totalItems: number
  totalPages: number
}

export type MyOrdersResponse = PaginatedResponse<MyOrderItem>

export interface MyOrdersQueryParams {
  page?: number
  limit?: number
  status?: OrderStatus
}

export interface CreateOrderPayload {
  addressId?: string
  shippingRecipientName?: string
  shippingPhone?: string
  shippingAddress?: string
  shippingFee?: number
  voucherCode?: string
  paymentMethod?: PaymentMethod
  selectedVariantIds?: string[]
}

export interface VerifyVnpayReturnPayload {
  [key: string]: string | number | undefined
}

export interface VerifyVnpayReturnResponse {
  order: MyOrderItem
  isSuccess: boolean
  responseCode: string
}

export type UpdateMyProfileResponse = AuthUser

export type VoucherDiscountType = 'percentage' | 'fixed_amount'

export interface CheckoutVoucherItem {
  id: string
  code: string
  description?: string
  discountType: VoucherDiscountType
  discountValue: number
  minOrderValue: number
  maxDiscountAmount?: number
  startDate: string
  expirationDate: string
  usageLimit: number
  usedCount: number
  isActive: boolean
  remainingUsage: number
  isEligible: boolean
  estimatedDiscount: number
}