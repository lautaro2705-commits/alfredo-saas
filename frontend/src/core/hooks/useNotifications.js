import { useState, useEffect, useCallback } from 'react'

/**
 * useNotifications — manages browser notification permissions and display.
 *
 * Handles:
 * - Requesting permission (only after user interaction)
 * - Showing browser notifications
 * - Checking if notifications are supported and permitted
 *
 * NOTE: This is the frontend infrastructure. Push subscriptions (via service worker)
 * require a backend endpoint to store the subscription and send notifications.
 * For now, this enables local notifications triggered by the app itself
 * (e.g., "Cheque por vencer mañana" when the dashboard loads).
 */
export function useNotifications() {
  const [permission, setPermission] = useState(() => {
    if (typeof Notification === 'undefined') return 'unsupported'
    return Notification.permission // 'default', 'granted', 'denied'
  })

  const isSupported = typeof Notification !== 'undefined'
  const isGranted = permission === 'granted'

  const requestPermission = useCallback(async () => {
    if (!isSupported) return 'unsupported'
    if (permission === 'granted') return 'granted'
    if (permission === 'denied') return 'denied'

    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      return result
    } catch {
      return 'denied'
    }
  }, [isSupported, permission])

  const showNotification = useCallback((title, options = {}) => {
    if (!isSupported || !isGranted) return null

    try {
      const notification = new Notification(title, {
        icon: '/logo-alfredo.png',
        badge: '/logo-alfredo.png',
        tag: options.tag || 'alfredo-notification',
        ...options,
      })

      // Auto-close after 8 seconds
      setTimeout(() => notification.close(), 8000)

      notification.onclick = () => {
        window.focus()
        if (options.url) {
          window.location.href = options.url
        }
        notification.close()
      }

      return notification
    } catch {
      return null
    }
  }, [isSupported, isGranted])

  return {
    permission,
    isSupported,
    isGranted,
    requestPermission,
    showNotification,
  }
}
