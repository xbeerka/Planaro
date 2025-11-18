import { useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  message: string;
  description?: string;
  type?: ToastType;
  onClose: () => void;
}

export function Toast({ message, description, type = 'info', onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);

    return () => clearTimeout(timer);
  }, [onClose]);

  // Определяем стили на основе типа
  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-green-600 text-white border-green-700';
      case 'error':
        return 'bg-red-600 text-white border-red-700';
      case 'warning':
        return 'bg-orange-600 text-white border-orange-700';
      case 'info':
      default:
        return 'bg-blue-600 text-white border-blue-700';
    }
  };

  return (
    <div
      className={`fixed top-4 right-4 rounded-lg shadow-lg p-4 z-[9999] min-w-[320px] max-w-md animate-slide-down border-l-4 ${getTypeStyles()}`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="font-semibold">
            {message}
          </div>
          {description && (
            <div className="text-sm mt-1 opacity-90">
              {description}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="opacity-70 hover:opacity-100 transition-opacity flex-shrink-0 text-xl leading-none"
          aria-label="Закрыть"
        >
          ×
        </button>
      </div>
    </div>
  );
}
