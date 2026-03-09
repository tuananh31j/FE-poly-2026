export interface ApiSuccess<T> {
    success: true
    message: string
    data: T
}

export interface ApiValidationError {
    path: string
    message: string
}

export interface ApiErrorPayload {
    success: false
    message: string
    errors?: ApiValidationError[]
}

export class ApiClientError extends Error {
    statusCode?: number
    errors?: ApiValidationError[]

    constructor(message: string, options?: { statusCode?: number; errors?: ApiValidationError[] }) {
        super(message)
        this.name = 'ApiClientError'
        this.statusCode = options?.statusCode
        this.errors = options?.errors
    }
}