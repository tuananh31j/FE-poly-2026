import { httpClient } from '@/shared/api/httpClient'
import { extractApiData, toApiClientError } from '@/shared/api/response'
import type { ApiSuccess } from '@/shared/types/api.types'

export interface HealthStatus {
  app: 'up' | 'down'
  mongo: 'up' | 'down'
  timestamp: string
}

export const getHealthStatus = async () => {
  try {
    const response = await httpClient.get<ApiSuccess<HealthStatus>>('/health')
    return extractApiData(response)
  } catch (error) {
    throw toApiClientError(error)
  }
}
