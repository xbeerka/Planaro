import { useState } from 'react';
import { X, Calendar, Copy } from 'lucide-react';
import { Workspace } from '../../types/scheduler';
import { createWorkspace } from '../../services/api/workspaces';

interface CreateWorkspaceModalProps {
  existingWorkspaces: Workspace[];
  onClose: () => void;
  onCreate: () => void;
}

export function CreateWorkspaceModal({ existingWorkspaces, onClose, onCreate }: CreateWorkspaceModalProps) {
  const currentYear = new Date().getFullYear();
  
  const [name, setName] = useState('');
  const [year, setYear] = useState(currentYear);
  const [baseWorkspaceId, setBaseWorkspaceId] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Введите название пространства');
      return;
    }
    
    if (!year || year < 2000 || year > 2100) {
      setError('Введите корректный год (2000-2100)');
      return;
    }
    
    try {
      setIsCreating(true);
      setError(null);
      
      await createWorkspace({
        name: name.trim(),
        timeline_year: year,
        base_workspace_id: baseWorkspaceId || undefined
      });
      
      onCreate();
    } catch (err: any) {
      console.error('Failed to create workspace:', err);
      setError(err.message || 'Ошибка при создании пространства');
      setIsCreating(false);
    }
  };

  const generateYearOptions = () => {
    const years = [];
    for (let y = currentYear - 2; y <= currentYear + 5; y++) {
      years.push(y);
    }
    return years;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl">Создать рабочее пространство</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
            disabled={isCreating}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Workspace Name */}
          <div>
            <label className="block text-sm mb-2">
              Название пространства <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="Например: Планирование 2025"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isCreating}
              autoFocus
            />
          </div>

          {/* Year */}
          <div>
            <label className="block text-sm mb-2">
              Год календаря <span className="text-red-500">*</span>
            </label>
            <select
              value={year}
              onChange={(e) => {
                setYear(parseInt(e.target.value));
                setError(null);
              }}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isCreating}
            >
              {generateYearOptions().map((y) => (
                <option key={y} value={y}>
                  {y} {y === currentYear ? '(текущий)' : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1.5">
              На основе года будут построены недели с датами
            </p>
          </div>

          {/* Base Workspace (Optional) */}
          <div>
            <label className="block text-sm mb-2">
              Создать на основе
            </label>
            <select
              value={baseWorkspaceId}
              onChange={(e) => setBaseWorkspaceId(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isCreating}
            >
              <option value="">Новое пространство</option>
              {existingWorkspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name} ({ws.timeline_year})
                </option>
              ))}
            </select>
            {baseWorkspaceId ? (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Copy className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-blue-800">
                    <p className="mb-1">Будут скопированы:</p>
                    <ul className="list-disc list-inside space-y-0.5 text-blue-700">
                      <li>Департаменты</li>
                      <li>Пользователи</li>
                      <li>Проекты</li>
                    </ul>
                    <p className="mt-1 text-blue-600">События не копируются</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-green-800">
                    <p>Будет создан департамент <span className="font-medium">"Разработка"</span> по умолчанию</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-center"
              disabled={isCreating}
            >
              {isCreating ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}