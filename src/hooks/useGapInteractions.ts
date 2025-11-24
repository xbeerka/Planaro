import { useRef, useCallback } from 'react';
import type { EventGap, SchedulerEvent, Project } from '../types/scheduler';
import type { LayoutConfig } from '../utils/schedulerLayout';
import { calculateGapResize } from '../utils/eventGaps';

interface UseGapInteractionsProps {
  config: LayoutConfig;
  onEventsUpdate: (updater: (events: SchedulerEvent[]) => SchedulerEvent[]) => void;
  onSaveHistory: (events: SchedulerEvent[], zOrder: Map<string, number>, projects: Project[]) => void;
  onEventUpdate: (id: string, event: Partial<SchedulerEvent>) => Promise<void>;
  eventZOrder: Map<string, number>;
  projects: Project[];
  setIsUserInteracting: (value: boolean) => void;
  resetDeltaSyncTimer: () => void;
  flushPendingChanges: (updateHistoryEventId?: (oldId: string, newId: string) => void) => Promise<void>;
  updateHistoryEventId: (oldId: string, newId: string) => void;
  events: SchedulerEvent[];
}

interface GapPointerState {
  gap: EventGap;
  pointerId: number;
  startX: number;
  startY: number;
  initialEvent1: SchedulerEvent;
  initialEvent2: SchedulerEvent;
}

