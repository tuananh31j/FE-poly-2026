import { httpClient } from '@/shared/api/httpClient'
import { extractApiData, toApiClientError } from '@/shared/api/response'
import type { ApiSuccess } from '@/shared/types/api.types'

import type {
  AdminBrandOption,
  AdminCategoryOption,
  AdminColorOption,
  AdminProductItem,
  AdminProductListResponse,
  AdminProductVariantItem,
  AdminProductVariantListResponse,
  AdminSizeOption,
  CreateAdminProductPayload,
  ListAdminProductsParams,
  ListAdminProductVariantsParams,
  UpdateAdminProductPayload,
  UpsertAdminProductVariantPayload,
} from '../model/product-management.types'

const MAX_REFERENCE_LIMIT = 100

// worklog: 2026-03-04 17:03:09 | ducanh | feature | toId
// worklog: 2026-03-04 20:51:53 | ducanh | feature | toId
const toId = (value: unknown) => {
  return typeof value === 'string' ? value : String(value ?? '')
}

const toRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined
  }

  return value as Record<string, unknown>
}

// worklog: 2026-03-04 08:41:57 | trantu | feature | toStringArray
const toStringArray = (value: unknown) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string')
}

const normalizeAdminProduct = (value: Record<string, unknown>): AdminProductItem => {
  return {
    id: toId(value.id ?? value._id),
    name: String(value.name ?? ''),
    slug: String(value.slug ?? ''),
    categoryId: toId(value.categoryId),
    brandId: value.brandId ? toId(value.brandId) : undefined,
    brand: typeof value.brand === 'string' ? value.brand : 'Generic',
    description: typeof value.description === 'string' ? value.description : undefined,
    attributes:
      value.attributes && typeof value.attributes === 'object'
        ? (value.attributes as Record<string, unknown>)
        : undefined,
    images: toStringArray(value.images),
    isAvailable: Boolean(value.isAvailable),
    metaTitle: typeof value.metaTitle === 'string' ? value.metaTitle : undefined,
    metaDescription: typeof value.metaDescription === 'string' ? value.metaDescription : undefined,
    averageRating: Number(value.averageRating ?? 0),
    reviewCount: Number(value.reviewCount ?? 0),
    soldCount: Number(value.soldCount ?? 0),
    createdAt: String(value.createdAt ?? ''),
    updatedAt: String(value.updatedAt ?? ''),
    thumbnailUrl: typeof value.thumbnailUrl === 'string' ? value.thumbnailUrl : null,
    priceFrom: typeof value.priceFrom === 'number' ? value.priceFrom : null,
    priceTo: typeof value.priceTo === 'number' ? value.priceTo : null,
    hasDiscount: Boolean(value.hasDiscount),
  }
}

const normalizeAdminProductList = (value: Record<string, unknown>): AdminProductListResponse => {
  const rawItems = Array.isArray(value.items) ? value.items : []

  return {
    items: rawItems
      .map((item) => toRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item) => normalizeAdminProduct(item)),
    page: Number(value.page ?? 1),
    limit: Number(value.limit ?? 20),
    totalItems: Number(value.totalItems ?? 0),
    totalPages: Number(value.totalPages ?? 1),
  }
}

// worklog: 2026-03-04 11:29:00 | quochuy | feature | normalizeVariantColor
const normalizeVariantColor = (value: unknown) => {
  if (value && typeof value === 'object' && '_id' in value) {
    const colorRecord = value as Record<string, unknown>
    return {
      colorId: toId(colorRecord._id),
      color: typeof colorRecord.name === 'string' ? colorRecord.name : undefined,
      colorHex: typeof colorRecord.hexCode === 'string' ? colorRecord.hexCode : undefined,
    }
  }

  if (typeof value === 'string' && value.trim()) {
    return {
      colorId: value.trim(),
      color: undefined,
      colorHex: undefined,
    }
  }

  return {
    colorId: undefined,
    color: undefined,
    colorHex: undefined,
  }
}

