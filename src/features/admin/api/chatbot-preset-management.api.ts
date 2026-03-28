import { httpClient } from '@/shared/api/httpClient'
import { extractApiData, toApiClientError } from '@/shared/api/response'
import type { ApiSuccess } from '@/shared/types/api.types'

import type {
  AdminChatbotPresetItem,
  AdminChatbotPresetProduct,
  UpsertAdminChatbotPresetPayload,
} from '../model/chatbot-preset-management.types'

const toId = (value: unknown) => {
  return typeof value === 'string' ? value : String(value ?? '')
}

const toRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined
  }

  return value as Record<string, unknown>
}

const normalizeProduct = (value: Record<string, unknown>): AdminChatbotPresetProduct => {
  return {
    id: toId(value.id ?? value._id),
    name: String(value.name ?? ''),
    brand: typeof value.brand === 'string' ? value.brand : 'Generic',
    imageUrl: typeof value.imageUrl === 'string' ? value.imageUrl : null,
    isAvailable: value.isAvailable !== false,
  }
}

const normalizePreset = (value: Record<string, unknown>): AdminChatbotPresetItem => {
  const rawProducts = Array.isArray(value.products) ? value.products : []

  return {
    id: toId(value.id ?? value._id),
    question: String(value.question ?? ''),
    answer: typeof value.answer === 'string' ? value.answer : undefined,
    isActive: value.isActive !== false,
    sortOrder: Number(value.sortOrder ?? 0),
    createdAt: String(value.createdAt ?? ''),
    updatedAt: String(value.updatedAt ?? ''),
    products: rawProducts
      .map((item) => toRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item) => normalizeProduct(item)),
  }
}

export const listAdminChatbotPresets = async () => {
  try {
    const response = await httpClient.get<ApiSuccess<Record<string, unknown>[]>>('/chatbot/admin/presets')
    const data = extractApiData(response)

    return (Array.isArray(data) ? data : [])
      .map((item) => toRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item) => normalizePreset(item))
  } catch (error) {
    throw toApiClientError(error)
  }
}

export const createAdminChatbotPreset = async (payload: UpsertAdminChatbotPresetPayload) => {
  try {
    const response = await httpClient.post<ApiSuccess<Record<string, unknown>>>(
      '/chatbot/admin/presets',
      payload
    )

    return normalizePreset(extractApiData(response))
  } catch (error) {
    throw toApiClientError(error)
  }
}

export const updateAdminChatbotPreset = async (
  presetId: string,
  payload: Partial<UpsertAdminChatbotPresetPayload>
) => {
  try {
    const response = await httpClient.patch<ApiSuccess<Record<string, unknown>>>(
      `/chatbot/admin/presets/${presetId}`,
      payload
    )

    return normalizePreset(extractApiData(response))
  } catch (error) {
    throw toApiClientError(error)
  }
}

export const deleteAdminChatbotPreset = async (presetId: string) => {
  try {
    await httpClient.delete<ApiSuccess<Record<string, unknown>>>(`/chatbot/admin/presets/${presetId}`)
  } catch (error) {
    throw toApiClientError(error)
  }
}
