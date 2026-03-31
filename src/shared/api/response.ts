import axios, { type AxiosResponse } from 'axios'

import { ApiClientError, type ApiErrorPayload, type ApiSuccess } from '@/shared/types/api.types'

export const extractApiData = <T>(response: AxiosResponse<ApiSuccess<T>>) => {
  return response.data.data
}

export const toApiClientError = (error: unknown) => {
  if (axios.isAxiosError<ApiErrorPayload>(error)) {
    return new ApiClientError(error.response?.data.message ?? error.message, {
      statusCode: error.response?.status,
      errors: error.response?.data.errors,
    })
  }

  if (error instanceof ApiClientError) {
    return error
  }

  if (error instanceof Error) {
    return new ApiClientError(error.message)
  }

  return new ApiClientError('Unknown error')
}
