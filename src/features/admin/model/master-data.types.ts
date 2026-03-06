export interface PaginatedResponse<T> {
  items: T[]
  page: number
  limit: number
  totalItems: number
  totalPages: number
}

export interface MasterCategoryItem {
  id: string
  name: string
  description?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface MasterBrandItem {
  id: string
  name: string
  description?: string
  logoUrl?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface MasterColorItem {
  id: string
  name: string
  hexCode?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface MasterSizeItem {
  id: string
  name: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type MasterCategoryListResponse = PaginatedResponse<MasterCategoryItem>
export type MasterBrandListResponse = PaginatedResponse<MasterBrandItem>
export type MasterColorListResponse = PaginatedResponse<MasterColorItem>
export type MasterSizeListResponse = PaginatedResponse<MasterSizeItem>

export interface MasterListParams {
  page?: number
  limit?: number
  search?: string
  isActive?: boolean
}

export interface UpsertCategoryPayload {
  name: string
  description?: string
  isActive?: boolean
}

export interface UpsertBrandPayload {
  name: string
  description?: string
  logoUrl?: string
  isActive?: boolean
}

export interface UpsertColorPayload {
  name: string
  hexCode?: string
  isActive?: boolean
}

export interface UpsertSizePayload {
  name: string
  isActive?: boolean
}
