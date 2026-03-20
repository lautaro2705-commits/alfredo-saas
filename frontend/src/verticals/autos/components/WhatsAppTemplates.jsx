import { useState } from 'react'
import { MessageCircle, Copy, ExternalLink, X, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'

/**
 * WhatsApp message templates for CRM.
 * Replaces variables like {nombre}, {vehiculo}, {precio} with actual values.
 */
const TEMPLATES = [
  {
    id: 'saludo',
    label: 'Saludo inicial',
    emoji: '👋',
    text: 'Hola {nombre}! Soy de {agencia}. Vi que te interesa el {vehiculo}. Tenes alguna consulta? Estoy para ayudarte!',
  },
  {
    id: 'disponible',
    label: 'Confirmar disponibilidad',
    emoji: '✅',
    text: 'Hola {nombre}! Te confirmo que el {vehiculo} sigue disponible. El precio publicado es {precio}. Queres coordinar una visita para verlo?',
  },
  {
    id: 'reserva',
    label: 'Oferta / Reserva',
    emoji: '🔒',
    text: 'Hola {nombre}! Queria comentarte que tenemos una oferta especial en el {vehiculo}. Si te interesa, podemos reservarlo con una seña. Hablamos?',
  },
  {
    id: 'seguimiento',
    label: 'Seguimiento',
    emoji: '📋',
    text: 'Hola {nombre}! Como estas? Te escribo para saber si seguís interesado/a en el {vehiculo}. Cualquier duda que tengas, estoy a disposicion.',
  },
  {
    id: 'nuevo_stock',
    label: 'Nuevo ingreso similar',
    emoji: '🆕',
    text: 'Hola {nombre}! Te aviso que nos ingreso un vehiculo que puede interesarte, similar a lo que buscabas. Queres que te pase los datos?',
  },
  {
    id: 'permuta',
    label: 'Ofrecer permuta',
    emoji: '🔄',
    text: 'Hola {nombre}! Te cuento que aceptamos permutas. Si tenes un vehiculo para entregar como parte de pago por el {vehiculo}, podemos evaluarlo. Te interesa?',
  },
  {
    id: 'financiacion',
    label: 'Financiacion',
    emoji: '💳',
    text: 'Hola {nombre}! Queria contarte que el {vehiculo} se puede financiar en cuotas. Tenemos varias opciones de pago. Queres que te arme un plan?',
  },
  {
    id: 'agradecimiento',
    label: 'Post-venta',
    emoji: '🙏',
    text: 'Hola {nombre}! Queria agradecerte por confiar en {agencia} para la compra de tu {vehiculo}. Cualquier cosa que necesites, no dudes en escribirme. Exitos!',
  },
]

function fillTemplate(template, vars) {
  return template
    .replace(/\{nombre\}/g, vars.nombre || 'cliente')
    .replace(/\{vehiculo\}/g, vars.vehiculo || 'vehiculo')
    .replace(/\{precio\}/g, vars.precio || 'consultar')
    .replace(/\{agencia\}/g, vars.agencia || 'nuestra agencia')
}

export default function WhatsAppTemplates({ telefono, nombre, vehiculo, precio, agencia, onClose }) {
  const [customText, setCustomText] = useState('')
  const [selectedId, setSelectedId] = useState(null)

  const vars = { nombre, vehiculo, precio, agencia }

  const handleSelect = (tpl) => {
    setSelectedId(tpl.id)
    setCustomText(fillTemplate(tpl.text, vars))
  }

  const handleSend = () => {
    if (!customText.trim()) return
    const phone = telefono?.replace(/\D/g, '') || ''
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(customText)}`
    window.open(url, '_blank')
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(customText)
      toast.success('Mensaje copiado')
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/40 rounded-lg">
              <MessageCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">Mensajes WhatsApp</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">{nombre} &middot; {telefono}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Templates grid */}
        <div className="p-4 overflow-y-auto flex-1">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> Selecciona una plantilla o edita el mensaje
          </p>

          <div className="grid grid-cols-2 gap-2 mb-4">
            {TEMPLATES.map(tpl => (
              <button
                key={tpl.id}
                onClick={() => handleSelect(tpl)}
                className={`p-3 rounded-xl border text-left text-sm transition-colors ${
                  selectedId === tpl.id
                    ? 'border-green-400 bg-green-50 dark:bg-green-950/30 dark:border-green-700'
                    : 'border-gray-200 dark:border-gray-700 hover:border-green-300 hover:bg-green-50/50 dark:hover:bg-green-950/20'
                }`}
              >
                <span className="text-lg">{tpl.emoji}</span>
                <p className="font-medium text-gray-900 dark:text-white mt-1">{tpl.label}</p>
              </button>
            ))}
          </div>

          {/* Editable message */}
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mensaje</label>
          <textarea
            rows={4}
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="Escribe o selecciona una plantilla..."
            className="input w-full resize-none"
          />
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
          <button
            onClick={handleCopy}
            disabled={!customText.trim()}
            className="flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <Copy className="w-4 h-4" />
            Copiar
          </button>
          <button
            onClick={handleSend}
            disabled={!customText.trim() || !telefono}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 shadow-lg shadow-green-600/20"
          >
            <ExternalLink className="w-4 h-4" />
            Abrir WhatsApp
          </button>
        </div>
      </div>
    </div>
  )
}
