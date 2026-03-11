/**
 * Autos vertical API client.
 *
 * Uses the shared core API instance (correct base URL, JWT interceptor, 401 handling).
 * All routes prefixed with /autos/ — the SaaS backend namespaces verticals.
 *
 * Usage:
 *   import { unidadesAPI, clientesAPI } from '../services/api'
 */
import api from '@/core/services/api'

// Re-export authAPI from core for components that import it from here (e.g. MiPerfil)
export { authAPI } from '@/core/services/api'

// Base URL for building raw links (PDF urls, marketing links)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

// Usuarios
export const usuariosAPI = {
  list: (params) => api.get('/autos/usuarios/', { params }),
  get: (id) => api.get(`/autos/usuarios/${id}`),
  create: (data) => api.post('/autos/usuarios/', data),
  update: (id, data) => api.put(`/autos/usuarios/${id}`, data),
  delete: (id) => api.delete(`/autos/usuarios/${id}`),
  reactivar: (id) => api.post(`/autos/usuarios/${id}/reactivar`),
  vendedores: () => api.get('/autos/usuarios/vendedores'),
  miPerfil: () => api.get('/autos/usuarios/mi-perfil'),
  estadisticas: (id) => api.get(`/autos/usuarios/${id}/estadisticas`),
  permisosDisponibles: () => api.get('/autos/usuarios/permisos-disponibles'),
  actualizarPermisos: (id, permisos) => api.put(`/autos/usuarios/${id}/permisos`, permisos),
  restablecerPermisos: (id) => api.post(`/autos/usuarios/${id}/restablecer-permisos`),
}

