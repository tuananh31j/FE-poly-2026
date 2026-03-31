export interface ChatbotAction {
  label: string
  url: string
}

export interface ChatbotSuggestedProduct {
  id: string
  name: string
  brand: string
  imageUrl: string | null
  priceFrom: number | null
  soldCount: number
  averageRating: number
  url: string
}

export interface ChatbotPresetOption {
  id: string
  question: string
}

export interface AskChatbotPayload {
  presetId: string
  context?: {
    path?: string
  }
}

export interface AskChatbotResponse {
  intent: 'preset'
  answer: string
  actions: ChatbotAction[]
  followUpQuestions: ChatbotPresetOption[]
  suggestedProducts: ChatbotSuggestedProduct[]
}

export interface ChatbotUiMessage {
  id: string
  role: 'assistant' | 'customer'
  content: string
  createdAt: string
  actions?: ChatbotAction[]
  suggestedProducts?: ChatbotSuggestedProduct[]
  followUpQuestions?: ChatbotPresetOption[]
}
