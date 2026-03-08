import { httpClient } from '@/shared/api/httpClient'
import { extractApiData, toApiClientError } from '@/shared/api/response'
import type { ApiSuccess } from '@/shared/types/api.types'

export type UploadFolder = 'avatars' | 'products' | 'categories' | 'others'

export interface UploadImageResult {
    url: string
    publicId: string
    width: number
    height: number
    format: string
    size: number
}

export const uploadImage = async (
    file: File,
    folder: UploadFolder = 'others'
): Promise<UploadImageResult> => {
    try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('folder', folder)

        const response = await httpClient.post<ApiSuccess<UploadImageResult>>('/upload/image', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        })

        return extractApiData(response)
    } catch (error) {
        throw toApiClientError(error)
    }
}