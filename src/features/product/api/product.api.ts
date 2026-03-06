import type {
  CommentListItem,
  NewestResponse,
  PaginatedResponse,
  ProductCardItem,
  ProductDetailResponse,
  ProductFilterCategory,
  ProductFiltersResponse,
  ProductListResponse,
  ProductVariantItem,
  ReviewListItem,
  TopSellingResponse,
} from '@/features/product/model/product.types'
import { httpClient } from '@/shared/api/httpClient'
import { extractApiData, toApiClientError } from '@/shared/api/response'
import type { ApiSuccess } from '@/shared/types/api.types'

interface ProductListQuery {
  page?: number
  limit?: number
  categoryId?: string
  brand?: string
  search?: string
  isAvailable?: boolean
}

interface CreateCommentPayload {
  targetId: string
  content: string
  parentId?: string
}

const toId = (value: unknown) => {
  return typeof value === 'string' ? value : String(value ?? '')
}

const toStringArray = (value: unknown) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string')
}

const normalizeProductCardItem = (item: Record<string, unknown>): ProductCardItem => {
  return {
    ...item,
    id: toId(item.id ?? item._id),
    _id: typeof item._id === 'string' ? item._id : undefined,
    name: String(item.name ?? ''),
    slug: String(item.slug ?? ''),
    categoryId: toId(item.categoryId),
    brand: typeof item.brand === 'string' ? item.brand : 'Generic',
    description: typeof item.description === 'string' ? item.description : undefined,
    images: toStringArray(item.images),
    isAvailable: Boolean(item.isAvailable),
    averageRating: Number(item.averageRating ?? 0),
    reviewCount: Number(item.reviewCount ?? 0),
    soldCount: Number(item.soldCount ?? 0),
    createdAt: String(item.createdAt ?? ''),
    updatedAt: String(item.updatedAt ?? ''),
    thumbnailUrl: typeof item.thumbnailUrl === 'string' ? item.thumbnailUrl : null,
    priceFrom: typeof item.priceFrom === 'number' ? item.priceFrom : null,
    priceTo: typeof item.priceTo === 'number' ? item.priceTo : null,
    hasDiscount: Boolean(item.hasDiscount),
  }
}

const normalizeVariant = (variant: Record<string, unknown>): ProductVariantItem => {
  return {
    ...variant,
    id: toId(variant.id ?? variant._id),
    _id: typeof variant._id === 'string' ? variant._id : undefined,
    productId: toId(variant.productId),
    sku: String(variant.sku ?? ''),
    color: String(variant.color ?? ''),
    size: typeof variant.size === 'string' ? variant.size : 'Standard',
    colorHex: typeof variant.colorHex === 'string' ? variant.colorHex : undefined,
    price: Number(variant.price ?? 0),
    originalPrice: typeof variant.originalPrice === 'number' ? variant.originalPrice : undefined,
    stockQuantity: Number(variant.stockQuantity ?? 0),
    isAvailable: Boolean(variant.isAvailable),
    images: toStringArray(variant.images),
    createdAt: String(variant.createdAt ?? ''),
    updatedAt: String(variant.updatedAt ?? ''),
  }
}

const normalizePublicUser = (user: unknown) => {
  if (!user || typeof user !== 'object') {
    return undefined
  }

  const record = user as Record<string, unknown>

  return {
    id: toId(record.id ?? record._id),
    fullName: typeof record.fullName === 'string' ? record.fullName : undefined,
    avatarUrl: typeof record.avatarUrl === 'string' ? record.avatarUrl : undefined,
    email: typeof record.email === 'string' ? record.email : undefined,
  }
}

const normalizeReviewItem = (item: Record<string, unknown>): ReviewListItem => {
  return {
    ...item,
    id: toId(item.id ?? item._id),
    _id: typeof item._id === 'string' ? item._id : undefined,
    productId: toId(item.productId),
    userId: toId(item.userId),
    orderId: toId(item.orderId),
    rating: Number(item.rating ?? 0),
    content: typeof item.content === 'string' ? item.content : undefined,
    images: toStringArray(item.images),
    isPublished: Boolean(item.isPublished),
    replyContent: typeof item.replyContent === 'string' ? item.replyContent : undefined,
    repliedAt: typeof item.repliedAt === 'string' ? item.repliedAt : undefined,
    repliedBy: item.repliedBy ? toId(item.repliedBy) : undefined,
    createdAt: String(item.createdAt ?? ''),
    updatedAt: String(item.updatedAt ?? ''),
    user: normalizePublicUser(item.user),
  }
}

const normalizeCommentItem = (item: Record<string, unknown>): CommentListItem => {
  return {
    ...item,
    id: toId(item.id ?? item._id),
    _id: typeof item._id === 'string' ? item._id : undefined,
    targetId: toId(item.targetId),
    targetModel: 'product',
    userId: toId(item.userId),
    content: String(item.content ?? ''),
    parentId: item.parentId ? toId(item.parentId) : undefined,
    isHidden: Boolean(item.isHidden),
    createdAt: String(item.createdAt ?? ''),
    user: normalizePublicUser(item.user),
  }
}

