import type { AuthRole } from '@/shared/constants/routes'

export type BackofficeRole = Extract<AuthRole, 'staff' | 'admin'>

export type StaffRealtimeNotificationType = 'order_created' | 'comment_created' | 'review_created'

export interface StaffRealtimeNotificationPayload {
  id: string
  type: StaffRealtimeNotificationType
  title: string
  body: string
  createdAt: string
  url: string
  metadata?: Record<string, unknown>
}

export interface StaffNotificationItem extends StaffRealtimeNotificationPayload {
  receivedAt: string
  isRead: boolean
}
