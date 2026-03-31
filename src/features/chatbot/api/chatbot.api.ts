import { httpClient } from '@/shared/api/httpClient'
import { extractApiData, toApiClientError } from '@/shared/api/response'
import type { ApiSuccess } from '@/shared/types/api.types'

import type { AskChatbotPayload, AskChatbotResponse, ChatbotPresetOption } from '../model/chatbot.types'

export const listChatbotPresets = async () => {
  try {
    const response = await httpClient.get<ApiSuccess<ChatbotPresetOption[]>>('/chatbot/presets')
    return extractApiData(response)
  } catch (error) {
    throw toApiClientError(error)
  }
}

export const askChatbot = async (payload: AskChatbotPayload) => {
  try {
    const response = await httpClient.post<ApiSuccess<AskChatbotResponse>>('/chatbot/ask', payload)
    return extractApiData(response)
  } catch (error) {
    throw toApiClientError(error)
  }
}
