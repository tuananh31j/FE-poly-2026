import { httpClient } from '@/shared/api/httpClient'
import { extractApiData, toApiClientError } from '@/shared/api/response'
import type { ApiSuccess } from '@/shared/types/api.types'

import type { AskChatbotPayload, AskChatbotResponse } from '../model/chatbot.types'

export const askChatbot = async (payload: AskChatbotPayload) => {
  try {
    const response = await httpClient.post<ApiSuccess<AskChatbotResponse>>('/chatbot/ask', payload)
    return extractApiData(response)
  } catch (error) {
    throw toApiClientError(error)
  }
}
