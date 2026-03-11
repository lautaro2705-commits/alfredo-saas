import Modal from './Modal'

const shortcuts = [
  {
    category: 'General',
    items: [
      { keys: ['⌘', 'K'], description: 'Buscar' },
      { keys: ['N'], description: 'Nuevo elemento' },
      { keys: ['?'], description: 'Atajos de teclado' },
      { keys: ['Esc'], description: 'Cerrar modal' },
    ],
  },
  {
    category: 'Navegacion  (G + tecla)',
    items: [
      { keys: ['G', 'D'], description: 'Dashboard' },
      { keys: ['G', 'S'], description: 'Stock' },
      { keys: ['G', 'C'], description: 'Clientes' },
      { keys: ['G', 'I'], description: 'Interesados' },
      { keys: ['G', 'V'], description: 'Ventas' },
      { keys: ['G', 'K'], description: 'Caja' },
      { keys: ['G', 'P'], description: 'Proveedores' },
      { keys: ['G', 'R'], description: 'Reportes' },
      { keys: ['G', 'A'], description: 'Agenda' },
    ],
  },
]

export default function KeyboardShortcutsModal({ isOpen, onClose }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Atajos de teclado" size="sm">
      <div className="p-6 space-y-6">
        {shortcuts.map(section => (
          <div key={section.category}>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              {section.category}
            </h3>
            <div className="space-y-2.5">
              {section.items.map(shortcut => (
                <div key={shortcut.description} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {shortcut.description}
                  </span>
                  <div className="flex items-center gap-1">
                    {shortcut.keys.map((key, i) => (
                      <span key={i} className="inline-flex items-center gap-0.5">
                        <kbd className="px-2 py-1 text-xs font-mono bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-gray-600 dark:text-gray-400 min-w-[28px] text-center shadow-sm">
                          {key}
                        </kbd>
                        {i < shortcut.keys.length - 1 && (
                          <span className="text-gray-300 dark:text-gray-600 text-xs">+</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        <p className="text-xs text-gray-400 text-center pt-2 border-t border-gray-100 dark:border-gray-800">
          Los atajos se desactivan al escribir en campos de texto
        </p>
      </div>
    </Modal>
  )
}
