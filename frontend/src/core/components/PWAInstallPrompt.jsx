/**
 * PWAInstallPrompt — branded install banner for mobile users.
 *
 * Shows a bottom banner encouraging users to install Alfredo as a PWA.
 * Only visible when:
 *   1. The browser supports install (beforeinstallprompt fired)
 *   2. The app is not already installed (not in standalone mode)
 *   3. The user hasn't dismissed it in the last 7 days
 *
 * Position: above the bottom nav on mobile, bottom-center on desktop.
 */
import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'
import { usePWAInstall } from '@/core/hooks/usePWAInstall'

const DISMISS_KEY = 'alfredo:pwa-install-dismissed'
const DISMISS_DAYS = 7

function isDismissed() {
  const ts = localStorage.getItem(DISMISS_KEY)
  if (!ts) return false
  const diff = Date.now() - Number(ts)
  return diff < DISMISS_DAYS * 24 * 60 * 60 * 1000
}

export default function PWAInstallPrompt() {
  const { canInstall, isInstalled, promptInstall } = usePWAInstall()
  const [dismissed, setDismissed] = useState(isDismissed)
  const [visible, setVisible] = useState(false)

  // Delay appearance for smoother UX (don't flash on load)
  useEffect(() => {
    if (canInstall && !isInstalled && !dismissed) {
      const timer = setTimeout(() => setVisible(true), 3000)
      return () => clearTimeout(timer)
    }
    setVisible(false)
  }, [canInstall, isInstalled, dismissed])

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setDismissed(true)
    setVisible(false)
  }

  async function handleInstall() {
    await promptInstall()
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-20 lg:bottom-4 left-4 right-4 lg:left-1/2 lg:-translate-x-1/2 lg:max-w-sm z-[9998] animate-modal-in">
      <div className="flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3 rounded-xl shadow-lg">
        {/* App icon */}
        <img
          src="/logo-alfredo.png"
          alt="Alfredo"
          className="w-10 h-10 rounded-lg flex-shrink-0"
        />

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            Instalá Alfredo
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Accedé más rápido desde tu pantalla de inicio
          </p>
        </div>

        {/* Install button */}
        <button
          onClick={handleInstall}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Instalar
        </button>

        {/* Dismiss */}
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
