import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'

export default function MercadoLibreCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')

    if (success === 'true') {
      setStatus('success')
      setMessage('¡Tu cuenta de MercadoLibre fue conectada exitosamente!')
    } else if (error) {
      setStatus('error')
      setMessage(error === 'invalid_state'
        ? 'La sesión expiró. Por favor, intentá conectar nuevamente.'
        : `Error: ${error}`
      )
    } else {
      setStatus('error')
      setMessage('Respuesta inválida de MercadoLibre')
    }

    // Redirigir a Mi Perfil después de 3 segundos
    const timer = setTimeout(() => {
      navigate('/mi-perfil')
    }, 3000)

    return () => clearTimeout(timer)
  }, [searchParams, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          {/* Logo MercadoLibre */}
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-yellow-100 flex items-center justify-center">
            <span className="text-3xl">🛒</span>
          </div>

          {/* Estado */}
          {status === 'loading' && (
            <>
              <Loader2 className="w-12 h-12 mx-auto mb-4 text-blue-500 animate-spin" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Procesando...
              </h2>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                ¡Conexión exitosa!
              </h2>
              <p className="text-gray-600 mb-6">{message}</p>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Error de conexión
              </h2>
              <p className="text-gray-600 mb-6">{message}</p>
            </>
          )}

          {/* Mensaje de redirección */}
          <p className="text-sm text-gray-400">
            Redirigiendo a Mi Perfil en 3 segundos...
          </p>

          {/* Botón manual */}
          <button
            onClick={() => navigate('/mi-perfil')}
            className="mt-4 text-primary-600 hover:text-primary-700 font-medium"
          >
            Ir ahora →
          </button>
        </div>
      </div>
    </div>
  )
}