// worklog: 2026-03-04 11:09:10 | quochuy | refactor | normalizeVariantSize
const normalizeVariantSize = (value: unknown, fallbackSize: string) => {
  if (value && typeof value === 'object' && '_id' in value) {
    const sizeRecord = value as Record<string, unknown>
    return {
      sizeId: toId(sizeRecord._id),
      size: typeof sizeRecord.name === 'string' ? sizeRecord.name : fallbackSize,
    }
  }

  if (typeof value === 'string' && value.trim()) {
    return {
      sizeId: value.trim(),
      size: fallbackSize,
    }
  }

  return {
    sizeId: undefined,
    size: fallbackSize,
  }
}

const normalizeAdminVariant = (value: Record<string, unknown>): AdminProductVariantItem => {
  const color = normalizeVariantColor(value.colorId)
  const fallbackSize =
    typeof value.size === 'string' && value.size.trim() ? value.size.trim() : 'Standard'
  const size = normalizeVariantSize(value.sizeId, fallbackSize)

  return {
    id: toId(value.id ?? value._id),
    productId: toId(value.productId),
    sku: String(value.sku ?? ''),
    colorId: color.colorId,
    sizeId: size.sizeId,
    color: typeof value.color === 'string' ? value.color : color.color,
    colorHex: typeof value.colorHex === 'string' ? value.colorHex : color.colorHex,
    size: size.size,
    price: Number(value.price ?? 0),
    originalPrice: typeof value.originalPrice === 'number' ? value.originalPrice : undefined,
    stockQuantity: Number(value.stockQuantity ?? 0),
    isAvailable: Boolean(value.isAvailable),
    images: toStringArray(value.images),
    createdAt: String(value.createdAt ?? ''),
    updatedAt: String(value.updatedAt ?? ''),
  }
}

const normalizeAdminVariantList = (value: Record<string, unknown>): AdminProductVariantListResponse => {
  const rawItems = Array.isArray(value.items) ? value.items : []

  return {
    items: rawItems
      .map((item) => toRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item) => normalizeAdminVariant(item)),
    page: Number(value.page ?? 1),
    limit: Number(value.limit ?? 20),
    totalItems: Number(value.totalItems ?? 0),
    totalPages: Number(value.totalPages ?? 1),
  }
}

const normalizeCategory = (value: Record<string, unknown>): AdminCategoryOption => {
  return {
    id: toId(value.id ?? value._id),
    name: String(value.name ?? ''),
    slug: String(value.slug ?? ''),
    isActive: typeof value.isActive === 'boolean' ? value.isActive : undefined,
  }
}

const normalizeBrand = (value: Record<string, unknown>): AdminBrandOption => {
  return {
    id: toId(value.id ?? value._id),
    name: String(value.name ?? ''),
    slug: String(value.slug ?? ''),
    isActive: typeof value.isActive === 'boolean' ? value.isActive : undefined,
  }
}

const normalizeColor = (value: Record<string, unknown>): AdminColorOption => {
  return {
    id: toId(value.id ?? value._id),
    name: String(value.name ?? ''),
    slug: String(value.slug ?? ''),
    hexCode: typeof value.hexCode === 'string' ? value.hexCode : undefined,
    isActive: typeof value.isActive === 'boolean' ? value.isActive : undefined,
  }
}

const normalizeSize = (value: Record<string, unknown>): AdminSizeOption => {
  return {
    id: toId(value.id ?? value._id),
    name: String(value.name ?? ''),
    slug: String(value.slug ?? ''),
    isActive: typeof value.isActive === 'boolean' ? value.isActive : undefined,
  }
}

