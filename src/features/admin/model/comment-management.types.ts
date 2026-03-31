export type CommentTargetModel = 'product'

export interface AdminCommentUserProfile {
  id: string
  fullName?: string
  avatarUrl?: string
  email?: string
}

export interface AdminCommentTargetProfile {
  id: string
  targetModel: CommentTargetModel
  name?: string
  thumbnailUrl?: string
}

export interface AdminCommentItem {
  id: string
  targetId: string
  targetModel: CommentTargetModel
  userId: string
  content: string
  parentId?: string
  isHidden: boolean
  createdAt: string
  user?: AdminCommentUserProfile
  target?: AdminCommentTargetProfile
}

export interface PaginatedResponse<T> {
  items: T[]
  page: number
  limit: number
  totalItems: number
  totalPages: number
}

export type AdminCommentsResponse = PaginatedResponse<AdminCommentItem>

export interface ListAdminCommentsParams {
  page?: number
  limit?: number
  search?: string
  targetModel?: CommentTargetModel
  targetId?: string
  userId?: string
  isHidden?: boolean
}

export interface UpdateCommentVisibilityPayload {
  isHidden: boolean
}
