import type { AuthUser } from '@/features/auth/model/auth.types'

export interface UpdateMyProfilePayload {
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
  | 'awaiting_payment'
  | 'pending'
  | 'confirmed'
  | 'shipping'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'returned'

export type PaymentMethod = 'cod' | 'banking' | 'momo' | 'vnpay' | 'zalopay'
export type ZalopayChannel = 'gateway' | 'wallet' | 'bank_card' | 'atm'
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'
export type VoucherDiscountType = 'percentage' | 'fixed_amount'
export type ReturnRequestStatus = 'pending' | 'approved' | 'rejected' | 'refunded'
export type CancelRefundRequestStatus = 'pending' | 'rejected' | 'refunded'
export type RefundMethod = 'bank_transfer' | 'wallet'

export interface AppliedOrderVoucher {
  id: string
  code: string
  description?: string
  discountType: VoucherDiscountType
  discountValue: number
  maxDiscountAmount?: number
}

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
  isReviewed: boolean
}

export interface OrderStatusHistoryItem {
  status: OrderStatus
  changedBy: string
  note?: string
  changedAt: string
}

export interface ReturnRequestItem {
  productId: string
  productName: string
  variantId: string
  variantSku: string
  quantity: number
  price: number
  total: number
}

export interface ReturnRequest {
  id: string
  requestedBy: string
  status: ReturnRequestStatus
  refundMethod: RefundMethod
  refundAmount: number
  reason?: string
  note?: string
  refundEvidenceImages?: string[]
  items: ReturnRequestItem[]
  createdAt: string
  updatedAt: string
}

export interface CancelRefundRequest {
  requestedBy: string
  status: CancelRefundRequestStatus
  refundAmount: number
  bankCode: string
  bankName: string
  accountNumber: string
  accountHolder: string
  note?: string
  adminNote?: string
  refundEvidenceImages?: string[]
  requestedAt: string
  updatedAt: string
  processedAt?: string
  processedBy?: string
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
  zalopayChannel?: ZalopayChannel
  paymentStatus: PaymentStatus
  paymentTxnRef?: string
  paymentTransactionNo?: string
  paymentGatewayResponseCode?: string
  paymentUrl?: string
  paidAt?: string
  refundedAt?: string
  voucherId?: string
  voucher?: AppliedOrderVoucher
  status: OrderStatus
  items: OrderItemSnapshot[]
  statusHistory: OrderStatusHistoryItem[]
  returnRequests?: ReturnRequest[]
  cancelRefundRequest?: CancelRefundRequest
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
  zalopayChannel?: ZalopayChannel
  selectedVariantIds?: string[]
}

export interface CreateReturnRequestPayload {
  items: Array<{
    variantId: string
    quantity: number
  }>
  reason?: string
  refundMethod?: RefundMethod
}

export interface CreateCancelRefundRequestPayload {
  bankCode: string
  bankName: string
  accountNumber: string
  accountHolder: string
  note?: string
}

export interface CancelMyOrderPayload {
  note: string
}

export interface CreateMyReviewPayload {
  orderId: string
  productId: string
  rating: number
  content?: string
  images?: string[]
}

export interface VerifyVnpayReturnPayload {
  [key: string]: string | number | undefined
}

export interface VerifyVnpayReturnResponse {
  order: MyOrderItem
  isSuccess: boolean
  responseCode: string
}

export interface VerifyZalopayRedirectPayload {
  appid: string
  apptransid: string
  pmcid?: string
  bankcode?: string
  amount?: string | number
  discountamount?: string | number
  status?: string | number
  checksum: string
}

export interface VerifyZalopayRedirectResponse {
  order: MyOrderItem
  isSuccess: boolean
  responseCode: string
}

export type UpdateMyProfileResponse = AuthUser

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
  maxUsagePerUser: number
  usedCount: number
  isActive: boolean
  remainingUsage: number
  usedCountByCurrentUser: number
  remainingUsagePerUser: number
  isEligible: boolean
  estimatedDiscount: number
}
