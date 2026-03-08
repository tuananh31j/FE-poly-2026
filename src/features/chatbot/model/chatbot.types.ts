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

export interface AskChatbotPayload {
  question: string
  context?: {
    path?: string
  }
}

export interface AskChatbotResponse {
  intent:
    | 'order_tracking'
    | 'payment'
    | 'shipping'
    | 'voucher'
    | 'return_refund'
    | 'recommendation'
    | 'general'
  answer: string
  actions: ChatbotAction[]
  followUpQuestions: string[]
  suggestedProducts: ChatbotSuggestedProduct[]
}

export interface ChatbotUiMessage {
  id: string
  role: 'assistant' | 'customer'
  content: string
  createdAt: string
  actions?: ChatbotAction[]
  suggestedProducts?: ChatbotSuggestedProduct[]
  followUpQuestions?: string[]
}
