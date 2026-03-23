import { httpClient } from '@/shared/api/httpClient'
import { extractApiData, toApiClientError } from '@/shared/api/response'
import type { ApiSuccess } from '@/shared/types/api.types'

import type {
  AdminReviewItem,
  AdminReviewProductProfile,
  AdminReviewsResponse,
  AdminReviewUserProfile,
  ListAdminReviewsParams,
  ModerateAdminReviewPayload,
  ReplyAdminReviewPayload,
} from '../model/review-management.types'

const toId = (value: unknown) => {
  return typeof value === 'string' ? value : String(value ?? '')
}

const toRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined
  }

  return value as Record<string, unknown>
}

const toStringArray = (value: unknown) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string')
}

const normalizeUserProfile = (value: unknown): AdminReviewUserProfile | undefined => {
  const data = toRecord(value)

  if (!data) {
    return undefined
  }

  return {
    id: toId(data.id ?? data._id),
    fullName: typeof data.fullName === 'string' ? data.fullName : undefined,
    avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : undefined,
    email: typeof data.email === 'string' ? data.email : undefined,
  }
}

const normalizeProductProfile = (value: unknown): AdminReviewProductProfile | undefined => {
  const data = toRecord(value)

  if (!data) {
    return undefined
  }

  return {
    id: toId(data.id ?? data._id),
    name: typeof data.name === 'string' ? data.name : undefined,
    thumbnailUrl: typeof data.thumbnailUrl === 'string' ? data.thumbnailUrl : undefined,
  }
}

const normalizeReviewItem = (value: Record<string, unknown>): AdminReviewItem => {
  return {
    id: toId(value.id ?? value._id),
    productId: toId(value.productId),
    userId: toId(value.userId),
    orderId: toId(value.orderId),
    rating: Number(value.rating ?? 0),
    content: typeof value.content === 'string' ? value.content : undefined,
    images: toStringArray(value.images),
    isPublished: Boolean(value.isPublished),
    replyContent: typeof value.replyContent === 'string' ? value.replyContent : undefined,
    repliedAt: typeof value.repliedAt === 'string' ? value.repliedAt : undefined,
    repliedBy: value.repliedBy ? toId(value.repliedBy) : undefined,
    createdAt: String(value.createdAt ?? ''),
    updatedAt: String(value.updatedAt ?? ''),
    user: normalizeUserProfile(value.user),
    product: normalizeProductProfile(value.product),
    repliedByUser: normalizeUserProfile(value.repliedByUser),
  }
}

const normalizeReviewsResponse = (value: Record<string, unknown>): AdminReviewsResponse => {
  const rawItems = Array.isArray(value.items) ? value.items : []

  return {
    items: rawItems
      .map((item) => toRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item) => normalizeReviewItem(item)),
    page: Number(value.page ?? 1),
    limit: Number(value.limit ?? 20),
    totalItems: Number(value.totalItems ?? 0),
    totalPages: Number(value.totalPages ?? 1),
  }
}

export const listAdminReviews = async (
  params: ListAdminReviewsParams = {}
): Promise<AdminReviewsResponse> => {
  try {
    const response = await httpClient.get<ApiSuccess<Record<string, unknown>>>('/reviews/admin/all', {
      params,
    })

    return normalizeReviewsResponse(extractApiData(response))
  } catch (error) {
    throw toApiClientError(error)
  }
}

export const moderateAdminReview = async (
  reviewId: string,
  payload: ModerateAdminReviewPayload
): Promise<AdminReviewItem> => {
  try {
    const response = await httpClient.patch<ApiSuccess<Record<string, unknown>>>(
      `/reviews/${reviewId}/moderate`,
      payload
    )

    return normalizeReviewItem(extractApiData(response))
  } catch (error) {
    throw toApiClientError(error)
  }
}

export const replyAdminReview = async (
  reviewId: string,
  payload: ReplyAdminReviewPayload
): Promise<AdminReviewItem> => {
  try {
    const response = await httpClient.patch<ApiSuccess<Record<string, unknown>>>(
      `/reviews/${reviewId}/reply`,
      payload
    )

    return normalizeReviewItem(extractApiData(response))
  } catch (error) {
    throw toApiClientError(error)
  }
}

export const deleteAdminReview = async (reviewId: string) => {
  try {
    await httpClient.delete<ApiSuccess<Record<string, unknown>>>(`/reviews/${reviewId}/admin`)
  } catch (error) {
    throw toApiClientError(error)
  }
}
