export interface PaginatedResponse<T> {
  items: T[]
  page: number
  limit: number
  totalItems: number
  totalPages: number
}

export type VoucherDiscountType = 'percentage' | 'fixed_amount'

export interface AdminVoucherItem {
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
  createdAt: string
  updatedAt: string
}

export type AdminVoucherListResponse = PaginatedResponse<AdminVoucherItem>

export interface ListAdminVouchersParams {
  page?: number
  limit?: number
  code?: string
  isActive?: boolean
}

export interface CreateAdminVoucherPayload {
  code: string
  description?: string
  discountType: VoucherDiscountType
  discountValue: number
  minOrderValue?: number
  maxDiscountAmount?: number
  startDate: string
  expirationDate: string
  usageLimit: number
  isActive?: boolean
}

export interface UpdateAdminVoucherPayload {
  description?: string
  discountType?: VoucherDiscountType
  discountValue?: number
  minOrderValue?: number
  maxDiscountAmount?: number
  startDate?: string
  expirationDate?: string
  usageLimit?: number
  isActive?: boolean
}

