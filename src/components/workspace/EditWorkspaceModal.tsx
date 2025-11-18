import { useState } from 'react';
import { X, Calendar } from 'lucide-react';
import { Workspace } from '../../types/scheduler';
import { updateWorkspace } from '../../services/api/workspaces';

interface EditWorkspaceModalProps {
  workspace: Workspace;
  onClose: () => void;
  onUpdate: () => void;
}

export function EditWorkspaceModal({ workspace, onClose, onUpdate }: EditWorkspaceModalProps) {
  const currentYear = new Date().getFullYear();
  
  const [name, setName] = useState(workspace.name);
  const [year, setYear] = useState(workspace.timeline_year);
  const [isUpdating, setIsUpdating] = useState(false);
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
      setIsUpdating(true);
      setError(null);
      
      await updateWorkspace(workspace.id, {
        name: name.trim(),
        timeline_year: year
      });
      
      console.log('✅ Воркспейс обновлён:', { id: workspace.id, name: name.trim(), year });
      onUpdate();
    } catch (err: any) {
      console.error('❌ Ошибка обновления воркспейса:', err);
      setError(err.message || 'Ошибка при обновлении пространства');
      setIsUpdating(false);
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
            <h2 className="text-xl">Редактировать рабочее пространство</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
            disabled={isUpdating}
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
              disabled={isUpdating}
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
              disabled={isUpdating}
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
              disabled={isUpdating}
            >
              {isUpdating ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}