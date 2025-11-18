import { useEffect, useRef } from 'react';
import { SchedulerEvent } from '../../types/scheduler';

interface ContextMenuProps {
  isVisible: boolean;
  x: number;
  y: number;
  event: SchedulerEvent | null;
  onEdit: () => void;
  onDelete: () => void;
  onCopy?: () => void;
  onClose: () => void;
}

export function ContextMenu({ isVisible, x, y, event, onEdit, onDelete, onCopy, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        // Полностью блокируем событие, чтобы предотвратить любые действия под меню
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        // Блокируем клик-события, которые могли проскочить после pointerdown
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        // Закрываем меню ПОСЛЕ блокировки события, чтобы состояние не изменилось до блокировки
        onClose();
      }
    };

    if (isVisible) {
      // Используем pointerdown для перехвата ВСЕХ указательных событий (мышь, тач) ДО их обработки
      document.addEventListener('pointerdown', handlePointerDown, true);
      // Дополнительно блокируем click события для React onClick handlers и закрываем меню
      document.addEventListener('click', handleClick, true);
    }

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('click', handleClick, true);
    };
  }, [isVisible, onClose]);

  if (!isVisible || !event) return null;

  return (
    <div
      ref={menuRef}
      className="fixed bg-white border border-[#e6eef8] rounded-md shadow-lg flex flex-col gap-1 p-1.5 z-[5000]"
      style={{ left: x, top: y }}
      role="menu"
      aria-hidden={!isVisible}
    >
      <button
        role="menuitem"
        className="bg-transparent border-none px-2.5 py-1.5 text-left cursor-pointer rounded-md hover:bg-[#f5f9fc]"
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
      >
        Изменить
      </button>
      {onCopy && (
        <button
          role="menuitem"
          className="bg-transparent border-none px-2.5 py-1.5 text-left cursor-pointer rounded-md hover:bg-[#f5f9fc]"
          onClick={(e) => {
            e.stopPropagation();
            onCopy();
          }}
        >
          Копировать
        </button>
      )}
      <button
        role="menuitem"
        className="bg-transparent border-none px-2.5 py-1.5 text-left cursor-pointer rounded-md hover:bg-[#f5f9fc]"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        Удалить
      </button>
    </div>
  );
}
