self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('message', (event) => {
  const data = event.data

  if (!data || data.type !== 'SHOW_NOTIFICATION') {
    return
  }

  const payload = data.payload ?? {}
  const title = typeof payload.title === 'string' && payload.title.trim() ? payload.title : 'Thông báo mới'
  const body = typeof payload.body === 'string' ? payload.body : ''
  const url = typeof payload.url === 'string' && payload.url.trim() ? payload.url : '/dashboard'
  const tag = typeof payload.tag === 'string' && payload.tag.trim() ? payload.tag : `staff-${Date.now()}`

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      renotify: true,
      icon: '/branding/logo-mark.svg',
      badge: '/vite.svg',
      data: {
        url,
      },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl =
    typeof event.notification?.data?.url === 'string' && event.notification.data.url.trim()
      ? event.notification.data.url
      : '/dashboard'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.focus()

          if ('navigate' in client) {
            return client.navigate(targetUrl)
          }

          return client
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }

      return undefined
    })
  )
})
