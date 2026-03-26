export interface ChatUserSummary {
  id: string
  fullName?: string
  email?: string
  avatarUrl?: string
}

export interface ChatConversation {
    id: string
    type: string
    isActive: boolean
    participantIds: string[]
    customer?: ChatUserSummary
    createdAt: string
    updatedAt: string
}

export interface ChatMessage {
  id: string
  conversationId: string
  senderId: string
  content: string
  createdAt: string
  isRead?: boolean
}

export interface StaffConversationListResponse {
  items: ChatConversation[]
  page: number
  limit: number
  totalItems: number
  totalPages: number
}

export interface CreateConversationPayload {
  initialMessage?: string
}

export interface SendChatMessagePayload {
  conversationId: string
  content: string
}