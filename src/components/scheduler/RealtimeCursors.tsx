import React, { memo, useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { usePresence, CursorData } from '../../contexts/PresenceContext';
import { useSettings } from '../../contexts/SettingsContext';

const WEEKS_IN_YEAR = 52;
const GAP_OFFSET = 8;
const FADE_START_MS = 25000; // Start fade 5 seconds before removal (30s - 5s)

export interface ResourceLayoutItem {
  resourceId: string;
  /** Y offset in pixels from top of scroll content */
  yOffset: number;
  /** Height of this resource row in pixels */
  height: number;
}

/** Один курсор другого пользователя */
const RemoteCursor = memo(({ cursor, localWeekPx, localSidebarWidth, localEventRowH, localTopHeight, resourceYMap, isFading }: { 
  cursor: CursorData; 
  localWeekPx: number;
  localSidebarWidth: number;
  localEventRowH: number;
  localTopHeight: number;
  resourceYMap?: Map<string, number>;
  isFading: boolean;
}) => {
  const name = cursor.displayName
    ? cursor.displayName.split(' ')[0]
    : cursor.email?.split('@')[0] || '?';

  // ✅ Rescale X using normalized weekFloat (если доступен)
  let displayX: number;
  if (cursor.weekFloat != null) {
    const localGridX = cursor.weekFloat * localWeekPx;
    displayX = localGridX;
    
    const maxGridX = WEEKS_IN_YEAR * localWeekPx;
    if (localGridX < 0 || localGridX > maxGridX) {
      return null;
    }
  } else {
    const eventsLayerOffsetX = localSidebarWidth + GAP_OFFSET;
    displayX = cursor.contentX - eventsLayerOffsetX;
  }

  // ✅ Rescale Y: use resourceId-based positioning if available
  let displayY: number;
  if (cursor.resourceId && resourceYMap) {
    if (resourceYMap.has(cursor.resourceId)) {
      // Resource-based: find local Y of this resource, add fractional offset within row
      const resourceY = resourceYMap.get(cursor.resourceId)!;
      const fraction = cursor.resourceOffsetFraction ?? 0.5;
      displayY = resourceY + fraction * localEventRowH;
    } else {
      // Resource is filtered out on this client — hide cursor
      return null;
    }
  } else if (cursor.rowFloat != null) {
    displayY = localTopHeight + cursor.rowFloat * localEventRowH;
  } else {
    displayY = cursor.contentY;
  }

  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: displayX,
        top: displayY,
        transform: 'translate(-2px, -2px)',
        zIndex: 200,
        transition: 'left 80ms linear, top 80ms linear, opacity 5s ease-in-out',
        opacity: isFading ? 0 : 1,
      }}
    >
      {/* SVG cursor arrow */}
      <svg
        width="14"
        height="18"
        viewBox="0 0 16 20"
        fill="none"
        style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.2))' }}
      >
        <path
          d="M0.928 0.639L14.214 10.779H7.235L4.398 18.282L0.928 0.639Z"
          fill={cursor.color}
          stroke="white"
          strokeWidth="0.8"
        />
      </svg>
      
      {/* Name label */}
      <div
        className="absolute left-3 top-3.5 flex items-center px-1.5 py-0.5 rounded-[4px] whitespace-nowrap"
        style={{
          backgroundColor: cursor.color,
          boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
        }}
      >
        <span className="text-white text-[9px] font-medium leading-[12px]">
          {name}
        </span>
      </div>
    </div>
  );
});

RemoteCursor.displayName = 'RemoteCursor';

interface RealtimeCursorsProps {
  /** Ref на scroll container планировщика */
  scrollContainerRef?: React.RefObject<HTMLDivElement>;
  /** Левый отступ sidebar */
  sidebarWidth: number;
  /** Верхний отступ (месяцы + недели) */
  topHeight: number;
  /** Layout items for resource-based cursor positioning */
  resourceLayoutItems?: ResourceLayoutItem[];
}

/**
 * RealtimeCursors — рендерит курсоры других пользователей ВНУТРИ scroll container.
 * Отслеживает mousemove на scroll container, конвертирует в content-relative координаты.
 * Скрывает курсор при выходе за пределы сетки или при открытых модалках.
 */
