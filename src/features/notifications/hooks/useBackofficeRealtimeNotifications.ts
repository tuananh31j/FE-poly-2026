import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { notification } from 'antd'
import { io, type Socket } from 'socket.io-client'

import { env } from '@/shared/constants/env'

import type {
  StaffNotificationItem,
  StaffRealtimeNotificationPayload,
} from '../model/realtime-notification.types'

const MAX_NOTIFICATIONS = 60

const getSocketBaseUrl = () => {
  try {
    return new URL(env.apiBaseUrl).origin
  } catch {
    return window.location.origin
  }
}

const toAbsoluteUrl = (targetUrl: string) => {
  if (!targetUrl) {
    return window.location.origin
  }

  if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
    return targetUrl
  }

  const normalizedTarget = targetUrl.startsWith('/') ? targetUrl : `/${targetUrl}`
  return `${window.location.origin}${normalizedTarget}`
}

const showServiceWorkerNotification = async (payload: StaffRealtimeNotificationPayload) => {
  if (typeof window === 'undefined') {
    return
  }

  if (!('serviceWorker' in navigator) || !('Notification' in window)) {
    return
  }

  if (Notification.permission !== 'granted') {
    return
  }

  try {
    const registration = await navigator.serviceWorker.ready
    const target = registration.active ?? navigator.serviceWorker.controller

    target?.postMessage({
      type: 'SHOW_NOTIFICATION',
      payload: {
        title: payload.title,
        body: payload.body,
        url: toAbsoluteUrl(payload.url),
        tag: `staff-${payload.type}-${payload.id}`,
      },
    })
  } catch {
    // Notification fallback is best effort only.
  }
}

interface UseBackofficeRealtimeNotificationsInput {
  accessToken?: string | null
  role?: 'customer' | 'staff' | 'admin' | null
}

export const useBackofficeRealtimeNotifications = ({
  accessToken,
  role,
}: UseBackofficeRealtimeNotificationsInput) => {
  const socketRef = useRef<Socket | null>(null)
  const [items, setItems] = useState<StaffNotificationItem[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported'
    }

    return Notification.permission
  })

  const isBackofficeUser = role === 'staff' || role === 'admin'
  const enabled = Boolean(accessToken && isBackofficeUser)

  const markAllAsRead = useCallback(() => {
    setItems((prev) => prev.map((item) => ({ ...item, isRead: true })))
  }, [])

  const markAsRead = useCallback((id: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)))
  }, [])

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported')
      return 'unsupported'
    }

    const nextPermission = await Notification.requestPermission()
    setPermission(nextPermission)
    return nextPermission
  }, [])

  useEffect(() => {
    if (!enabled) {
      setIsConnected(false)
      socketRef.current?.disconnect()
      socketRef.current = null
      return
    }

    const socket = io(getSocketBaseUrl(), {
      auth: {
        token: accessToken,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      setIsConnected(true)
      socket.emit('staff:notifications:join')
    })

    socket.on('disconnect', () => {
      setIsConnected(false)
    })

    socket.on('staff:notification', (payload: StaffRealtimeNotificationPayload) => {
      const nextItem: StaffNotificationItem = {
        ...payload,
        receivedAt: new Date().toISOString(),
        isRead: false,
      }

      setItems((prev) => [nextItem, ...prev.filter((item) => item.id !== nextItem.id)].slice(0, MAX_NOTIFICATIONS))

      const shouldUseServiceWorker = typeof document !== 'undefined' && (document.hidden || !navigator.onLine)

      if (shouldUseServiceWorker) {
        void showServiceWorkerNotification(payload)
        return
      }

      notification.info({
        key: `staff-notification-${payload.id}`,
        message: payload.title,
        description: payload.body,
        placement: 'bottomRight',
        duration: 4,
      })
    })

    return () => {
      socket.removeAllListeners()
      socket.disconnect()

      if (socketRef.current === socket) {
        socketRef.current = null
      }
    }
  }, [accessToken, enabled])

  const unreadCount = useMemo(() => items.filter((item) => !item.isRead).length, [items])

  return {
    items,
    unreadCount,
    isConnected,
    permission,
    requestPermission,
    markAllAsRead,
    markAsRead,
  }
}
