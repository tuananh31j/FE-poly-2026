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
  slug: string
  description?: string
  parentId?: string
  image?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface MasterBrandItem {
  id: string
  name: string
  slug: string
  description?: string
  logoUrl?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface MasterColorItem {
  id: string
  name: string
  slug: string
  hexCode?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface MasterSizeItem {
  id: string
  name: string
  slug: string
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
  slug: string
  description?: string
  parentId?: string
  image?: string
  isActive?: boolean
}

export interface UpsertBrandPayload {
  name: string
  slug: string
  description?: string
  logoUrl?: string
  isActive?: boolean
}

export interface UpsertColorPayload {
  name: string
  slug: string
  hexCode?: string
  isActive?: boolean
}

export interface UpsertSizePayload {
  name: string
  slug: string
  isActive?: boolean
}