export const RealtimeCursors = memo(function RealtimeCursors({
  scrollContainerRef,
  sidebarWidth,
  topHeight,
  resourceLayoutItems,
}: RealtimeCursorsProps) {
  const { cursors, updateCursor, hideCursor, isAvailable, registerScrollContainer } = usePresence();
  const { weekPx, eventRowH } = useSettings();
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<{ contentX: number; contentY: number } | null>(null);
  const isInsideGridRef = useRef(false);
  const [tick, forceUpdate] = useState(0);

  // Build resourceYMap for receiver-side lookup (resourceId -> yOffset)
  const resourceYMap = useMemo(() => {
    if (!resourceLayoutItems || resourceLayoutItems.length === 0) return undefined;
    const map = new Map<string, number>();
    for (const item of resourceLayoutItems) {
      map.set(item.resourceId, item.yOffset);
    }
    return map;
  }, [resourceLayoutItems]);

  // ✅ Check for fade threshold every second (only when cursors exist)
  useEffect(() => {
    if (!isAvailable || cursors.length === 0) return;
    
    const interval = setInterval(() => {
      forceUpdate(prev => prev + 1);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isAvailable, cursors.length]);

  // Register scroll container for scroll-to-user feature
  useEffect(() => {
    if (scrollContainerRef?.current) {
      registerScrollContainer(scrollContainerRef.current, sidebarWidth, topHeight);
    }
    return () => registerScrollContainer(null, 0, 0);
  }, [scrollContainerRef?.current, sidebarWidth, topHeight, registerScrollContainer]);

  // Check if any modal/dropdown/popover is open
  const isOverlayOpen = useCallback((): boolean => {
    const overlays = document.querySelectorAll(
      '[role="dialog"], [data-radix-popper-content-wrapper], [data-state="open"][role="menu"]'
    );
    return overlays.length > 0;
  }, []);

  // Helper: find resourceId from contentY
  const findResourceAtY = useCallback((contentY: number): { resourceId: string; fraction: number } | null => {
    if (!resourceLayoutItems || resourceLayoutItems.length === 0) return null;
    
    for (const item of resourceLayoutItems) {
      if (contentY >= item.yOffset && contentY < item.yOffset + item.height) {
        const fraction = (contentY - item.yOffset) / item.height;
        return { resourceId: item.resourceId, fraction: Math.max(0, Math.min(1, fraction)) };
      }
    }
    return null;
  }, [resourceLayoutItems]);

  // Mouse tracking on scroll container
  useEffect(() => {
    if (!isAvailable || !scrollContainerRef?.current) return;
    const scrollEl = scrollContainerRef.current;

    const handleMouseMove = (e: MouseEvent) => {
      if (isOverlayOpen()) {
        if (isInsideGridRef.current) {
          isInsideGridRef.current = false;
          hideCursor();
        }
        return;
      }

      const rect = scrollEl.getBoundingClientRect();
      const clientX = e.clientX;
      const clientY = e.clientY;

      const relX = clientX - rect.left;
      const relY = clientY - rect.top;

      if (relX < sidebarWidth || relY < topHeight || relX > rect.width || relY > rect.height) {
        if (isInsideGridRef.current) {
          isInsideGridRef.current = false;
          hideCursor();
        }
        return;
      }

      isInsideGridRef.current = true;

      const contentX = relX + scrollEl.scrollLeft;
      const contentY = relY + scrollEl.scrollTop;

      pendingRef.current = { contentX, contentY };

      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          if (pendingRef.current) {
            const { contentX: cx, contentY: cy } = pendingRef.current;
            
            // Find which resource the cursor is on
            const resourceHit = findResourceAtY(cy);
            
            updateCursor(
              cx, cy, weekPx, sidebarWidth, eventRowH, topHeight,
              resourceHit?.resourceId,
              resourceHit?.fraction
            );
            pendingRef.current = null;
          }
          rafRef.current = null;
        });
      }
    };

    const handleMouseLeave = () => {
      if (isInsideGridRef.current) {
        isInsideGridRef.current = false;
        hideCursor();
      }
    };

    scrollEl.addEventListener('mousemove', handleMouseMove, { passive: true });
    scrollEl.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      scrollEl.removeEventListener('mousemove', handleMouseMove);
      scrollEl.removeEventListener('mouseleave', handleMouseLeave);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isAvailable, scrollContainerRef, sidebarWidth, topHeight, weekPx, eventRowH, updateCursor, hideCursor, isOverlayOpen, findResourceAtY]);

  // Hide cursor when modals open
  useEffect(() => {
    if (!isAvailable) return;

    const observer = new MutationObserver(() => {
      if (isOverlayOpen() && isInsideGridRef.current) {
        isInsideGridRef.current = false;
        hideCursor();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [isAvailable, hideCursor, isOverlayOpen]);

  // Filter cursors that are within the grid area
  const gridCursors = useMemo(() => {
    return cursors.filter(c => c.contentX > 0 && c.contentY > 0);
  }, [cursors]);

  if (!isAvailable || gridCursors.length === 0) return null;

  const now = Date.now();

  return (
    <>
      {gridCursors.map(cursor => (
        <RemoteCursor 
          key={cursor.userId} 
          cursor={cursor} 
          localWeekPx={weekPx}
          localSidebarWidth={sidebarWidth}
          localEventRowH={eventRowH}
          localTopHeight={topHeight}
          resourceYMap={resourceYMap}
          isFading={now - cursor.timestamp > FADE_START_MS}
        />
      ))}
    </>
  );
});