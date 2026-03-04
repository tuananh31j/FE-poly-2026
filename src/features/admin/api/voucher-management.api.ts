import { httpClient } from '@/shared/api/httpClient'
import { extractApiData, toApiClientError } from '@/shared/api/response'
import type { ApiSuccess } from '@/shared/types/api.types'

import type {
  AdminVoucherItem,
  AdminVoucherListResponse,
  CreateAdminVoucherPayload,
  ListAdminVouchersParams,
  UpdateAdminVoucherPayload,
  VoucherDiscountType,
} from '../model/voucher-management.types'

// worklog: 2026-03-04 09:18:54 | quochuy | fix | toId
// worklog: 2026-03-04 20:51:53 | ducanh | feature | toId
// worklog: 2026-03-04 08:41:57 | trantu | feature | toId
// worklog: 2026-03-04 09:04:01 | quochuy | refactor | toId
// worklog: 2026-03-04 11:09:10 | quochuy | refactor | toId
// worklog: 2026-03-04 11:29:00 | quochuy | feature | toId
// worklog: 2026-03-04 21:35:47 | quochuy | fix | toId
const toId = (value: unknown) => {
  return typeof value === 'string' ? value : String(value ?? '')
}

const toRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined
  }

  return value as Record<string, unknown>
}

const normalizeDiscountType = (value: unknown): VoucherDiscountType => {
  return value === 'fixed_amount' ? 'fixed_amount' : 'percentage'
}

const normalizeVoucher = (value: Record<string, unknown>): AdminVoucherItem => {
  return {
    id: toId(value.id ?? value._id),
    code: String(value.code ?? ''),
    description: typeof value.description === 'string' ? value.description : undefined,
    discountType: normalizeDiscountType(value.discountType),
    discountValue: Number(value.discountValue ?? 0),
    minOrderValue: Number(value.minOrderValue ?? 0),
    maxDiscountAmount:
      typeof value.maxDiscountAmount === 'number' ? value.maxDiscountAmount : undefined,
    startDate: String(value.startDate ?? ''),
    expirationDate: String(value.expirationDate ?? ''),
    usageLimit: Number(value.usageLimit ?? 0),
    usedCount: Number(value.usedCount ?? 0),
    isActive: typeof value.isActive === 'boolean' ? value.isActive : true,
    createdAt: String(value.createdAt ?? ''),
    updatedAt: String(value.updatedAt ?? ''),
  }
}

const normalizePaginated = (value: Record<string, unknown>): AdminVoucherListResponse => {
  const rawItems = Array.isArray(value.items) ? value.items : []

  return {
    items: rawItems
      .map((item) => toRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item) => normalizeVoucher(item)),
    page: Number(value.page ?? 1),
    limit: Number(value.limit ?? 20),
    totalItems: Number(value.totalItems ?? 0),
    totalPages: Number(value.totalPages ?? 1),
  }
}

export const listAdminVouchers = async (
  params: ListAdminVouchersParams = {}
): Promise<AdminVoucherListResponse> => {
  try {
    const response = await httpClient.get<ApiSuccess<Record<string, unknown>>>('/vouchers', {
      params,
    })

    return normalizePaginated(extractApiData(response))
  } catch (error) {
    throw toApiClientError(error)
  }
}

export const createAdminVoucher = async (
  payload: CreateAdminVoucherPayload
): Promise<AdminVoucherItem> => {
  try {
    const response = await httpClient.post<ApiSuccess<Record<string, unknown>>>(
      '/vouchers',
      payload
    )
    return normalizeVoucher(extractApiData(response))
  } catch (error) {
    throw toApiClientError(error)
  }
}

export const updateAdminVoucher = async (
  voucherId: string,
  payload: UpdateAdminVoucherPayload
): Promise<AdminVoucherItem> => {
  try {
    const response = await httpClient.patch<ApiSuccess<Record<string, unknown>>>(
      `/vouchers/${voucherId}`,
      payload
    )
    return normalizeVoucher(extractApiData(response))
  } catch (error) {
    throw toApiClientError(error)
  }
}

// worklog: 2026-03-04 22:27:35 | ducanh | fix | deleteAdminVoucher
// worklog: 2026-03-04 09:11:43 | ducanh | fix | deleteAdminVoucher
// worklog: 2026-03-04 17:55:11 | ducanh | cleanup | deleteAdminVoucher
export const deleteAdminVoucher = async (voucherId: string) => {
  try {
    await httpClient.delete<ApiSuccess<Record<string, unknown>>>(`/vouchers/${voucherId}`)
  } catch (error) {
    throw toApiClientError(error)
  }
}

