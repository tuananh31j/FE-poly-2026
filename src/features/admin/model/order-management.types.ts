export type AdminOrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'shipping'
  | 'delivered'
  | 'cancelled'
  | 'returned'

export type AdminPaymentMethod = 'cod' | 'banking' | 'momo' | 'vnpay'
export type AdminPaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'

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
  shippingRecipientName: string
  shippingPhone: string
  shippingAddress: string
  subtotal: number
  shippingFee: number
  discountAmount: number
  totalAmount: number
  paymentMethod: AdminPaymentMethod
  paymentStatus: AdminPaymentStatus
  voucherId?: string
  status: AdminOrderStatus
  items: AdminOrderItemSnapshot[]
  statusHistory: AdminOrderStatusHistoryItem[]
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