// Unidades
export const unidadesAPI = {
  list: (params) => api.get('/autos/unidades/', { params }),
  get: (id) => api.get(`/autos/unidades/${id}`),
  create: (data) => api.post('/autos/unidades/', data),
  update: (id, data) => api.put(`/autos/unidades/${id}`, data),
  delete: (id, forzar = false) => api.delete(`/autos/unidades/${id}`, { params: { forzar } }),
  stockDisponible: () => api.get('/autos/unidades/stock-disponible'),
  inmovilizados: () => api.get('/autos/unidades/inmovilizados'),
  vendidos: (params) => api.get('/autos/unidades/vendidos', { params }),
  historialCostos: (id) => api.get(`/autos/unidades/${id}/historial-costos`),
  valorizacion: () => api.get('/autos/unidades/valorizacion/resumen'),
  // OCR del título automotor
  ocrTitulo: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/autos/unidades/ocr-titulo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  // Fotos de unidades
  getFotos: (id) => api.get(`/autos/unidades/${id}/fotos`),
  subirFoto: (id, file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post(`/autos/unidades/${id}/fotos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  eliminarFoto: (id, fotoIndex) => api.delete(`/autos/unidades/${id}/fotos/${fotoIndex}`),
  reordenarFotos: (id, nuevoOrden) => api.put(`/autos/unidades/${id}/fotos/reordenar`, nuevoOrden),
}

// Clientes
export const clientesAPI = {
  list: (params) => api.get('/autos/clientes/', { params }),
  get: (id) => api.get(`/autos/clientes/${id}`),
  create: (data) => api.post('/autos/clientes/', data),
  update: (id, data) => api.put(`/autos/clientes/${id}`, data),
  delete: (id) => api.delete(`/autos/clientes/${id}`),
}

// Costos Directos
export const costosAPI = {
  list: (params) => api.get('/autos/costos/', { params }),
  get: (id) => api.get(`/autos/costos/${id}`),
  create: (data) => api.post('/autos/costos/', data),
  createRapido: (params) => api.post('/autos/costos/rapido/', null, { params }),
  update: (id, data) => api.put(`/autos/costos/${id}`, data),
  delete: (id) => api.delete(`/autos/costos/${id}`),
  categorias: () => api.get('/autos/costos/categorias'),
  resumenPorCategoria: (params) => api.get('/autos/costos/resumen/por-categoria', { params }),
}

// Caja Diaria
export const cajaAPI = {
  movimientos: (params) => api.get('/autos/caja/movimientos/', { params }),
  resumenDiario: (fecha) => api.get('/autos/caja/resumen-diario', { params: { fecha } }),
  crearMovimiento: (data) => api.post('/autos/caja/movimientos/', data),
  eliminarMovimiento: (id) => api.delete(`/autos/caja/movimientos/${id}`),
  categorias: () => api.get('/autos/caja/categorias'),
  // Cierres
  cierres: (anio) => api.get('/autos/caja/cierres/', { params: { anio } }),
  calcularCierre: (mes, anio) => api.post(`/autos/caja/cierres/calcular/?mes=${mes}&anio=${anio}`),
  crearCierre: (data) => api.post('/autos/caja/cierres/', data),
}

// Operaciones
export const operacionesAPI = {
  list: (params) => api.get('/autos/operaciones/', { params }),
  get: (id) => api.get(`/autos/operaciones/${id}`),
  create: (data) => api.post('/autos/operaciones/', data),
  update: (id, data) => api.put(`/autos/operaciones/${id}`, data),
  delete: (id) => api.delete(`/autos/operaciones/${id}`),
  completar: (id, datos) => api.post(`/autos/operaciones/${id}/completar`, datos),
  cancelar: (id, motivo) => api.post(`/autos/operaciones/${id}/cancelar`, null, { params: { motivo } }),
  actualizarDocumentacion: (id, data) => api.patch(`/autos/operaciones/${id}/documentacion`, null, { params: data }),
  // Boleto de compra-venta
  getBoleto: (id) => api.get(`/autos/operaciones/${id}/boleto`),
  marcarBoletoImpreso: (id) => api.post(`/autos/operaciones/${id}/boleto/impreso`),
  cargarDatosBoleto: (id, datos) => api.post(`/autos/operaciones/${id}/boleto/cargar-datos`, datos),
  // Admin - recuperacion
  diagnostico: () => api.get('/autos/operaciones/admin/diagnostico'),
  recuperarOperaciones: (clienteId, factor = 1.15) => api.post(`/autos/operaciones/admin/recuperar-operaciones?cliente_id_default=${clienteId}&precio_venta_factor=${factor}`),
  corregirFechasCaja: () => api.post('/autos/operaciones/admin/corregir-fechas-caja'),
}

// Documentación
export const documentacionAPI = {
  getByUnidad: (unidadId) => api.get(`/autos/documentacion/unidad/${unidadId}`),
  update: (unidadId, data) => api.put(`/autos/documentacion/unidad/${unidadId}`, data),
  pendientes: () => api.get('/autos/documentacion/pendientes'),
  alertasVencimiento: (dias) => api.get('/autos/documentacion/alertas-vencimiento', { params: { dias_anticipacion: dias } }),
}

// Gastos Mensuales
export const gastosAPI = {
  mensuales: (mes, anio) => api.get('/autos/gastos/mensuales', { params: { mes, anio } }),
}

// Reportes
export const reportesAPI = {
  utilidad: (params) => api.get('/autos/reportes/utilidad', { params }),
  stock: () => api.get('/autos/reportes/stock'),
  ventasMensuales: (anio) => api.get('/autos/reportes/ventas-mensuales', { params: { anio } }),
  costosPorUnidad: (unidadId) => api.get('/autos/reportes/costos-por-unidad', { params: { unidad_id: unidadId } }),
  rentabilidadVendedores: (params) => api.get('/autos/reportes/rentabilidad-vendedores', { params }),
  antiguedadStock: () => api.get('/autos/reportes/antiguedad-stock'),
  comparativoMensual: (params) => api.get('/autos/reportes/comparativo-mensual', { params }),
}

// Dashboard
export const dashboardAPI = {
  resumen: () => api.get('/autos/dashboard/resumen'),
  metricasRapidas: () => api.get('/autos/dashboard/metricas-rapidas'),
  stockPorMarca: () => api.get('/autos/dashboard/stock-por-marca'),
}

// Cheques
export const chequesAPI = {
  // Recibidos
  recibidos: (params) => api.get('/autos/cheques/recibidos/', { params }),
  recibidosCartera: () => api.get('/autos/cheques/recibidos/cartera'),
  recibidosResumen: () => api.get('/autos/cheques/recibidos/resumen'),
  getRecibido: (id) => api.get(`/autos/cheques/recibidos/${id}`),
  createRecibido: (data) => api.post('/autos/cheques/recibidos/', data),
  updateRecibido: (id, data) => api.put(`/autos/cheques/recibidos/${id}`, data),
  deleteRecibido: (id) => api.delete(`/autos/cheques/recibidos/${id}`),
  depositarCheque: (id, data) => api.post(`/autos/cheques/recibidos/${id}/depositar`, data),
  cobrarCheque: (id) => api.post(`/autos/cheques/recibidos/${id}/cobrar`),
  endosarCheque: (id, data) => api.post(`/autos/cheques/recibidos/${id}/endosar`, data),
  rechazarCheque: (id, data) => api.post(`/autos/cheques/recibidos/${id}/rechazar`, data),

  // Emitidos
  emitidos: (params) => api.get('/autos/cheques/emitidos/', { params }),
  emitidosPendientes: () => api.get('/autos/cheques/emitidos/pendientes'),
  emitidosResumen: () => api.get('/autos/cheques/emitidos/resumen'),
  createEmitido: (data) => api.post('/autos/cheques/emitidos/', data),
  deleteEmitido: (id) => api.delete(`/autos/cheques/emitidos/${id}`),
  pagarCheque: (id, data) => api.post(`/autos/cheques/emitidos/${id}/pagar`, data),
  anularCheque: (id, data) => api.post(`/autos/cheques/emitidos/${id}/anular`, data),

  // Calendario y alertas
  calendario: (dias) => api.get('/autos/cheques/calendario', { params: { dias } }),
  alertas: () => api.get('/autos/cheques/alertas'),
}

// Búsqueda Global
export const busquedaAPI = {
  global: (q) => api.get('/autos/busqueda/global', { params: { q } }),
}

// Inteligencia de Negocio
export const inteligenciaAPI = {
  configuracion: () => api.get('/autos/inteligencia/configuracion'),
  actualizarConfiguracion: (clave, valor) => api.put(`/autos/inteligencia/configuracion/${clave}?valor=${valor}`),
  costoOportunidad: (params) => api.get('/autos/inteligencia/costo-oportunidad', { params }),
  roiPorMarca: (params) => api.get('/autos/inteligencia/roi-por-marca', { params }),
  roiPorModelo: (params) => api.get('/autos/inteligencia/roi-por-modelo', { params }),
  alertasRepricing: () => api.get('/autos/inteligencia/alertas-repricing'),
  resumen: () => api.get('/autos/inteligencia/resumen'),
  analisisUnidad: (id) => api.get(`/autos/inteligencia/analisis-unidad/${id}`),
}

// CRM - Interesados (Lista de Espera)
export const interesadosAPI = {
  list: (params) => api.get('/autos/interesados/', { params }),
  get: (id) => api.get(`/autos/interesados/${id}`),
  create: (data) => api.post('/autos/interesados/', data),
  update: (id, data) => api.put(`/autos/interesados/${id}`, data),
  delete: (id) => api.delete(`/autos/interesados/${id}`),
  desactivar: (id) => api.post(`/autos/interesados/${id}/desactivar`),
  buscarMatches: (id) => api.post(`/autos/interesados/buscar-matches/${id}`),
  notificacionesPendientes: () => api.get('/autos/interesados/notificaciones/pendientes'),
  notificacionesTodas: (params) => api.get('/autos/interesados/notificaciones/todas', { params }),
  actualizarNotificacion: (id, data) => api.put(`/autos/interesados/notificaciones/${id}`, data),
  marcarLeida: (id) => api.post(`/autos/interesados/notificaciones/${id}/marcar-leida`),
  marcarTodasLeidas: () => api.post('/autos/interesados/notificaciones/marcar-todas-leidas'),
  estadisticas: () => api.get('/autos/interesados/estadisticas'),
}

// Archivos (Legajo Digital)
export const archivosAPI = {
  listByUnidad: (unidadId, params) => api.get(`/autos/archivos/unidad/${unidadId}`, { params }),
  get: (id) => api.get(`/autos/archivos/${id}`),
  download: (id) => api.get(`/autos/archivos/${id}/download`, { responseType: 'blob' }),
  upload: (unidadId, formData) => api.post(`/autos/archivos/unidad/${unidadId}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  uploadMultiple: (unidadId, formData) => api.post(`/autos/archivos/unidad/${unidadId}/upload-multiple`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  delete: (id) => api.delete(`/autos/archivos/${id}`),
  tiposDocumento: () => api.get('/autos/archivos/tipos-documento'),
  resumenUnidad: (unidadId) => api.get(`/autos/archivos/unidad/${unidadId}/resumen`),
}

// Marketing
export const marketingAPI = {
  fichaVenta: (unidadId) => api.get(`/autos/marketing/ficha-venta/${unidadId}`),
  fichaVentaHtml: (unidadId) => `${API_URL}/autos/marketing/ficha-venta/${unidadId}/html`,
  compartir: (unidadId) => api.get(`/autos/marketing/compartir/${unidadId}`),
}

// Precios de Mercado
export const preciosMercadoAPI = {
  // Consultar precio de una unidad en stock (usa cache)
  consultarUnidad: (id, forzar = false) => api.post(`/autos/precios-mercado/consultar/${id}`, null, { params: { forzar } }),
  // Consultar precio manual (sin guardar en BD)
  consultarManual: (data) => api.post('/autos/precios-mercado/consultar', data),
  // Calcular precio de compra maximo para retoma
  calcularToma: (data) => api.post('/autos/precios-mercado/calcular-toma', data),
  // Configuracion
  configuracion: () => api.get('/autos/precios-mercado/configuracion'),
  actualizarConfiguracion: (clave, valor) => api.put(`/autos/precios-mercado/configuracion/${clave}?valor=${valor}`),
  // Admin - actualizar precios vencidos
  actualizarVencidos: (limite = 10) => api.post('/autos/precios-mercado/actualizar-vencidos', null, { params: { limite } }),
  // Listar stock con precios de mercado
  stockConPrecios: (params) => api.get('/autos/precios-mercado/stock-con-precios', { params }),
}

// MercadoLibre
export const mercadolibreAPI = {
  // OAuth
  status: () => api.get('/autos/mercadolibre/status'),
  getAuthUrl: () => api.get('/autos/mercadolibre/auth-url'),
  disconnect: () => api.post('/autos/mercadolibre/disconnect'),

  // Catálogo
  categories: () => api.get('/autos/mercadolibre/categories'),
  listingTypes: () => api.get('/autos/mercadolibre/listing-types'),

  // Publicación
  publish: (unidadId, data) => api.post(`/autos/mercadolibre/unidades/${unidadId}/publish`, data),
  sync: (unidadId) => api.put(`/autos/mercadolibre/unidades/${unidadId}/sync`),
  pause: (unidadId) => api.post(`/autos/mercadolibre/unidades/${unidadId}/pause`),
  activate: (unidadId) => api.post(`/autos/mercadolibre/unidades/${unidadId}/activate`),
  close: (unidadId) => api.delete(`/autos/mercadolibre/unidades/${unidadId}`),
  getStatus: (unidadId) => api.get(`/autos/mercadolibre/unidades/${unidadId}/status`),
}

// Peritajes (Inspección Vehicular)
export const peritajesAPI = {
  // CRUD
  list: (params) => api.get('/autos/peritajes/', { params }),
  get: (id) => api.get(`/autos/peritajes/${id}`),
  create: (data) => api.post('/autos/peritajes/', data),
  update: (id, data) => api.put(`/autos/peritajes/${id}`, data),
  delete: (id) => api.delete(`/autos/peritajes/${id}`),

  // Items del checklist
  getItemsSector: (peritajeId, sector) => api.get(`/autos/peritajes/${peritajeId}/items/${sector}`),
  calificarItem: (peritajeId, itemId, data) => api.put(`/autos/peritajes/${peritajeId}/items/${itemId}`, data),
  calificarItemsBatch: (peritajeId, items) => api.put(`/autos/peritajes/${peritajeId}/items/batch`, items),

  // Fotos
  subirFoto: (peritajeId, formData) => api.post(`/autos/peritajes/${peritajeId}/fotos`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  eliminarFoto: (peritajeId, fotoId) => api.delete(`/autos/peritajes/${peritajeId}/fotos/${fotoId}`),

  // Acciones
  calcularPuntaje: (id) => api.post(`/autos/peritajes/${id}/calcular-puntaje`),
  completar: (id) => api.post(`/autos/peritajes/${id}/completar`),
  aprobar: (id, data) => api.post(`/autos/peritajes/${id}/aprobar`, data),

  // Integración con CalculadoraRetoma
  getPuntajeEstado: (id) => api.get(`/autos/peritajes/${id}/puntaje-estado`),

  // PDF
  getPdfUrl: (id, incluirFotos = true) => `${API_URL}/autos/peritajes/${id}/pdf?incluir_fotos=${incluirFotos}`,
}

// Actividades (Historial)
export const actividadesAPI = {
  list: (params) => api.get('/autos/actividades/', { params }),
  recientes: () => api.get('/autos/actividades/recientes'),
}

// Proveedores
export const proveedoresAPI = {
  list: (params) => api.get('/autos/proveedores/', { params }),
  get: (id) => api.get(`/autos/proveedores/${id}`),
  create: (data) => api.post('/autos/proveedores/', data),
  update: (id, data) => api.put(`/autos/proveedores/${id}`, data),
  delete: (id) => api.delete(`/autos/proveedores/${id}`),
  estadisticas: () => api.get('/autos/proveedores/estadisticas'),
  costos: (id, params) => api.get(`/autos/proveedores/${id}/costos`, { params }),
}

// Seguimientos / Agenda
export const seguimientosAPI = {
  list: (params) => api.get('/autos/seguimientos/', { params }),
  misPendientes: () => api.get('/autos/seguimientos/mis-pendientes'),
  create: (data) => api.post('/autos/seguimientos/', data),
  update: (id, data) => api.put(`/autos/seguimientos/${id}`, data),
  completar: (id, data) => api.post(`/autos/seguimientos/${id}/completar`, data),
  cancelar: (id) => api.post(`/autos/seguimientos/${id}/cancelar`),
  delete: (id) => api.delete(`/autos/seguimientos/${id}`),
}

export default api
