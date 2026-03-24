
import { httpClient } from '@/shared/api/httpClient'
import { extractApiData, toApiClientError } from '@/shared/api/response'
import type { ApiSuccess } from '@/shared/types/api.types'

import type {
  ChatConversation,
  ChatMessage,
  CreateConversationPayload,
  SendChatMessagePayload,
  StaffConversationListResponse,
} from '../model/chat.types'

const toId = (value: unknown) => {
  return typeof value === 'string' ? value : String(value ?? '')
}

const toRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined
  }

  return value as Record<string, unknown>
}

const normalizeConversation = (value: Record<string, unknown>): ChatConversation => {
  const customer = toRecord(value.customerId)

  return {
    id: toId(value.id ?? value._id),
    type: typeof value.type === 'string' ? value.type : 'support',
    isActive: Boolean(value.isActive ?? true),
    participantIds: Array.isArray(value.participantIds)
      ? value.participantIds.map((item) => toId(item))
      : [],
    customer: customer
      ? {
          id: toId(customer.id ?? customer._id),
          fullName: typeof customer.fullName === 'string' ? customer.fullName : undefined,
          email: typeof customer.email === 'string' ? customer.email : undefined,
          avatarUrl: typeof customer.avatarUrl === 'string' ? customer.avatarUrl : undefined,
        }
      : undefined,
    createdAt: String(value.createdAt ?? ''),
    updatedAt: String(value.updatedAt ?? ''),
  }
}

const normalizeMessage = (value: Record<string, unknown>): ChatMessage => {
  return {
    id: toId(value.id ?? value._id),
    conversationId: toId(value.conversationId),
    senderId: toId(value.senderId),
    content: String(value.content ?? ''),
    createdAt: String(value.createdAt ?? ''),
    isRead: Boolean(value.isRead),
  }
}

const normalizeConversationResponse = (value: Record<string, unknown>): StaffConversationListResponse => {
  const rawItems = Array.isArray(value.items) ? value.items : []

  return {
    items: rawItems
      .map((item) => toRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item) => normalizeConversation(item)),
    page: Number(value.page ?? 1),
    limit: Number(value.limit ?? 20),
    totalItems: Number(value.totalItems ?? 0),
    totalPages: Number(value.totalPages ?? 1),
  }
}

const normalizeMessagesResponse = (value: Record<string, unknown>): ChatMessage[] => {
  const rawItems = Array.isArray(value.items) ? value.items : []

  return rawItems
    .map((item) => toRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => normalizeMessage(item))
}

export const createSupportConversation = async (
  payload: CreateConversationPayload
): Promise<ChatConversation> => {
  try {
    const response = await httpClient.post<ApiSuccess<Record<string, unknown>>>(
      '/chat/conversations',
      payload
    )

    return normalizeConversation(extractApiData(response))
  } catch (error) {
    throw toApiClientError(error)
  }
}

export const listSupportConversations = async (
  page = 1,
  limit = 20
): Promise<StaffConversationListResponse> => {
  try {
    const response = await httpClient.get<ApiSuccess<Record<string, unknown>>>('/chat/conversations', {
      params: { page, limit },
    })

    return normalizeConversationResponse(extractApiData(response))
  } catch (error) {
    throw toApiClientError(error)
  }
}

export const listSupportConversationsAsStaff = async (
  page = 1,
  limit = 20
): Promise<StaffConversationListResponse> => {
  try {
    const response = await httpClient.get<ApiSuccess<Record<string, unknown>>>(
      '/chat/conversations/all',
      {
        params: { page, limit },
      }
    )

    return normalizeConversationResponse(extractApiData(response))
  } catch (error) {
    throw toApiClientError(error)
  }
}

export const joinSupportConversation = async (conversationId: string): Promise<ChatConversation> => {
  try {
    const response = await httpClient.post<ApiSuccess<Record<string, unknown>>>(
      `/chat/conversations/${conversationId}/join`
    )

    return normalizeConversation(extractApiData(response))
  } catch (error) {
    throw toApiClientError(error)
  }
}

export const listConversationMessages = async (
  conversationId: string,
  page = 1,
  limit = 40
): Promise<ChatMessage[]> => {
  try {
    const response = await httpClient.get<ApiSuccess<Record<string, unknown>>>(
      `/chat/conversations/${conversationId}/messages`,
      {
        params: { page, limit },
      }
    )

    return normalizeMessagesResponse(extractApiData(response))
  } catch (error) {
    throw toApiClientError(error)
  }
}

export const sendConversationMessage = async (
  payload: SendChatMessagePayload
): Promise<ChatMessage> => {
  try {
    const response = await httpClient.post<ApiSuccess<Record<string, unknown>>>(
      `/chat/conversations/${payload.conversationId}/messages`,
      {
        content: payload.content,
      }
    )

    return normalizeMessage(extractApiData(response))
  } catch (error) {
    throw toApiClientError(error)
  }
}