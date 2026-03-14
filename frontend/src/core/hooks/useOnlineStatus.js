/**
 * useOnlineStatus — reactive hook for browser online/offline state.
 *
 * Listens to the window 'online' and 'offline' events and returns
 * a boolean that re-renders the component on change.
 *
 * @returns {{ isOnline: boolean }}
 */
import { useState, useEffect } from 'react'

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)

    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)

    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return { isOnline }
}
