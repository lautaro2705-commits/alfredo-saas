import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Car,
  Calendar,
  Gauge,
  Fuel,
  Paintbrush,
  MapPin,
  Phone,
  MessageCircle,
  ArrowLeft,
  Share2,
  ExternalLink,
  Loader2,
  AlertTriangle,
} from 'lucide-react'
import clsx from 'clsx'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

export default function FichaPublica() {
  const { dominio } = useParams()
  const [unidad, setUnidad] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchFicha() {
      try {
        setLoading(true)
        const res = await fetch(`${API_URL}/autos/marketing/ficha-publica/${dominio}`)
        if (!res.ok) {
          if (res.status === 404) throw new Error('not_found')
          throw new Error('server_error')
        }
        const data = await res.json()
        setUnidad(data)
      } catch (err) {
        setError(err.message === 'not_found' ? 'not_found' : 'error')
      } finally {
        setLoading(false)
      }
    }
    if (dominio) fetchFicha()
  }, [dominio])

  const handleShare = async () => {
    const url = window.location.href
    const title = unidad ? `${unidad.marca} ${unidad.modelo} ${unidad.anio}` : 'Vehiculo'
    const text = unidad
      ? `${unidad.marca} ${unidad.modelo} ${unidad.anio}\n${unidad.kilometraje?.toLocaleString() || '0'} km\n$${unidad.precio_publicado?.toLocaleString() || 'Consultar'}`
      : ''

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url })
        return
      } catch (err) {
        if (err.name === 'AbortError') return
      }
    }
    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(`${title}\n${text}\n${url}`)
      alert('Link copiado al portapapeles')
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <span className="text-sm text-gray-500">Cargando ficha...</span>
        </div>
      </div>
    )
  }

  if (error === 'not_found') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-100 flex items-center justify-center">
            <Car className="w-8 h-8 text-yellow-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Vehiculo no encontrado</h1>
          <p className="text-gray-500 mb-6">
            Esta unidad ya no esta disponible o el link es incorrecto.
          </p>
          <a
            href="https://alfredoapp.com.ar"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Ir a Alfredo
          </a>
        </div>
      </div>
    )
  }

  if (error || !unidad) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Error al cargar</h1>
          <p className="text-gray-500">Intenta de nuevo mas tarde.</p>
        </div>
      </div>
    )
  }

  const formatCurrency = (v) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(v || 0)

  const whatsappText = encodeURIComponent(
    `Hola! Vi el ${unidad.marca} ${unidad.modelo} ${unidad.anio} (${unidad.dominio}) y me interesa. Me podes pasar mas info?`
  )
  const whatsappUrl = `https://wa.me/${unidad.telefono_agencia || '543518567543'}?text=${whatsappText}`

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo-alfredo.png" alt="Alfredo" className="w-7 h-7 rounded-lg" />
            <span className="text-base font-bold text-blue-600">Alfredo</span>
          </div>
          <button
            onClick={handleShare}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Compartir"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 pb-32">
        {/* Photos */}
        {unidad.fotos?.length > 0 && (
          <div className="mb-6 rounded-xl overflow-hidden bg-gray-200 aspect-video">
            <img
              src={unidad.fotos[0]}
              alt={`${unidad.marca} ${unidad.modelo}`}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Title + Price */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {unidad.marca} {unidad.modelo}
              </h1>
              <p className="text-gray-500 mt-1">{unidad.version} &middot; {unidad.anio}</p>
            </div>
            <span className={clsx(
              'px-3 py-1 rounded-full text-sm font-medium',
              unidad.estado === 'disponible'
                ? 'bg-green-100 text-green-700'
                : unidad.estado === 'reservado'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-gray-100 text-gray-700'
            )}>
              {unidad.estado === 'disponible' ? 'Disponible' : unidad.estado === 'reservado' ? 'Reservado' : unidad.estado}
            </span>
          </div>

          <p className="text-3xl font-bold text-blue-600 mt-4">
            {formatCurrency(unidad.precio_publicado)}
          </p>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <DetailItem icon={Calendar} label="Año" value={unidad.anio} />
          <DetailItem icon={Gauge} label="Kilometraje" value={`${unidad.kilometraje?.toLocaleString() || '0'} km`} />
          <DetailItem icon={Paintbrush} label="Color" value={unidad.color || '-'} />
          <DetailItem icon={Fuel} label="Combustible" value={unidad.combustible || '-'} />
          <DetailItem icon={Car} label="Dominio" value={unidad.dominio} />
          <DetailItem icon={Car} label="Transmision" value={unidad.transmision || '-'} />
        </div>

        {/* Observations */}
        {unidad.observaciones && (
          <div className="mb-6 p-4 bg-white rounded-xl border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-2">Observaciones</h3>
            <p className="text-sm text-gray-600 whitespace-pre-line">{unidad.observaciones}</p>
          </div>
        )}

        {/* More photos */}
        {unidad.fotos?.length > 1 && (
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">Fotos</h3>
            <div className="grid grid-cols-3 gap-2">
              {unidad.fotos.slice(1).map((foto, i) => (
                <div key={i} className="aspect-square rounded-lg overflow-hidden bg-gray-200">
                  <img src={foto} alt={`Foto ${i + 2}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Agency info */}
        {unidad.nombre_agencia && (
          <div className="p-4 bg-white rounded-xl border border-gray-200 mb-6">
            <p className="font-semibold text-gray-900">{unidad.nombre_agencia}</p>
            {unidad.direccion_agencia && (
              <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                <MapPin className="w-3.5 h-3.5" /> {unidad.direccion_agencia}
              </p>
            )}
          </div>
        )}

        {/* Powered by */}
        <div className="text-center mt-8">
          <p className="text-xs text-gray-400">
            Publicado con{' '}
            <a href="https://alfredoapp.com.ar" className="text-blue-500 hover:underline">
              Alfredo
            </a>
            {' '}&middot; Software para agencias de autos
          </p>
        </div>
      </main>

      {/* Floating CTA */}
      <div className="fixed bottom-0 inset-x-0 p-4 bg-white/95 backdrop-blur-sm border-t border-gray-200 safe-area-bottom">
        <div className="max-w-3xl mx-auto flex gap-3">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors shadow-lg shadow-green-600/20"
          >
            <MessageCircle className="w-5 h-5" />
            Consultar por WhatsApp
          </a>
          {unidad.telefono_agencia && (
            <a
              href={`tel:${unidad.telefono_agencia}`}
              className="flex items-center justify-center px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
            >
              <Phone className="w-5 h-5" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function DetailItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200">
      <Icon className="w-5 h-5 text-gray-400 flex-shrink-0" />
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm font-medium text-gray-900">{value}</p>
      </div>
    </div>
  )
}
