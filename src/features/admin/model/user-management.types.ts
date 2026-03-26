import type { AuthRole } from '@/shared/constants/routes'

export interface AdminUserItem {
  id: string
  email: string
  isActive: boolean
  fullName?: string
  phone?: string
  role: AuthRole
  avatarUrl?: string
  staffStartDate?: string
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

export type AdminUsersResponse = PaginatedResponse<AdminUserItem>

export interface ListAdminUsersParams {
  page?: number
  limit?: number
  role?: AuthRole
  search?: string
  isActive?: boolean
}

export interface CreateAdminUserPayload {
  email: string
  password: string
  fullName?: string
  phone?: string
  role?: Extract<AuthRole, 'customer' | 'staff'>
}

export interface UpdateAdminUserPayload {
  fullName?: string
  phone?: string
  role?: Extract<AuthRole, 'customer' | 'staff'>
  isActive?: boolean
  avatarUrl?: string
  staffStartDate?: string
  password?: string
}
