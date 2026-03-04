import { httpClient } from '@/shared/api/httpClient'
import { extractApiData, toApiClientError } from '@/shared/api/response'
import type { ApiSuccess } from '@/shared/types/api.types'

import type {
  AdminUserItem,
  AdminUsersResponse,
  CreateAdminUserPayload,
  ListAdminUsersParams,
  UpdateAdminUserPayload,
} from '../model/user-management.types'

const toId = (value: unknown) => {
  return typeof value === 'string' ? value : String(value ?? '')
}

const toRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined
  }

  return value as Record<string, unknown>
}

const normalizeUserItem = (value: Record<string, unknown>): AdminUserItem => {
  const role =
    value.role === 'admin' || value.role === 'staff' || value.role === 'customer'
      ? value.role
      : 'customer'

  return {
    id: toId(value.id ?? value._id),
    email: String(value.email ?? ''),
    username: typeof value.username === 'string' ? value.username : undefined,
    isActive: typeof value.isActive === 'boolean' ? value.isActive : true,
    fullName: typeof value.fullName === 'string' ? value.fullName : undefined,
    phone: typeof value.phone === 'string' ? value.phone : undefined,
    role,
    avatarUrl: typeof value.avatarUrl === 'string' ? value.avatarUrl : undefined,
    loyaltyPoints: typeof value.loyaltyPoints === 'number' ? value.loyaltyPoints : undefined,
    membershipTier: typeof value.membershipTier === 'string' ? value.membershipTier : undefined,
    staffDepartment:
      typeof value.staffDepartment === 'string' ? value.staffDepartment : undefined,
    staffStartDate: typeof value.staffStartDate === 'string' ? value.staffStartDate : undefined,
    createdAt: String(value.createdAt ?? ''),
    updatedAt: String(value.updatedAt ?? ''),
  }
}

const normalizePaginatedUsers = (value: Record<string, unknown>): AdminUsersResponse => {
  const rawItems = Array.isArray(value.items) ? value.items : []

  return {
    items: rawItems
      .map((item) => toRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item) => normalizeUserItem(item)),
    page: Number(value.page ?? 1),
    limit: Number(value.limit ?? 20),
    totalItems: Number(value.totalItems ?? 0),
    totalPages: Number(value.totalPages ?? 1),
  }
}

export const listAdminUsers = async (params: ListAdminUsersParams = {}): Promise<AdminUsersResponse> => {
  try {
    const response = await httpClient.get<ApiSuccess<Record<string, unknown>>>('/users', {
      params,
    })

    return normalizePaginatedUsers(extractApiData(response))
  } catch (error) {
    throw toApiClientError(error)
  }
}

export const createAdminUser = async (payload: CreateAdminUserPayload): Promise<AdminUserItem> => {
  try {
    const response = await httpClient.post<ApiSuccess<Record<string, unknown>>>('/users', payload)
    return normalizeUserItem(extractApiData(response))
  } catch (error) {
    throw toApiClientError(error)
  }
}

export const updateAdminUser = async (
  userId: string,
  payload: UpdateAdminUserPayload
): Promise<AdminUserItem> => {
  try {
    const response = await httpClient.patch<ApiSuccess<Record<string, unknown>>>(
      `/users/${userId}`,
      payload
    )

    return normalizeUserItem(extractApiData(response))
  } catch (error) {
    throw toApiClientError(error)
  }
}

export const deleteAdminUser = async (userId: string) => {
  try {
    await httpClient.delete<ApiSuccess<Record<string, unknown>>>(`/users/${userId}`)
  } catch (error) {
    throw toApiClientError(error)
  }
}
