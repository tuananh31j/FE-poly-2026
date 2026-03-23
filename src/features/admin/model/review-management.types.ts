export type AdminReviewStatus = 'published' | 'hidden'

export interface AdminReviewUserProfile {
  id: string
  fullName?: string
  avatarUrl?: string
  email?: string
}

export interface AdminReviewProductProfile {
  id: string
  name?: string
  thumbnailUrl?: string
}

export interface AdminReviewItem {
  id: string
  productId: string
  userId: string
  orderId: string
  rating: number
  content?: string
  images: string[]
  isPublished: boolean
  replyContent?: string
  repliedAt?: string
  repliedBy?: string
  createdAt: string
  updatedAt: string
  user?: AdminReviewUserProfile
  product?: AdminReviewProductProfile
  repliedByUser?: AdminReviewUserProfile
}

export interface PaginatedResponse<T> {
  items: T[]
  page: number
  limit: number
  totalItems: number
  totalPages: number
}

export type AdminReviewsResponse = PaginatedResponse<AdminReviewItem>

export interface ListAdminReviewsParams {
  page?: number
  limit?: number
  search?: string
  productId?: string
  userId?: string
  rating?: number
  isPublished?: boolean
}

export interface ModerateAdminReviewPayload {
  isPublished: boolean
}

export interface ReplyAdminReviewPayload {
  replyContent: string
}