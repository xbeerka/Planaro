import { useState, useEffect } from 'react';
import { useSettings } from '../../contexts/SettingsContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { displayMode, setDisplayMode } = useSettings();
  
  // Локальное состояние для изменений (применяется только по кнопке "Сохранить")
  const [localDisplayMode, setLocalDisplayMode] = useState(displayMode);
  
  // Обновляем локальное состояние при открытии модалки
  useEffect(() => {
    if (isOpen) {
      setLocalDisplayMode(displayMode);
    }
  }, [isOpen, displayMode]);
  
  const hasChanges = localDisplayMode !== displayMode;
  
  const handleSave = () => {
    console.log('⚙️ Сохранение настроек:', { from: displayMode, to: localDisplayMode });
    setDisplayMode(localDisplayMode);
    console.log('✅ Настройки сохранены');
    onClose();
  };
  
  const handleCancel = () => {
    // Сбрасываем локальное состояние
    setLocalDisplayMode(displayMode);
    onClose();
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-semibold mb-6">
          Настройки
        </h2>
        
        {/* Отображение проектов */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Режим отображения
          </label>
          <select
            value={localDisplayMode}
            onChange={(e) => setLocalDisplayMode(e.target.value as 'performance' | 'with-patterns')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="performance">Производительность</option>
            <option value="with-patterns">С паттернами</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            {localDisplayMode === 'performance' 
              ? 'Без паттернов и скруглений - максимальная производительность'
              : 'С визуальными паттернами и скруглениями'}
          </p>
        </div>
        
        {/* Футер с кнопками */}
        <div className="flex gap-3">
          <button
            onClick={handleCancel}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
              hasChanges
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}