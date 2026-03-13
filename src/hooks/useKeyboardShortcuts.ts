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
}

export function useKeyboardShortcuts({
  onUndo,
  onRedo,
  onEscape,
  onShowShortcuts,
  onSetModeCursor,
  onSetModeScissors,
  onSetModeComment,
  schedulerRef
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
        setIsCtrlPressed(true);
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

      // Show keyboard shortcuts: ? (Shift + /)
      if (e.key === '?' && onShowShortcuts && !isTyping) {
        e.preventDefault();
        onShowShortcuts();
      }

      // Mode hotkeys: V/М = cursor, X/Ч = scissors, C/С = comment
      if (!isTyping && !e.ctrlKey && !e.metaKey && !e.altKey) {
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

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp, { passive: false });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [onUndo, onRedo, onEscape, onShowShortcuts, onSetModeCursor, onSetModeScissors, onSetModeComment, isSpacePressed, isCtrlPressed, schedulerRef]);

  return { isSpacePressed, isCtrlPressed };
}