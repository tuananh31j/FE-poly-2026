import { httpClient } from '@/shared/api/httpClient'
import { extractApiData, toApiClientError } from '@/shared/api/response'
import type { ApiSuccess } from '@/shared/types/api.types'

import type {
  AdminCommentItem,
  AdminCommentsResponse,
  AdminCommentTargetProfile,
  AdminCommentUserProfile,
  CommentTargetModel,
  ListAdminCommentsParams,
  UpdateCommentVisibilityPayload,
} from '../model/comment-management.types'

const toId = (value: unknown) => {
  return typeof value === 'string' ? value : String(value ?? '')
}

const toRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined
  }

  return value as Record<string, unknown>
}

const normalizeTargetModel = (_value: unknown): CommentTargetModel => 'product'

const normalizeUserProfile = (value: unknown): AdminCommentUserProfile | undefined => {
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

const normalizeTargetProfile = (value: unknown, fallbackModel: CommentTargetModel): AdminCommentTargetProfile | undefined => {
  const data = toRecord(value)

  if (!data) {
    return undefined
  }

  return {
    id: toId(data.id ?? data._id),
    targetModel: normalizeTargetModel(data.targetModel ?? fallbackModel),
    name: typeof data.name === 'string' ? data.name : undefined,
    slug: typeof data.slug === 'string' ? data.slug : undefined,
    thumbnailUrl: typeof data.thumbnailUrl === 'string' ? data.thumbnailUrl : undefined,
  }
}

const normalizeCommentItem = (value: Record<string, unknown>): AdminCommentItem => {
  const targetModel = normalizeTargetModel(value.targetModel)

  return {
    id: toId(value.id ?? value._id),
    targetId: toId(value.targetId),
    targetModel,
    userId: toId(value.userId),
    content: String(value.content ?? ''),
    parentId: value.parentId ? toId(value.parentId) : undefined,
    isHidden: Boolean(value.isHidden),
    createdAt: String(value.createdAt ?? ''),
    user: normalizeUserProfile(value.user),
    target: normalizeTargetProfile(value.target, targetModel),
  }
}

const normalizeCommentsResponse = (value: Record<string, unknown>): AdminCommentsResponse => {
  const rawItems = Array.isArray(value.items) ? value.items : []

  return {
    items: rawItems
      .map((item) => toRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item) => normalizeCommentItem(item)),
    page: Number(value.page ?? 1),
    limit: Number(value.limit ?? 20),
    totalItems: Number(value.totalItems ?? 0),
    totalPages: Number(value.totalPages ?? 1),
  }
}

export const listAdminComments = async (
  params: ListAdminCommentsParams = {}
): Promise<AdminCommentsResponse> => {
  try {
    const response = await httpClient.get<ApiSuccess<Record<string, unknown>>>('/comments/admin/all', {
      params,
    })

    return normalizeCommentsResponse(extractApiData(response))
  } catch (error) {
    throw toApiClientError(error)
  }
}

export const updateAdminCommentVisibility = async (
  commentId: string,
  payload: UpdateCommentVisibilityPayload
): Promise<AdminCommentItem> => {
  try {
    const response = await httpClient.patch<ApiSuccess<Record<string, unknown>>>(
      `/comments/${commentId}/visibility`,
      payload
    )

    return normalizeCommentItem(extractApiData(response))
  } catch (error) {
    throw toApiClientError(error)
  }
}

export const deleteAdminComment = async (commentId: string) => {
  try {
    await httpClient.delete<ApiSuccess<Record<string, unknown>>>(`/comments/${commentId}`)
  } catch (error) {
    throw toApiClientError(error)
  }
}
