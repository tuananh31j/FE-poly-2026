export interface UpsertCartItemPayload {
    productId: string
    variantId: string
    quantity: number
    selectedAttributes?: Record<string, unknown>
}

export interface CartProductSummary {
    id: string
    name: string
    slug: string
    brand: string
    images: string[]
    isAvailable: boolean
}

export interface CartVariantSummary {
    id: string
    productId: string
    sku: string
    size: string
    price: number
    originalPrice?: number
    stockQuantity: number
    isAvailable: boolean
    images: string[]
    color?: string
    colorHex?: string
}

export interface CartItem {
    productId: string
    variantId: string
    quantity: number
    selectedAttributes?: Record<string, unknown>
    product?: CartProductSummary
    variant?: CartVariantSummary
}

export interface CartResponse {
    id: string
    userId: string
    items: CartItem[]
    updatedAt: string
}