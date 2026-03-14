/**
 * Modal — animated modal with backdrop blur, Escape key, and scale-in transition.
 * Replaces inline modal markup across the app.
 */
import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import clsx from 'clsx'

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md', // sm, md, lg, xl
  showClose = true,
}) {
  const overlayRef = useRef(null)

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        ref={overlayRef}
        className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm animate-modal-overlay"
        onClick={onClose}
      />

      {/* Content */}
      <div
        className={clsx(
          'relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-h-[90vh] flex flex-col animate-modal-in',
          sizes[size]
        )}
      >
        {/* Header */}
        {(title || showClose) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white dark:text-gray-100">{title}</h2>
            {showClose && (
              <button
                onClick={onClose}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Body (scrollable) */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  )
}
