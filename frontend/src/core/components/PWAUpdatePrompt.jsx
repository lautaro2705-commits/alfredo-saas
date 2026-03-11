/**
 * PWAUpdatePrompt — shows a bottom banner when a new version of the app
 * is available via the service worker.  The user clicks "Actualizar" to
 * activate the waiting SW and reload the page.
 *
 * Uses vite-plugin-pwa's `useRegisterSW` hook which handles:
 *   1. Registering the SW on first visit
 *   2. Detecting when a new SW is waiting to activate
 *   3. Periodic update checks (every 60 min)
 */
import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw } from 'lucide-react'

const UPDATE_INTERVAL = 60 * 60 * 1000 // Check for updates every 60 min

export default function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Periodically check for SW updates
      if (registration) {
        setInterval(() => registration.update(), UPDATE_INTERVAL)
      }
    },
    onRegisterError(error) {
      console.error('SW registration error:', error)
    },
  })

  if (!needRefresh) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] animate-modal-in">
      <div className="flex items-center gap-3 bg-primary-600 text-white px-5 py-3 rounded-xl shadow-lg shadow-primary-600/25">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span className="text-sm font-medium">Nueva versión disponible</span>
        <button
          onClick={() => updateServiceWorker(true)}
          className="ml-1 px-3 py-1 bg-white text-primary-700 rounded-lg text-sm font-semibold hover:bg-primary-50 transition-colors"
        >
          Actualizar
        </button>
      </div>
    </div>
  )
}
