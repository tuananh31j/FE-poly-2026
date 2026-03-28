export interface AdminChatbotPresetProduct {
  id: string
  name: string
  brand: string
  imageUrl: string | null
  isAvailable: boolean
}

export interface AdminChatbotPresetItem {
  id: string
  question: string
  answer?: string
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
  products: AdminChatbotPresetProduct[]
}

export interface UpsertAdminChatbotPresetPayload {
  question: string
  answer?: string
  productIds: string[]
  isActive?: boolean
  sortOrder?: number
}
