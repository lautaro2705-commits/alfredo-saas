import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

/**
 * Exporta datos a un archivo Excel (.xlsx) con múltiples hojas.
 *
 * @param {Object} options
 * @param {string} options.filename - Nombre del archivo sin extensión
 * @param {Array} options.sheets - Array de hojas:
 *   { name: string, data: Array<object>, columns: Array<{ header, key, width?, format? }> }
 *
 * Ejemplo:
 *   exportToExcel({
 *     filename: 'gastos-enero-2025',
 *     sheets: [{
 *       name: 'Gastos',
 *       data: [{ fecha: '2025-01-05', concepto: 'Nafta', monto: 15000 }],
 *       columns: [
 *         { header: 'Fecha', key: 'fecha', width: 14 },
 *         { header: 'Concepto', key: 'concepto', width: 30 },
 *         { header: 'Monto', key: 'monto', width: 16, format: 'currency' },
 *       ]
 *     }]
 *   })
 */
export function exportToExcel({ filename, sheets }) {
  const wb = XLSX.utils.book_new()

  for (const sheet of sheets) {
    const { name, data, columns } = sheet

    // Construir filas: header + datos
    const headers = columns.map(c => c.header)
    const rows = data.map(row =>
      columns.map(col => {
        const val = row[col.key]
        if (val === null || val === undefined) return ''
        if (col.format === 'currency' && typeof val === 'number') {
          return val // Dejamos el número sin formatear para que Excel lo maneje
        }
        return val
      })
    )

    const wsData = [headers, ...rows]
    const ws = XLSX.utils.aoa_to_sheet(wsData)

    // Anchos de columna
    ws['!cols'] = columns.map(c => ({ wch: c.width || 15 }))

    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31)) // Excel limita a 31 chars
  }

  // Generar y descargar
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([wbout], { type: 'application/octet-stream' })
  saveAs(blob, `${filename}.xlsx`)
}

/**
 * Formatea un número como moneda para mostrar en las hojas
 */
export function formatCurrencyExcel(value) {
  if (!value && value !== 0) return ''
  return Math.round(value)
}
