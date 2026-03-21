export type AdminOrderStatus =
  | 'pending'
  | 'confirmed'
  | 'shipping'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'returned'

export type AdminPaymentMethod = 'cod' | 'banking' | 'momo' | 'vnpay' | 'zalopay'
export type AdminZalopayChannel = 'wallet' | 'bank_card'
export type AdminPaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'
export type AdminReturnRequestStatus = 'pending' | 'approved' | 'rejected' | 'refunded'
export type AdminRefundMethod = 'bank_transfer' | 'wallet'
export type AdminUserRole = 'customer' | 'staff' | 'admin'

export interface AdminOrderUser {
  id: string
  fullName?: string
  email?: string
  role?: AdminUserRole
}

export interface AdminReturnRequestItem {
  productId: string
  productName: string
  variantId: string
  variantSku: string
  quantity: number
  price: number
  total: number
}

export interface AdminReturnRequest {
  id: string
  requestedBy: string
  status: AdminReturnRequestStatus
  refundMethod: AdminRefundMethod
  refundAmount: number
  reason?: string
  note?: string
  refundEvidenceImages?: string[]
  items: AdminReturnRequestItem[]
  createdAt: string
  updatedAt: string
}

export interface AdminOrderItemSnapshot {
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

export interface AdminOrderStatusHistoryItem {
  status: AdminOrderStatus
  changedBy: string
  note?: string
  changedAt: string
}

export interface AdminOrderItem {
  id: string
  orderCode: string
  userId: string
  user?: AdminOrderUser
  shippingRecipientName: string
  shippingPhone: string
  shippingAddress: string
  subtotal: number
  shippingFee: number
  discountAmount: number
  totalAmount: number
  paymentMethod: AdminPaymentMethod
  zalopayChannel?: AdminZalopayChannel
  paymentStatus: AdminPaymentStatus
  voucherId?: string
  status: AdminOrderStatus
  items: AdminOrderItemSnapshot[]
  statusHistory: AdminOrderStatusHistoryItem[]
  returnRequests?: AdminReturnRequest[]
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

export type AdminOrdersResponse = PaginatedResponse<AdminOrderItem>

export interface ListAdminOrdersParams {
  page?: number
  limit?: number
  status?: AdminOrderStatus
  userId?: string
  search?: string
}

export interface UpdateAdminOrderStatusPayload {
  status: AdminOrderStatus
  note?: string
}
