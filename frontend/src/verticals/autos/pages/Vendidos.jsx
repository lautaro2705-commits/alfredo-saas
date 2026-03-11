import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { unidadesAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import {
  Search,
  Car,
  Calendar,
  CheckCircle,
  ArrowLeft
} from 'lucide-react'
import clsx from 'clsx'

export default function Vendidos() {
  const { isAdmin } = useAuth()
  const [buscar, setBuscar] = useState('')

  const { data: unidades, isLoading } = useQuery({
    queryKey: ['unidades-vendidas', buscar],
    queryFn: async () => {
      const params = {}
      if (buscar) params.buscar = buscar
      const res = await unidadesAPI.vendidos(params)
      return res.data
    },
  })

  const formatCurrency = (value) => {
    if (!value) return '-'
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(value)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('es-AR')
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/unidades" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Vehículos Vendidos</h1>
            <p className="text-gray-500">{unidades?.length || 0} unidades vendidas</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="card">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por marca, modelo o patente..."
            className="input pl-10"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
          />
        </div>
      </div>

      {/* Lista de unidades vendidas */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        </div>
      ) : unidades?.length === 0 ? (
        <div className="card text-center py-12">
          <CheckCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No hay vehículos vendidos</h3>
          <p className="text-gray-500 mt-1">Los vehículos vendidos aparecerán aquí</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {unidades?.map((unidad) => (
            <Link
              key={unidad.id}
              to={`/unidades/${unidad.id}`}
              className="card hover:border-primary-300 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {unidad.marca} {unidad.modelo}
                  </h3>
                  <p className="text-gray-500 text-sm">{unidad.anio}</p>
                </div>
                <span className="badge bg-blue-100 text-blue-800">
                  Vendido
                </span>
              </div>

              <div className="flex items-center gap-2 text-gray-600 text-sm mb-3">
                <Car className="w-4 h-4" />
                <span className="font-mono">{unidad.dominio}</span>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <Calendar className="w-4 h-4" />
                  <span>Vendido: {formatDate(unidad.fecha_venta)}</span>
                </div>

                <div className="text-right">
                  {unidad.precio_publicado ? (
                    <p className="font-semibold text-green-600">
                      {formatCurrency(unidad.precio_publicado)}
                    </p>
                  ) : (
                    <p className="text-gray-400 text-sm">Sin precio</p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