export function useGapInteractions({
  config,
  onEventsUpdate,
  onSaveHistory,
  onEventUpdate,
  eventZOrder,
  projects,
  setIsUserInteracting,
  resetDeltaSyncTimer,
  flushPendingChanges,
  updateHistoryEventId,
  events,
}: UseGapInteractionsProps) {
  const gapPointerStateRef = useRef<GapPointerState | null>(null);
  
  // Используем refs для обработчиков чтобы избежать циклических зависимостей
  const onGapMoveRef = useRef<((e: PointerEvent) => void) | null>(null);
  const onGapEndRef = useRef<((e: PointerEvent) => void) | null>(null);
  
  // ✅ КРИТИЧНО: Сохраняем flushPendingChanges в ref чтобы иметь доступ в onGapEndRef
  const flushPendingChangesRef = useRef(flushPendingChanges);
  flushPendingChangesRef.current = flushPendingChanges;
  
  // ✅ КРИТИЧНО: Блокировка gap drag пока предыдущий flush не завершился
  const isFlushingRef = useRef(false);
  
  /**
   * Движение gap handle
   */
  onGapMoveRef.current = (e: PointerEvent) => {
    if (!gapPointerStateRef.current) return;
    
    const { gap } = gapPointerStateRef.current;
    const { startX, startY } = gapPointerStateRef.current;
    
    // Вычисляем delta в зависимости от типа gap
    let delta = 0;
    
    if (gap.type === 'vertical') {
      // Вертикальный gap: считаем delta в units
      const deltaY = e.clientY - startY;
      delta = Math.round(deltaY / config.unitStride);
    } else {
      // Горизонтальный gap: считаем delta в weeks
      const deltaX = e.clientX - startX;
      delta = Math.round(deltaX / config.weekPx);
    }
    
    // Вычисляем новые размеры событий + прилипшие события
    // Передаём allEvents для поиска прилипших событий
    const allEvents = events;
    
    const result = calculateGapResize(gap, delta, allEvents);
    
    if (!result) {
      // Невалидное изменение - игнорируем
      return;
    }
    
    const { event1Update, event2Update, attachedUpdates } = result;
    
    // Применяем изменения локально (без сохранения на сервер)
    onEventsUpdate(prevEvents => {
      return prevEvents.map(event => {
        if (event.id === gap.event1.id) {
          return { ...event, ...event1Update };
        }
        if (event.id === gap.event2.id) {
          return { ...event, ...event2Update };
        }
        // Проверяем прилипшие события
        if (attachedUpdates?.has(event.id)) {
          const update = attachedUpdates.get(event.id)!;
          return { ...event, ...update };
        }
        return event;
      });
    });
  };
  
  /**
   * Завершение перетаскивания gap handle
   */
  onGapEndRef.current = async (e: PointerEvent) => {
    if (!gapPointerStateRef.current) return;
    
    // ✅ КРИТИЧНО: Guard от повторного вызова
    // Сохраняем state локально и СРАЗУ очищаем ref
    const state = gapPointerStateRef.current;
    gapPointerStateRef.current = null;
    
    const { gap, startX, startY, initialEvent1, initialEvent2 } = state;
    
    // Удаляем слушатели
    if (onGapMoveRef.current) {
      document.removeEventListener('pointermove', onGapMoveRef.current);
    }
    if (onGapEndRef.current) {
      document.removeEventListener('pointerup', onGapEndRef.current);
      document.removeEventListener('pointercancel', onGapEndRef.current);
    }
    
    // Вычисляем финальный delta
    let delta = 0;
    
    if (gap.type === 'vertical') {
      const deltaY = e.clientY - startY;
      delta = Math.round(deltaY / config.unitStride);
    } else {
      const deltaX = e.clientX - startX;
      delta = Math.round(deltaX / config.weekPx);
    }
    
    // Получаем все события для поиска прилипших
    const allEvents = events;
    
    const result = calculateGapResize(gap, delta, allEvents);
    
    if (!result) {
      // Невалидное изменение - откатываем
      console.log('⚠️ Gap drag отменён: невалидное изменение');
      
      onEventsUpdate(prevEvents => {
        return prevEvents.map(event => {
          if (event.id === gap.event1.id) return initialEvent1;
          if (event.id === gap.event2.id) return initialEvent2;
          return event;
        });
      });
      
      setIsUserInteracting(false);
      return;
    }
    
    // Проверяем были ли реальные изменения
    const hasChanges = delta !== 0;
    
    if (!hasChanges) {
      console.log('⚠️ Gap drag завершён без изменений');
      setIsUserInteracting(false);
      return;
    }
    
    console.log('✅ Gap drag завершён с изменениями:', {
      delta,
      event1: result.event1Update,
      event2: result.event2Update,
      attachedCount: result.attachedUpdates?.size || 0,
    });
    
    const { event1Update, event2Update, attachedUpdates } = result;
    
    // Применяем финальные изменения (включая прилипшие события)
    onEventsUpdate(prevEvents => {
      return prevEvents.map(event => {
        if (event.id === gap.event1.id) {
          return { ...event, ...event1Update };
        }
        if (event.id === gap.event2.id) {
          return { ...event, ...event2Update };
        }
        // Проверяем прилипшие события
        if (attachedUpdates?.has(event.id)) {
          const update = attachedUpdates.get(event.id)!;
          return { ...event, ...update };
        }
        return event;
      });
    });
    
    // ✅ КРИТИЧНО: Сохраняем историю используя АКТУАЛЬНЫЙ state!
    // НЕ используем локальную переменную finalEvents - она может быть устаревшей!
    // Используем события из props (актуальный state после обновления)
    // Задержка через setTimeout(0) гарантирует что state обновился
    setTimeout(() => {
      onSaveHistory(events, eventZOrder, projects);
    }, 0);
    
    // ✅ БЛОКИРУЕМ Delta Sync на 5 секунд (как в обычном drag/resize)
    // Это предотвращает перезапись локальных изменений данными с сервера
    resetDeltaSyncTimer();
    console.log('⏸️ Gap drag завершён: блокировка Delta Sync на 5 сек');
    
    // 🔥 КРИТИЧНО: Добавляем все обновления в pending queue
    // ВАЖНО: AWAIT каждого вызова чтобы гарантировать добавление в pending queue!
    console.log('📦 Добавление gap изменений в pending queue...');
    await onEventUpdate(gap.event1.id, event1Update);
    await onEventUpdate(gap.event2.id, event2Update);
    
    // Добавляем прилипшие события
    if (attachedUpdates) {
      for (const [eventId, update] of attachedUpdates.entries()) {
        await onEventUpdate(eventId, update);
      }
    }
    
    console.log('📦 Все gap изменения добавлены в pending queue, запуск flush...');
    
    // ✅ КРИТИЧНО: Устанавливаем флаг что идёт flush
    isFlushingRef.current = true;
    
    // ✅ КРИТИЧНО: Сразу flush все pending операции!
    // Это гарантирует что ВСЕ изменения отправятся на сервер БЕЗ debounce задержки
    try {
      await flushPendingChangesRef.current();
      console.log('✅ Gap изменения сохранены на сервер через flush:', {
        mainEvents: 2,
        attachedEvents: attachedUpdates?.size || 0,
      });
    } catch (error) {
      console.error('❌ Ошибка flush gap изменений:', error);
    } finally {
      // ✅ КРИТИЧНО: Снимаем блокировку flush
      isFlushingRef.current = false;
    }
    
    setIsUserInteracting(false);
  };
  
  /**
   * Начало перетаскивания gap handle
   */
  const startGapDrag = useCallback((gap: EventGap, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // ✅ КРИТИЧНО: Блокируем gap drag если предыдущий flush ещё не завершился
    if (isFlushingRef.current) {
      console.log('⏸️ Gap drag заблокировн: предыдущий flush ещё выполняется');
      return;
    }
    
    // ✅ КРИТИЧНО: Блокируем Delta Sync СРАЗУ при начале gap drag!
    // Это предотвращает перезапись локальных изменений между gap drag операциями
    resetDeltaSyncTimer();
    console.log('⏸️ Gap drag начат: блокировка Delta Sync на 5 сек');
    
    // ✅ v3.3.7: Flush pending changes ПЕРЕД началом gap drag
    // Это гарантирует что все события с временными ID будут созданы на сервере
    // и получат реальные ID ДО того как gap drag попадёт в историю
    console.log('🚀 GAP DRAG: Flush pending операций перед началом gap drag');
    flushPendingChangesRef.current(updateHistoryEventId).catch(err => console.error('❌ Ошибка flush перед gap drag:', err));
    
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    
    console.log('🎯 Gap drag начат:', {
      type: gap.type,
      event1: gap.event1.id,
      event2: gap.event2.id,
      boundary: gap.type === 'vertical' ? gap.unitBoundary : gap.weekBoundary,
    });
    
    gapPointerStateRef.current = {
      gap,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      initialEvent1: { ...gap.event1 },
      initialEvent2: { ...gap.event2 },
    };
    
    // Блокируем polling во время drag
    setIsUserInteracting(true);
    
    // Добавляем слушатели (используем refs)
    if (onGapMoveRef.current) {
      document.addEventListener('pointermove', onGapMoveRef.current);
    }
    if (onGapEndRef.current) {
      document.addEventListener('pointerup', onGapEndRef.current);
      document.addEventListener('pointercancel', onGapEndRef.current);
    }
  }, [setIsUserInteracting, flushPendingChangesRef, updateHistoryEventId, resetDeltaSyncTimer]);
  
  return {
    startGapDrag,
  };
}