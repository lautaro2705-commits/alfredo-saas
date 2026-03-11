/**
 * Componente para captura de fotos desde cámara o galería
 * Incluye compresión client-side antes de subir
 * Diseñado mobile-first para uso en campo
 */
import { useState, useRef, useCallback } from 'react'
import { Camera, Image, X, Upload, RotateCcw } from 'lucide-react'
import clsx from 'clsx'

// Comprimir imagen antes de subir
async function compressImage(file, maxWidth = 1200, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img')
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let { width, height } = img

      // Redimensionar si es necesario
      if (width > maxWidth) {
        height = (height * maxWidth) / width
        width = maxWidth
      }

      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (blob) {
            // Crear nuevo archivo con el blob comprimido
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now()
            })
            resolve(compressedFile)
          } else {
            reject(new Error('Error al comprimir imagen'))
          }
        },
        'image/jpeg',
        quality
      )
    }
    img.onerror = () => reject(new Error('Error al cargar imagen'))
    img.src = URL.createObjectURL(file)
  })
}

export default function CameraCapture({
  onCapture,
  onCancel,
  maxWidth = 1200,
  quality = 0.7,
  allowGallery = true,
  showPreview = true
}) {
  const [mode, setMode] = useState('select') // select, camera, preview
  const [preview, setPreview] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState(null)

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const streamRef = useRef(null)

  // Iniciar cámara
  const startCamera = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Cámara trasera
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setMode('camera')
    } catch (err) {
      console.error('Error al acceder a la cámara:', err)
      setError('No se pudo acceder a la cámara. Intenta desde la galería.')
      // Fallback a galería
      if (allowGallery && fileInputRef.current) {
        fileInputRef.current.click()
      }
    }
  }, [allowGallery])

  // Detener cámara
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  // Capturar foto de la cámara
  const captureFromCamera = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0)

    // Convertir a blob
    const blob = await new Promise(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', quality)
    )

    const file = new File([blob], `foto_${Date.now()}.jpg`, {
      type: 'image/jpeg'
    })

    // Detener cámara
    stopCamera()

    // Procesar y mostrar preview
    await processFile(file)
  }, [quality, stopCamera])

  // Procesar archivo (comprimir y mostrar preview)
  const processFile = async (file) => {
    setIsProcessing(true)
    setError(null)

    try {
      const compressed = await compressImage(file, maxWidth, quality)

      const previewUrl = URL.createObjectURL(compressed)
      setPreview({
        url: previewUrl,
        file: compressed,
        originalSize: file.size,
        compressedSize: compressed.size
      })

      if (showPreview) {
        setMode('preview')
      } else {
        // Enviar directamente sin preview
        onCapture(compressed)
      }
    } catch (err) {
      setError('Error al procesar la imagen')
      console.error(err)
    } finally {
      setIsProcessing(false)
    }
  }

  // Manejar selección de archivo
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (file) {
      await processFile(file)
    }
  }

  // Confirmar y enviar foto
  const confirmPhoto = () => {
    if (preview?.file) {
      onCapture(preview.file)
      cleanup()
    }
  }

  // Reintentar
  const retry = () => {
    if (preview?.url) {
      URL.revokeObjectURL(preview.url)
    }
    setPreview(null)
    setMode('select')
  }

  // Limpiar recursos
  const cleanup = () => {
    stopCamera()
    if (preview?.url) {
      URL.revokeObjectURL(preview.url)
    }
    setPreview(null)
    setMode('select')
  }

  // Cancelar
  const handleCancel = () => {
    cleanup()
    onCancel?.()
  }

  // Formatear tamaño de archivo
  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 text-white">
        <h3 className="text-lg font-medium">
          {mode === 'select' && 'Agregar foto'}
          {mode === 'camera' && 'Capturar foto'}
          {mode === 'preview' && 'Confirmar foto'}
        </h3>
        <button
          onClick={handleCancel}
          className="p-2 hover:bg-white/10 rounded-full"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/20 text-red-300 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Modo selección */}
        {mode === 'select' && (
          <div className="flex flex-col gap-4 w-full max-w-xs">
            <button
              onClick={startCamera}
              className="flex items-center justify-center gap-3 p-6 bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-colors"
            >
              <Camera className="w-8 h-8" />
              <span className="text-lg font-medium">Usar cámara</span>
            </button>

            {allowGallery && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-3 p-6 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-colors"
              >
                <Image className="w-8 h-8" />
                <span className="text-lg font-medium">Elegir de galería</span>
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        )}

        {/* Modo cámara */}
        {mode === 'camera' && (
          <div className="relative w-full max-w-lg">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full rounded-lg"
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Botón de captura */}
            <div className="absolute bottom-4 left-0 right-0 flex justify-center">
              <button
                onClick={captureFromCamera}
                disabled={isProcessing}
                className="w-16 h-16 bg-white rounded-full border-4 border-gray-300 hover:border-primary-500 transition-colors disabled:opacity-50"
              >
                <span className="sr-only">Capturar</span>
              </button>
            </div>
          </div>
        )}

        {/* Modo preview */}
        {mode === 'preview' && preview && (
          <div className="w-full max-w-lg">
            <img
              src={preview.url}
              alt="Preview"
              className="w-full rounded-lg"
            />

            {/* Info de compresión */}
            <div className="mt-3 text-center text-sm text-gray-400">
              Comprimida: {formatSize(preview.originalSize)} → {formatSize(preview.compressedSize)}
              <span className="ml-2 text-green-400">
                ({Math.round((1 - preview.compressedSize / preview.originalSize) * 100)}% reducción)
              </span>
            </div>
          </div>
        )}

        {/* Loading */}
        {isProcessing && (
          <div className="text-white text-center">
            <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-2" />
            <p>Procesando imagen...</p>
          </div>
        )}
      </div>

      {/* Footer con acciones */}
      {mode === 'preview' && (
        <div className="p-4 flex gap-3">
          <button
            onClick={retry}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl"
          >
            <RotateCcw className="w-5 h-5" />
            Reintentar
          </button>
          <button
            onClick={confirmPhoto}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl"
          >
            <Upload className="w-5 h-5" />
            Usar foto
          </button>
        </div>
      )}
    </div>
  )
}

// Componente simple para input de archivo con preview
export function PhotoInput({ value, onChange, className }) {
  const fileInputRef = useRef(null)
  const [preview, setPreview] = useState(value)

  const handleChange = async (e) => {
    const file = e.target.files?.[0]
    if (file) {
      try {
        const compressed = await compressImage(file)
        const previewUrl = URL.createObjectURL(compressed)
        setPreview(previewUrl)
        onChange?.(compressed)
      } catch (err) {
        console.error('Error al procesar imagen:', err)
      }
    }
  }

  return (
    <div className={clsx('relative', className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        className="hidden"
      />

      {preview ? (
        <div className="relative">
          <img
            src={preview}
            alt="Preview"
            className="w-full h-32 object-cover rounded-lg"
          />
          <button
            onClick={() => {
              setPreview(null)
              onChange?.(null)
            }}
            className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-2 text-gray-500 hover:border-primary-500 hover:text-primary-600 transition-colors"
        >
          <Camera className="w-8 h-8" />
          <span className="text-sm">Agregar foto</span>
        </button>
      )}
    </div>
  )
}
