import { useRef, useEffect } from 'react';

export function usePanning(
  schedulerRef: React.RefObject<HTMLDivElement>,
  isSpacePressed: boolean
) {
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  const isSpacePressedRef = useRef(false);

  // Update ref when state changes
  useEffect(() => {
    isSpacePressedRef.current = isSpacePressed;
    
    // Update cursor when space is first pressed
    if (schedulerRef.current && isSpacePressed && !isPanningRef.current) {
      schedulerRef.current.style.cursor = 'grab';
    } else if (schedulerRef.current && !isSpacePressed && !isPanningRef.current) {
      schedulerRef.current.style.cursor = 'default';
    }
  }, [isSpacePressed, schedulerRef]);

  // Panning with middle mouse button or space+left click
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      // Check if it's middle button or space+left button
      const isMiddle = e.button === 1;
      const isSpaceWithLeft = isSpacePressedRef.current && e.button === 0;
      
      if (!isMiddle && !isSpaceWithLeft) return;
      
      // Check if we're clicking on interactive elements
      const target = e.target as HTMLElement;
      const isInteractive = 
        target.closest('button') ||
        target.closest('input') ||
        target.closest('textarea') ||
        target.closest('[role="menu"]') ||
        target.closest('.toolbar-panel');
      
      if (isInteractive) return;
      
      // For space+left, also skip if clicking on event handles
      if (isSpaceWithLeft) {
        const isHandle = target.closest('.handle-container');
        if (isHandle) return;
      }
      
      // Prevent default behavior (especially browser autoscroll for middle button)
      e.preventDefault();
      e.stopPropagation();
      
      const scheduler = schedulerRef.current;
      if (!scheduler) return;
      
      isPanningRef.current = true;
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        scrollLeft: scheduler.scrollLeft,
        scrollTop: scheduler.scrollTop
      };
      scheduler.style.cursor = 'grabbing';
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isPanningRef.current) return;
      
      const scheduler = schedulerRef.current;
      if (!scheduler) return;
      
      e.preventDefault();
      
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      scheduler.scrollLeft = panStartRef.current.scrollLeft - dx;
      scheduler.scrollTop = panStartRef.current.scrollTop - dy;
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!isPanningRef.current) return;
      
      // Accept any button release when panning is active
      if (e.button === 1 || e.button === 0) {
        e.preventDefault();
        
        isPanningRef.current = false;
        const scheduler = schedulerRef.current;
        if (scheduler) {
          scheduler.style.cursor = isSpacePressedRef.current ? 'grab' : 'default';
        }
      }
    };
    
    // Prevent context menu on middle button or when panning
    const handleContextMenu = (e: MouseEvent) => {
      if (isPanningRef.current || e.button === 1) {
        e.preventDefault();
      }
    };

    // Attach to document to catch all events
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [schedulerRef]);

  return { isPanningRef };
}