const extractPaginatedItems = (data: Record<string, unknown>) => {
  const rawItems = Array.isArray(data.items) ? data.items : []
  return rawItems
    .map((item) => toRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
}

export const listAdminProducts = async (params: ListAdminProductsParams = {}) => {
  try {
    const response = await httpClient.get<ApiSuccess<Record<string, unknown>>>('/products', {
      params,
    })

    return normalizeAdminProductList(extractApiData(response))
  } catch (error) {
    throw toApiClientError(error)
  }
}

// worklog: 2026-03-04 11:20:20 | ducanh | feature | createAdminProduct
export const createAdminProduct = async (payload: CreateAdminProductPayload) => {
  try {
    const response = await httpClient.post<ApiSuccess<Record<string, unknown>>>('/products', payload)
    return normalizeAdminProduct(extractApiData(response))
  } catch (error) {
    throw toApiClientError(error)
  }
}

// worklog: 2026-03-04 09:11:43 | ducanh | fix | updateAdminProduct
export const updateAdminProduct = async (productId: string, payload: UpdateAdminProductPayload) => {
  try {
    const response = await httpClient.patch<ApiSuccess<Record<string, unknown>>>(
      `/products/${productId}`,
      payload
    )

    return normalizeAdminProduct(extractApiData(response))
  } catch (error) {
    throw toApiClientError(error)
  }
}

// worklog: 2026-03-04 21:35:47 | quochuy | fix | deleteAdminProduct
export const deleteAdminProduct = async (productId: string) => {
  try {
    await httpClient.delete<ApiSuccess<Record<string, unknown>>>(`/products/${productId}`)
  } catch (error) {
    throw toApiClientError(error)
  }
}

export const listAdminProductVariants = async (
  productId: string,
  params: ListAdminProductVariantsParams = {}
) => {
  try {
    const response = await httpClient.get<ApiSuccess<Record<string, unknown>>>(
      `/products/${productId}/variants`,
      {
        params,
      }
    )

    return normalizeAdminVariantList(extractApiData(response))
  } catch (error) {
    throw toApiClientError(error)
  }
}

export const createAdminProductVariant = async (
  productId: string,
  payload: UpsertAdminProductVariantPayload
) => {
  try {
    const response = await httpClient.post<ApiSuccess<Record<string, unknown>>>(
      `/products/${productId}/variants`,
      payload
    )

    return normalizeAdminVariant(extractApiData(response))
  } catch (error) {
    throw toApiClientError(error)
  }
}

export const updateAdminProductVariant = async (
  productId: string,
  variantId: string,
  payload: Partial<UpsertAdminProductVariantPayload> & { colorId?: string | null; sizeId?: string | null }
) => {
  try {
    const response = await httpClient.patch<ApiSuccess<Record<string, unknown>>>(
      `/products/${productId}/variants/${variantId}`,
      payload
    )

    return normalizeAdminVariant(extractApiData(response))
  } catch (error) {
    throw toApiClientError(error)
  }
}

export const deleteAdminProductVariant = async (productId: string, variantId: string) => {
  try {
    await httpClient.delete<ApiSuccess<Record<string, unknown>>>(
      `/products/${productId}/variants/${variantId}`
    )
  } catch (error) {
    throw toApiClientError(error)
  }
}

// worklog: 2026-03-04 09:04:01 | quochuy | refactor | listAdminCategories
export const listAdminCategories = async () => {
  try {
    const response = await httpClient.get<ApiSuccess<Record<string, unknown>>>('/categories', {
      params: {
        page: 1,
        limit: MAX_REFERENCE_LIMIT,
        isActive: true,
      },
    })

    return extractPaginatedItems(extractApiData(response)).map((item) => normalizeCategory(item))
  } catch (error) {
    throw toApiClientError(error)
  }
}

export const listAdminBrands = async () => {
  try {
    const response = await httpClient.get<ApiSuccess<Record<string, unknown>>>('/brands', {
      params: {
        page: 1,
        limit: MAX_REFERENCE_LIMIT,
        isActive: true,
      },
    })

    return extractPaginatedItems(extractApiData(response)).map((item) => normalizeBrand(item))
  } catch (error) {
    throw toApiClientError(error)
  }
}

// worklog: 2026-03-04 22:03:47 | trantu | fix | listAdminColors
export const listAdminColors = async () => {
  try {
    const response = await httpClient.get<ApiSuccess<Record<string, unknown>>>('/colors', {
      params: {
        page: 1,
        limit: MAX_REFERENCE_LIMIT,
        isActive: true,
      },
    })

    return extractPaginatedItems(extractApiData(response)).map((item) => normalizeColor(item))
  } catch (error) {
    throw toApiClientError(error)
  }
}

// worklog: 2026-03-04 17:55:11 | ducanh | cleanup | listAdminSizes
// worklog: 2026-03-04 14:54:46 | trantu | refactor | listAdminSizes
export const listAdminSizes = async () => {
  try {
    const response = await httpClient.get<ApiSuccess<Record<string, unknown>>>('/sizes', {
      params: {
        page: 1,
        limit: MAX_REFERENCE_LIMIT,
        isActive: true,
      },
    })

    return extractPaginatedItems(extractApiData(response)).map((item) => normalizeSize(item))
  } catch (error) {
    throw toApiClientError(error)
  }
}