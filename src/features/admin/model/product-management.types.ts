export interface PaginatedResponse<T> {
  items: T[]
  page: number
  limit: number
  totalItems: number
  totalPages: number
}

export interface AdminProductItem {
  id: string
  name: string
  categoryId: string
  brandId?: string
  brand: string
  description?: string
  attributes?: Record<string, unknown>
  images: string[]
  isAvailable: boolean
  metaTitle?: string
  metaDescription?: string
  averageRating: number
  reviewCount: number
  soldCount: number
  createdAt: string
  updatedAt: string
  thumbnailUrl: string | null
  priceFrom: number | null
  priceTo: number | null
  hasDiscount: boolean
}

export type AdminProductListResponse = PaginatedResponse<AdminProductItem>

export interface AdminProductVariantItem {
  id: string
  productId: string
  sku: string
  colorId?: string
  sizeId?: string
  color?: string
  colorHex?: string
  size: string
  price: number
  originalPrice?: number
  stockQuantity: number
  isAvailable: boolean
  images: string[]
  createdAt: string
  updatedAt: string
}

export type AdminProductVariantListResponse = PaginatedResponse<AdminProductVariantItem>

export interface AdminCategoryOption {
  id: string
  name: string
  slug: string
  isActive?: boolean
}

export interface AdminBrandOption {
  id: string
  name: string
  slug: string
  isActive?: boolean
}

export interface AdminColorOption {
  id: string
  name: string
  slug: string
  hexCode?: string
  isActive?: boolean
}

export interface AdminSizeOption {
  id: string
  name: string
  slug: string
  isActive?: boolean
}

export interface ListAdminProductsParams {
  page?: number
  limit?: number
  categoryId?: string
  brandId?: string
  brand?: string
  search?: string
  isAvailable?: boolean
}

export interface CreateAdminProductPayload {
  name: string
  categoryId: string
  brandId?: string
  brand?: string
  description?: string
  attributes?: Record<string, unknown>
  images?: string[]
  isAvailable?: boolean
  metaTitle?: string
  metaDescription?: string
}

export type UpdateAdminProductPayload = Partial<CreateAdminProductPayload>

export interface ListAdminProductVariantsParams {
  page?: number
  limit?: number
}

export interface UpsertAdminProductVariantPayload {
  sku: string
  colorId?: string | null
  sizeId?: string | null
  size?: string
  price: number
  originalPrice?: number
  stockQuantity?: number
  isAvailable?: boolean
  images?: string[]
}