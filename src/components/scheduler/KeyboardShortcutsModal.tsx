interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  if (!isOpen) return null;

  // Detect OS for keyboard shortcuts
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  const shortcuts = [
    {
      category: 'История',
      items: [
        { keys: isMac ? ['⌘', 'Z'] : ['Ctrl', 'Z'], description: 'Отменить действие' },
        { keys: isMac ? ['⌘', '⇧', 'Z'] : ['Ctrl', 'Shift', 'Z'], description: 'Повторить действие' },
        { keys: isMac ? ['⌘', 'Y'] : ['Ctrl', 'Y'], description: 'Повторить (альтернатива)' },
      ]
    },
    {
      category: 'Навигация',
      items: [
        { keys: ['Space', '+', 'Drag'], description: 'Панорамирование' },
        { keys: ['Средняя кнопка'], description: 'Панорамирование' },
        { keys: isMac ? ['⌘', '+', 'Колесико'] : ['Ctrl', '+', 'Колесико'], description: 'Зум' },
      ]
    },
    {
      category: 'Интерфейс',
      items: [
        { keys: ['Esc'], description: 'Закрыть модалки/меню' },
        { keys: ['?'], description: 'Показать эту справку' },
      ]
    }
  ];

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold">⌨️ Горячие клавиши</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Закрыть"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="space-y-6">
          {shortcuts.map((section, idx) => (
            <div key={idx}>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                {section.category}
              </h3>
              <div className="space-y-2">
                {section.items.map((shortcut, sIdx) => (
                  <div key={sIdx} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <span className="text-gray-700">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, kIdx) => (
                        <span key={kIdx} className="flex items-center gap-1">
                          {kIdx > 0 && <span className="text-gray-400 text-xs mx-1">+</span>}
                          <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono shadow-sm">
                            {key}
                          </kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-500">
            Нажмите <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono">Esc</kbd> или кликните вне окна для закрытия
          </p>
        </div>
      </div>
    </div>
  );
}