const normalizePaginated = <T>(
  data: Record<string, unknown>,
  normalizer: (item: Record<string, unknown>) => T
): PaginatedResponse<T> => {
  const rawItems = Array.isArray(data.items) ? data.items : []

  return {
    items: rawItems
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      .map((item) => normalizer(item)),
    page: Number(data.page ?? 1),
    limit: Number(data.limit ?? 20),
    totalItems: Number(data.totalItems ?? 0),
    totalPages: Number(data.totalPages ?? 1),
  }
}

const normalizeFilterCategory = (item: Record<string, unknown>): ProductFilterCategory => {
  return {
    id: toId(item.id ?? item._id),
    name: String(item.name ?? 'Danh mục'),
  }
}

export const getProductFilters = async (): Promise<ProductFiltersResponse> => {
  try {
    const response = await httpClient.get<ApiSuccess<Record<string, unknown>>>('/products/filters')
    const data = extractApiData(response)
    const rawCategories = Array.isArray(data.categories) ? data.categories : []
    const rawBrands = Array.isArray(data.brands) ? data.brands : []

    return {
      categories: rawCategories
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
        .map((item) => normalizeFilterCategory(item)),
      brands: rawBrands
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean),
    }
  } catch (error) {
    throw toApiClientError(error)
  }
}

export const getTopSellingProducts = async (limit = 10): Promise<TopSellingResponse> => {
  try {
    const response = await httpClient.get<ApiSuccess<Record<string, unknown>[]>>(
      '/products/top-selling',
      {
        params: { limit },
      }
    )

    const data = extractApiData(response)

    return data
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      .map((item) => normalizeProductCardItem(item))
  } catch (error) {
    throw toApiClientError(error)
  }
}

export const getNewestProducts = async (limit = 10): Promise<NewestResponse> => {
  try {
    const response = await httpClient.get<ApiSuccess<Record<string, unknown>[]>>(
      '/products/newest',
      {
        params: { limit },
      }
    )

    const data = extractApiData(response)

    return data
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      .map((item) => normalizeProductCardItem(item))
  } catch (error) {
    throw toApiClientError(error)
  }
}

export const getProducts = async (params: ProductListQuery = {}): Promise<ProductListResponse> => {
  try {
    const response = await httpClient.get<ApiSuccess<Record<string, unknown>>>('/products', {
      params,
    })

    return normalizePaginated(extractApiData(response), normalizeProductCardItem)
  } catch (error) {
    throw toApiClientError(error)
  }
}

export const getProductDetail = async (productId: string): Promise<ProductDetailResponse> => {
  try {
    const response = await httpClient.get<ApiSuccess<Record<string, unknown>>>(
      `/products/${productId}`
    )
    const data = extractApiData(response)

    const variants = Array.isArray(data.variants)
      ? data.variants
          .filter(
            (item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object'
          )
          .map((item) => normalizeVariant(item))
      : []

    return {
      ...data,
      id: toId(data.id ?? data._id),
      _id: typeof data._id === 'string' ? data._id : undefined,
      name: String(data.name ?? ''),
      slug: String(data.slug ?? ''),
      categoryId: toId(data.categoryId),
      brand: typeof data.brand === 'string' ? data.brand : 'Generic',
      description: typeof data.description === 'string' ? data.description : undefined,
      attributes:
        data.attributes && typeof data.attributes === 'object'
          ? (data.attributes as Record<string, unknown>)
          : undefined,
      images: toStringArray(data.images),
      isAvailable: Boolean(data.isAvailable),
      averageRating: Number(data.averageRating ?? 0),
      reviewCount: Number(data.reviewCount ?? 0),
      soldCount: Number(data.soldCount ?? 0),
      createdAt: String(data.createdAt ?? ''),
      updatedAt: String(data.updatedAt ?? ''),
      variants,
    }
  } catch (error) {
    throw toApiClientError(error)
  }
}

export const getProductReviews = async (productId: string, page = 1, limit = 5) => {
  try {
    const response = await httpClient.get<ApiSuccess<Record<string, unknown>>>(
      `/reviews/product/${productId}`,
      {
        params: { page, limit },
      }
    )

    return normalizePaginated(extractApiData(response), normalizeReviewItem)
  } catch (error) {
    throw toApiClientError(error)
  }
}

export const getProductComments = async (productId: string, page = 1, limit = 10) => {
  try {
    const response = await httpClient.get<ApiSuccess<Record<string, unknown>>>('/comments', {
      params: {
        targetId: productId,
        targetModel: 'product',
        page,
        limit,
      },
    })

    return normalizePaginated(extractApiData(response), normalizeCommentItem)
  } catch (error) {
    throw toApiClientError(error)
  }
}

export const createProductComment = async (payload: CreateCommentPayload) => {
  try {
    const response = await httpClient.post<ApiSuccess<Record<string, unknown>>>('/comments', {
      targetId: payload.targetId,
      targetModel: 'product',
      content: payload.content,
      parentId: payload.parentId,
    })

    return normalizeCommentItem(extractApiData(response))
  } catch (error) {
    throw toApiClientError(error)
  }
}
