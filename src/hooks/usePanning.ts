import { useRef, useEffect } from 'react';

/**
 * usePanning - Hook for middle-mouse and space+drag panning
 * 
 * Works with the scrollable panel ref (rightRef from SchedulerGrid).
 * Handles both middle mouse button (button 1) and space+left mouse button.
 * 
 * ARCHITECTURE NOTE:
 * SchedulerGrid has two panels:
 * - Left panel (resources): Fixed width 284px, z-index 300, overflowX: hidden
 * - Right panel (timeline): Scrollable in both directions, z-index lower
 * 
 * When user clicks middle button on LEFT panel, the events are captured by left panel
 * (due to higher z-index), but we want to scroll the RIGHT panel (which has overflow).
 * 
 * Solution: Listen to mousedown on document (capture phase), and always scroll the right panel.
 * 
 * @param scrollableRef - Reference to the scrollable container (right panel)
 * @param isSpacePressed - Whether space key is currently pressed
 */
export function usePanning(
  scrollableRef: React.RefObject<HTMLDivElement>,
  isSpacePressed: boolean
) {
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  const isSpacePressedRef = useRef(false);

  // Update ref when state changes
  useEffect(() => {
    isSpacePressedRef.current = isSpacePressed;
    
    // Update cursor globally when space is pressed (but not panning yet)
    if (isSpacePressed && !isPanningRef.current) {
      document.body.style.cursor = 'grab';
    } else if (!isSpacePressed && !isPanningRef.current) {
      document.body.style.cursor = '';
    }
  }, [isSpacePressed]);

  // Panning with middle mouse button or space+left click
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      // Check if it's middle button or space+left button
      const isMiddle = e.button === 1;
      const isSpaceWithLeft = isSpacePressedRef.current && e.button === 0;
      
      if (!isMiddle && !isSpaceWithLeft) return;
      
      // Check if we're clicking on interactive elements (modals, inputs, buttons)
      const target = e.target as HTMLElement;
      const isInteractive = 
        target.closest('button') ||
        target.closest('input') ||
        target.closest('textarea') ||
        target.closest('select') ||
        target.closest('[role="menu"]') ||
        target.closest('[role="dialog"]') ||
        target.closest('.modal') ||
        target.closest('.dropdown-menu');
      
      if (isInteractive) return;
      
      // For space+left, also skip if clicking on event handles or draggable events
      if (isSpaceWithLeft) {
        const isHandle = target.closest('.handle-container') || target.closest('.gap-handle');
        const isEvent = target.closest('.scheduler-event');
        if (isHandle || isEvent) return;
      }
      
      // Get the scrollable container
      const scrollable = scrollableRef.current;
      if (!scrollable) {
        // console.warn('⚠️ usePanning: scrollableRef.current is null');
        return;
      }
      
      // Use a safer check than instanceof Element to avoid cross-frame issues
      // and check for required properties
      if (typeof scrollable.scrollLeft !== 'number') {
        console.warn('⚠️ usePanning: scrollableRef.current does not look like a scrollable element');
        return;
      }
      
      // Prevent default behavior (especially browser autoscroll for middle button)
      e.preventDefault();
      e.stopPropagation();
      
      isPanningRef.current = true;
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        scrollLeft: scrollable.scrollLeft,
        scrollTop: scrollable.scrollTop
      };
      
      // Set cursor to grabbing globally
      document.body.style.cursor = 'grabbing';
      
      // Safe logging with primitive values only
      const targetClassName = typeof target.className === 'string' 
        ? target.className 
        : (target.className && typeof target.className === 'object' && 'baseVal' in target.className)
          ? String((target.className as any).baseVal)
          : String(target.className);

      const scrollableClassName = typeof scrollable.className === 'string'
        ? scrollable.className
        : String(scrollable.className);

      // Panning started log removed to reduce noise
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isPanningRef.current) return;
      
      const scrollable = scrollableRef.current;
      if (!scrollable) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      
      const startScrollLeft = panStartRef.current.scrollLeft;
      const startScrollTop = panStartRef.current.scrollTop;
      
      // Apply scroll delta (inverted for natural panning feel)
      // Ensure values are valid numbers
      const newScrollLeft = Math.max(0, (startScrollLeft || 0) - dx);
      const newScrollTop = Math.max(0, (startScrollTop || 0) - dy);
      
      scrollable.scrollLeft = newScrollLeft;
      scrollable.scrollTop = newScrollTop;
      
      // Debug log removed to reduce noise (was logging every mouse move)
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!isPanningRef.current) return;
      
      // Accept any button release when panning is active
      if (e.button === 1 || e.button === 0) {
        e.preventDefault();
        e.stopPropagation();
        
        isPanningRef.current = false;
        
        // Restore cursor
        if (isSpacePressedRef.current) {
          document.body.style.cursor = 'grab';
        } else {
          document.body.style.cursor = '';
        }
      }
    };
    
    // Prevent context menu on middle button or when panning
    const handleContextMenu = (e: MouseEvent) => {
      if (isPanningRef.current || e.button === 1) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // Attach to document in CAPTURE PHASE to intercept events before they reach children
    // This is critical for catching events on the left panel (which has higher z-index)
    document.addEventListener('mousedown', handleMouseDown, true); // ✅ Capture phase!
    document.addEventListener('contextmenu', handleContextMenu, true); // ✅ Capture phase!
    window.addEventListener('mousemove', handleMouseMove, true); // ✅ Capture phase!
    window.addEventListener('mouseup', handleMouseUp, true); // ✅ Capture phase!

    return () => {
      document.removeEventListener('mousedown', handleMouseDown, true);
      document.removeEventListener('contextmenu', handleContextMenu, true);
      window.removeEventListener('mousemove', handleMouseMove, true);
      window.removeEventListener('mouseup', handleMouseUp, true);
      
      // Cleanup cursor on unmount
      document.body.style.cursor = '';
    };
  }, [scrollableRef]);

  return { isPanningRef };
}