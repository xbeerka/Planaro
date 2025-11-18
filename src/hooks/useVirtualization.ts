import { useState, useEffect, useCallback, RefObject } from 'react';

export interface VirtualizationState {
  visibleStartRow: number;
  visibleEndRow: number;
  visibleStartWeek: number;
  visibleEndWeek: number;
  overscan: number;
}

interface UseVirtualizationOptions {
  containerRef: RefObject<HTMLDivElement>;
  totalRows: number;
  rowHeight: number;
  totalWeeks: number;
  weekWidth: number;
  resourceWidth: number;
  overscan?: number;
}

/**
 * Hook для виртуализации календаря - рендерит только видимые строки и недели
 * Снижает количество DOM элементов с ~10000 до ~500 при 50 сотрудниках
 */
export function useVirtualization({
  containerRef,
  totalRows,
  rowHeight,
  totalWeeks,
  weekWidth,
  resourceWidth,
  overscan = 5
}: UseVirtualizationOptions): VirtualizationState {
  const [state, setState] = useState<VirtualizationState>({
    visibleStartRow: 0,
    visibleEndRow: Math.min(20, totalRows),
    visibleStartWeek: 0,
    visibleEndWeek: Math.min(20, totalWeeks),
    overscan
  });

  const updateVisibleRange = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const scrollTop = container.scrollTop;
    const scrollLeft = container.scrollLeft;
    const containerHeight = container.clientHeight;
    const containerWidth = container.clientWidth;

    // Вычисляем видимые строки с учетом sticky заголовков (72px)
    const stickyHeaderHeight = 72;
    const adjustedScrollTop = Math.max(0, scrollTop - stickyHeaderHeight);
    const startRow = Math.max(0, Math.floor(adjustedScrollTop / rowHeight) - overscan);
    const endRow = Math.min(
      totalRows,
      Math.ceil((scrollTop + containerHeight) / rowHeight) + overscan
    );

    // Вычисляем видимые недели с учетом sticky колонки ресурсов
    const adjustedScrollLeft = Math.max(0, scrollLeft - resourceWidth);
    const startWeek = Math.max(0, Math.floor(adjustedScrollLeft / weekWidth) - overscan);
    const endWeek = Math.min(
      totalWeeks,
      Math.ceil((scrollLeft + containerWidth - resourceWidth) / weekWidth) + overscan
    );

    setState({
      visibleStartRow: startRow,
      visibleEndRow: endRow,
      visibleStartWeek: startWeek,
      visibleEndWeek: endWeek,
      overscan
    });
  }, [containerRef, totalRows, rowHeight, totalWeeks, weekWidth, resourceWidth, overscan]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Инициализация
    updateVisibleRange();

    // Throttled scroll handler для производительности
    let rafId: number | null = null;
    const handleScroll = () => {
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          updateVisibleRange();
          rafId = null;
        });
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', updateVisibleRange, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', updateVisibleRange);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [containerRef, updateVisibleRange]);

  return state;
}
