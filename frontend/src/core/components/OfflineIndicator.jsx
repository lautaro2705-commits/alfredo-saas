/**
 * OfflineIndicator — shows a banner when the user loses internet connection.
 *
 * Appears below the header with a yellow warning style.
 * Auto-hides when connection is restored, with a brief "Conectado" confirmation.
 */
import { useState, useEffect } from 'react'
import { WifiOff, Wifi } from 'lucide-react'
import { useOnlineStatus } from '@/core/hooks/useOnlineStatus'

export default function OfflineIndicator() {
  const { isOnline } = useOnlineStatus()
  const [showReconnected, setShowReconnected] = useState(false)
  const [wasOffline, setWasOffline] = useState(false)

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true)
      setShowReconnected(false)
    } else if (wasOffline) {
      // Just came back online — show brief confirmation
      setShowReconnected(true)
      const timer = setTimeout(() => {
        setShowReconnected(false)
        setWasOffline(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [isOnline, wasOffline])

  if (isOnline && !showReconnected) return null

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[9999] transition-all duration-300 ${
        isOnline
          ? 'bg-green-500 text-white'
          : 'bg-amber-500 text-amber-950'
      }`}
    >
      <div className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium">
        {isOnline ? (
          <>
            <Wifi className="w-4 h-4" />
            <span>Conexión restaurada</span>
          </>
        ) : (
          <>
            <WifiOff className="w-4 h-4" />
            <span>Sin conexión — Los datos pueden no estar actualizados</span>
          </>
        )}
      </div>
    </div>
  )
}
