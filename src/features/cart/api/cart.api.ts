import { httpClient } from '@/shared/api/httpClient'
import { extractApiData, toApiClientError } from '@/shared/api/response'
import type { ApiSuccess } from '@/shared/types/api.types'

import type {
    CartItem,
    CartProductSummary,
    CartResponse,
    CartVariantSummary,
    UpsertCartItemPayload,
} from '../model/cart.types'

const PRODUCT_PLACEHOLDER_BRAND = 'Generic'

const toId = (value: unknown) => {
    return typeof value === 'string' ? value : String(value ?? '')
}

const toStringArray = (value: unknown) => {
    if (!Array.isArray(value)) {
        return []
    }

    return value.filter((item): item is string => typeof item === 'string')
}

const toRecord = (value: unknown): Record<string, unknown> | undefined => {
    if (!value || typeof value !== 'object') {
        return undefined
    }

    return value as Record<string, unknown>
}

const normalizeProduct = (value: unknown): CartProductSummary | undefined => {
    const record = toRecord(value)

    if (!record) {
        return undefined
    }

    return {
        id: toId(record._id ?? record.id),
        name: String(record.name ?? ''),
        brand: typeof record.brand === 'string' ? record.brand : PRODUCT_PLACEHOLDER_BRAND,
        images: toStringArray(record.images),
        isAvailable: Boolean(record.isAvailable),
    }
}

const resolveVariantColor = (variant: Record<string, unknown>) => {
    if (typeof variant.color === 'string' && variant.color.trim()) {
        return {
            color: variant.color.trim(),
            colorHex: typeof variant.colorHex === 'string' ? variant.colorHex : undefined,
        }
    }

    const colorInfo = toRecord(variant.colorId)

    if (!colorInfo) {
        return {
            color: undefined,
            colorHex: undefined,
        }
    }

    return {
        color: typeof colorInfo.name === 'string' ? colorInfo.name : undefined,
        colorHex: typeof colorInfo.hexCode === 'string' ? colorInfo.hexCode : undefined,
    }
}

const normalizeVariant = (value: unknown): CartVariantSummary | undefined => {
    const record = toRecord(value)

    if (!record) {
        return undefined
    }

    const color = resolveVariantColor(record)

    return {
        id: toId(record._id ?? record.id),
        productId: toId(record.productId),
        sku: String(record.sku ?? ''),
        size: typeof record.size === 'string' ? record.size : 'Standard',
        price: Number(record.price ?? 0),
        originalPrice: typeof record.originalPrice === 'number' ? record.originalPrice : undefined,
        stockQuantity: Number(record.stockQuantity ?? 0),
        isAvailable: Boolean(record.isAvailable),
        images: toStringArray(record.images),
        color: color.color,
        colorHex: color.colorHex,
    }
}

const normalizeCartItem = (value: unknown): CartItem | null => {
    const record = toRecord(value)

    if (!record) {
        return null
    }

    const product = normalizeProduct(record.product)
    const variant = normalizeVariant(record.variant)

    return {
        productId: toId(record.productId ?? product?.id),
        variantId: toId(record.variantId ?? variant?.id),
        quantity: Number(record.quantity ?? 1),
        selectedAttributes: toRecord(record.selectedAttributes),
        product,
        variant,
    }
}

const normalizeCart = (value: Record<string, unknown>): CartResponse => {
    const rawItems = Array.isArray(value.items) ? value.items : []

    return {
        id: toId(value.id ?? value._id),
        userId: toId(value.userId),
        items: rawItems.map((item) => normalizeCartItem(item)).filter((item): item is CartItem => Boolean(item)),
        updatedAt: String(value.updatedAt ?? ''),
    }
}

export const getMyCart = async () => {
    try {
        const response = await httpClient.get<ApiSuccess<Record<string, unknown>>>('/cart')
        const data = extractApiData(response)
        return normalizeCart(data)
    } catch (error) {
        throw toApiClientError(error)
    }
}

export const upsertCartItem = async (payload: UpsertCartItemPayload) => {
    try {
        const response = await httpClient.put<ApiSuccess<Record<string, unknown>>>('/cart/items', payload)
        return normalizeCart(extractApiData(response))
    } catch (error) {
        throw toApiClientError(error)
    }
}

export const removeCartItem = async (variantId: string) => {
    try {
        const response = await httpClient.delete<ApiSuccess<Record<string, unknown>>>(`/cart/items/${variantId}`)
        return normalizeCart(extractApiData(response))
    } catch (error) {
        throw toApiClientError(error)
    }
}

export const clearMyCart = async () => {
    try {
        const response = await httpClient.delete<ApiSuccess<Record<string, unknown>>>('/cart/items')
        return normalizeCart(extractApiData(response))
    } catch (error) {
        throw toApiClientError(error)
    }
}