import { useEffect, useCallback, useState, useRef } from 'react';

interface UseKeyboardShortcutsProps {
  onUndo: () => void;
  onRedo: () => void;
  onEscape?: () => void;
  onShowShortcuts?: () => void;
  onSetModeCursor?: () => void;
  onSetModeScissors?: () => void;
  onSetModeComment?: () => void;
  schedulerRef: React.RefObject<HTMLDivElement>;
  isAnyModalOpen?: boolean; // ✅ Блокирует mode-хоткеи при открытых модалках
}

export function useKeyboardShortcuts({
  onUndo,
  onRedo,
  onEscape,
  onShowShortcuts,
  onSetModeCursor,
  onSetModeScissors,
  onSetModeComment,
  schedulerRef,
  isAnyModalOpen = false
}: UseKeyboardShortcutsProps) {
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const isSpacePressedRef = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      
      if (e.code === 'Space' && !isTyping) {
        // Prevent browser scroll ALWAYS when Space is pressed (not typing)
        e.preventDefault();
        e.stopPropagation();
        
        if (!isSpacePressed) {
          setIsSpacePressed(true);
          isSpacePressedRef.current = true;
        }
      }

      if ((e.key === 'Control' || e.key === 'Meta') && !isCtrlPressed) {
        // Не активируем gap handles если зажаты другие модификаторы (Cmd+Shift+4 = скриншот)
        // или если открыта модалка/попап/дропдаун
        const hasOverlay = isAnyModalOpen || 
          document.querySelector('[data-radix-popper-content-wrapper]') !== null ||
          document.querySelector('[data-radix-dropdown-menu-content]') !== null ||
          document.querySelector('[role="dialog"]') !== null ||
          document.querySelector('[data-dropdown-open="true"]') !== null ||
          document.querySelector('.filter-dropdown-portal') !== null;
        if (!e.shiftKey && !e.altKey && !hasOverlay) {
          setIsCtrlPressed(true);
        }
      }

      // Если Ctrl/Cmd зажат и нажата любая другая клавиша — сбрасываем gap handles
      // (это комбинация типа Cmd+Shift+4, Cmd+C, Cmd+V и т.д.)
      if (isCtrlPressed && e.key !== 'Control' && e.key !== 'Meta') {
        setIsCtrlPressed(false);
      }

      // Undo: Cmd+Z / Ctrl+Z (без Shift)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z' && !isTyping) {
        e.preventDefault();
        console.log('⏪ Undo');
        onUndo();
      }

      // Redo: Cmd+Shift+Z / Ctrl+Shift+Z или Cmd+Y / Ctrl+Y
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z')) && !isTyping) {
        e.preventDefault();
        console.log('⏩ Redo');
        onRedo();
      }

      if (e.key === 'Escape' && onEscape) {
        onEscape();
      }

      // ✅ Ctrl/Cmd+F — фокус на ближайший видимый поиск
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        // Ищем видимые поля поиска с data-search-focus (приоритет: чем больше число, тем важнее)
        const searchInputs = Array.from(
          document.querySelectorAll<HTMLInputElement>('input[data-search-focus]')
        ).filter(el => {
          // Проверяем видимость: элемент должен быть в DOM и видим
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && getComputedStyle(el).visibility !== 'hidden';
        });

        if (searchInputs.length > 0) {
          e.preventDefault(); // Блокируем браузерный поиск
          // Сортируем по приоритету (data-search-focus="число"), берём максимальный
          searchInputs.sort((a, b) => {
            const pa = Number(a.dataset.searchFocus) || 0;
            const pb = Number(b.dataset.searchFocus) || 0;
            return pb - pa;
          });
          searchInputs[0].focus();
          searchInputs[0].select();
          console.log('🔍 Ctrl+F: фокус на поиск', searchInputs[0].dataset.searchFocus);
        }
        // Если нет поисковых полей — не блокируем, пусть сработает стандартный браузерный поиск
        return;
      }

      // Show keyboard shortcuts: ? (Shift + /)
      if (e.key === '?' && onShowShortcuts && !isTyping) {
        e.preventDefault();
        onShowShortcuts();
      }

      // Mode hotkeys: V/М = cursor, X/Ч = scissors, C/С = comment
      // ✅ Блокируем mode-хоткеи при открытых модалках
      if (!isTyping && !e.ctrlKey && !e.metaKey && !e.altKey && !isAnyModalOpen) {
        const key = e.key.toLowerCase();
        if ((key === 'v' || key === 'м') && onSetModeCursor) {
          e.preventDefault();
          onSetModeCursor();
        } else if ((key === 'x' || key === 'ч') && onSetModeScissors) {
          e.preventDefault();
          onSetModeScissors();
        } else if ((key === 'c' || key === 'с') && onSetModeComment) {
          e.preventDefault();
          onSetModeComment();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault(); // Prevent any residual space behavior
        setIsSpacePressed(false);
        isSpacePressedRef.current = false;
        // Reset cursor when space is released
        if (schedulerRef.current) {
          schedulerRef.current.style.cursor = 'default';
        }
      }

      if (e.key === 'Control' || e.key === 'Meta') {
        setIsCtrlPressed(false);
      }
    };

    // ✅ Сброс модификаторов при потере фокуса окна (фикс залипания Ctrl/Cmd)
    const handleBlur = () => {
      setIsSpacePressed(false);
      isSpacePressedRef.current = false;
      setIsCtrlPressed(false);
      if (schedulerRef.current) {
        schedulerRef.current.style.cursor = 'default';
      }
    };

    // ✅ Сброс при скрытии вкладки (скриншот macOS может не триггерить blur)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleBlur();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp, { passive: false });
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [onUndo, onRedo, onEscape, onShowShortcuts, onSetModeCursor, onSetModeScissors, onSetModeComment, isSpacePressed, isCtrlPressed, schedulerRef, isAnyModalOpen]);

  return { isSpacePressed, isCtrlPressed };
}