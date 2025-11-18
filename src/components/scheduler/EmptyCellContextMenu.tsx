import { useEffect, useRef } from 'react';

interface EmptyCellContextMenuProps {
  isVisible: boolean;
  x: number;
  y: number;
  hasCopiedEvent: boolean;
  onPaste: () => void;
  onClose: () => void;
}

export function EmptyCellContextMenu({ 
  isVisible, 
  x, 
  y, 
  hasCopiedEvent,
  onPaste, 
  onClose 
}: EmptyCellContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onClose();
      }
    };

    if (isVisible) {
      document.addEventListener('pointerdown', handlePointerDown, true);
      document.addEventListener('click', handleClick, true);
    }

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('click', handleClick, true);
    };
  }, [isVisible, onClose]);

  if (!isVisible) return null;

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
        className={`bg-transparent border-none px-2.5 py-1.5 text-left rounded-md ${
          hasCopiedEvent 
            ? 'cursor-pointer hover:bg-[#f5f9fc]' 
            : 'cursor-not-allowed opacity-50'
        }`}
        onClick={(e) => {
          if (hasCopiedEvent) {
            e.stopPropagation();
            onPaste();
          }
        }}
        disabled={!hasCopiedEvent}
      >
        Вставить
      </button>
    </div>
  );
}
