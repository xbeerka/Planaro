import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Resource } from '../../types/scheduler';

interface CommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (text: string) => void;
  pendingComment: { resourceId: string; week: number } | null;
  resources?: Resource[];
  year?: number;
  initialText?: string;
}

export function CommentModal({
  isOpen,
  onClose,
  onSave,
  pendingComment,
  resources = [],
  year = new Date().getFullYear(),
  initialText = ''
}: CommentModalProps) {
  const [text, setText] = useState(initialText);

  useEffect(() => {
    if (isOpen) {
      setText(initialText);
    }
  }, [isOpen, initialText]);

  const handleSave = () => {
    if (text.trim()) {
      onSave(text.trim());
      setText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
    // Ctrl/Cmd + Enter для быстрого сохранения
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleSave();
    }
  };

  if (!isOpen || !pendingComment) return null;

  // Получаем имя ресурса
  const resource = resources.find(r => r.id === pendingComment.resourceId);
  const resourceName = resource?.fullName || 'Неизвестный сотрудник';
  const week = pendingComment.week;

  // Вычисляем дату начала недели для отображения
  const getWeekStartDate = (weekIndex: number, year: number) => {
    const jan1 = new Date(year, 0, 1);
    const daysOffset = (weekIndex * 7) - jan1.getDay() + 1;
    const weekStart = new Date(year, 0, 1 + daysOffset);
    return weekStart;
  };

  const weekStart = getWeekStartDate(week, year);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl">
              Комментарий
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {resourceName} • Неделя {week + 1} ({formatDate(weekStart)} - {formatDate(weekEnd)})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div>
            
            <textarea
              id="comment-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Введите комментарий..."
              className="w-full min-h-[200px] px-3 py-2 border border-gray-300 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-2">
              Совет: Нажмите Ctrl+Enter для быстрого сохранения
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50 rounded-t-[0px] rounded-b-[32px]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={!text.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}