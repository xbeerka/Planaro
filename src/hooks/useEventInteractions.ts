import { useRef, useCallback } from 'react';
import { SchedulerEvent, Resource, Department, Project } from '../types/scheduler';
import { LayoutConfig, modelFromGeometry, topFor, heightFor, getResourceGlobalTop } from '../utils/schedulerLayout';
import { clamp, WEEKS, UNITS } from '../utils/scheduler';
import { calculateEventNeighbors } from '../utils/eventNeighbors';

interface UseEventInteractionsProps {
  config: LayoutConfig;
  resources: Resource[];
  visibleDepartments: Department[];
  events: SchedulerEvent[];
  projects: Project[];
  eventZOrder: Map<string, number>;
  onEventsUpdate: (updater: (events: SchedulerEvent[]) => SchedulerEvent[]) => void;
  onEventZOrderUpdate: (updater: (zOrder: Map<string, number>) => Map<string, number>) => void;
  onSaveHistory: (events: SchedulerEvent[], zOrder: Map<string, number>, projects: Project[]) => void; // ✅ ИСПРАВЛЕНО: добавили projects
  onEventUpdate: (id: string, event: Partial<SchedulerEvent>) => Promise<void>;
  eventsContainerRef: React.RefObject<HTMLDivElement>;
  setIsUserInteracting: (value: boolean) => void; // 🚫 Для отключения polling
  resetDeltaSyncTimer: () => void; // ✅ v3.3.5: Для блокировки Delta Sync после drag/resize
}

interface PointerState {
  type: 'drag' | 'resize';
  id: string;
  pointerId: number;
  el: HTMLElement;
  evData: SchedulerEvent;
  tableRect: DOMRect;
  [key: string]: any;
}

export function useEventInteractions({
  config,
  resources,
  visibleDepartments,
  events,
  projects,
  eventZOrder,
  onEventsUpdate,
  onEventZOrderUpdate,
  onSaveHistory,
  onEventUpdate,
  eventsContainerRef,
  setIsUserInteracting,
  resetDeltaSyncTimer
}: UseEventInteractionsProps) {
  const pointerStateRef = useRef<PointerState | null>(null);

  const startDrag = useCallback((
    e: React.PointerEvent,
    el: HTMLElement,
    evData: SchedulerEvent
  ) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const target = e.target as HTMLElement;
    if (target.setPointerCapture) {
      target.setPointerCapture(e.pointerId);
    }

    document.body.classList.add('dragging-mode');
    el.classList.add('dragging');

    const maxZ = Math.max(...Array.from(eventZOrder.values()), 0);
    onEventZOrderUpdate(prev => new Map(prev).set(evData.id, maxZ + 1));

    const tableRect = eventsContainerRef.current?.getBoundingClientRect();
    if (!tableRect) return;

    const startLeft = parseFloat(el.style.left || '0');
    const startTop = parseFloat(el.style.top || '0');
    const offsetX = e.clientX - tableRect.left - startLeft;
    const offsetY = e.clientY - tableRect.top - startTop;

    const initialModel = modelFromGeometry(
      startLeft,
      startTop,
      el.offsetWidth,
      el.offsetHeight,
      evData,
      resources,
      visibleDepartments,
      config
    );

    pointerStateRef.current = {
      type: 'drag',
      id: evData.id,
      pointerId: e.pointerId,
      offsetX,
      offsetY,
      el,
      evData: { ...evData },
      tableRect,
      lastValidModel: initialModel,
      startLeft,
      startTop
    };

    const onMove = (ev: PointerEvent) => {
      if (!pointerStateRef.current || pointerStateRef.current.pointerId !== ev.pointerId) return;

      const desiredLeftAbs = ev.clientX - pointerStateRef.current.tableRect.left - pointerStateRef.current.offsetX;
      const desiredTopAbs = ev.clientY - pointerStateRef.current.tableRect.top - pointerStateRef.current.offsetY;
      const cursorTopAbs = ev.clientY - pointerStateRef.current.tableRect.top;

      const desiredLeftRel = desiredLeftAbs - config.resourceW - config.cellPaddingLeft;
      const maxLeftRel = Math.max(0, (WEEKS - pointerStateRef.current.evData.weeksSpan) * config.weekPx);
      const clampedRel = clamp(desiredLeftRel, 0, maxLeftRel);
      const snappedWeek = Math.round(clampedRel / config.weekPx);
      const snappedRel = clamp(snappedWeek * config.weekPx, 0, maxLeftRel);
      const snappedLeftAbs = config.resourceW + snappedRel + config.cellPaddingLeft;

      const newModel = modelFromGeometry(
        snappedLeftAbs,
        cursorTopAbs,
        pointerStateRef.current.el.offsetWidth,
        pointerStateRef.current.el.offsetHeight,
        pointerStateRef.current.evData,
        resources,
        visibleDepartments,
        config
      );

      if (newModel) {
        pointerStateRef.current.lastValidModel = newModel;
      }

      if (pointerStateRef.current.lastValidModel) {
        const snappedTop = topFor(
          pointerStateRef.current.lastValidModel.resourceId,
          pointerStateRef.current.lastValidModel.unitStart,
          resources,
          visibleDepartments,
          config
        );
        
        pointerStateRef.current.el.style.left = `${snappedLeftAbs}px`;
        pointerStateRef.current.el.style.top = `${snappedTop}px`;
      }
    };

    const onUp = async (ev: PointerEvent) => {
      if (!pointerStateRef.current || pointerStateRef.current.pointerId !== ev.pointerId) return;

      el.releasePointerCapture(ev.pointerId);
      document.body.classList.remove('dragging-mode');
      el.classList.remove('dragging');

      // 🚫 ВКЛЮЧАЕМ polling обратно
      setIsUserInteracting(false);

      // ✅ v3.3.5: БЛОКИРУЕМ Delta Sync на 5 секунд после drag
      // Это предотвращает перезапись локальных изменений данными с сервера
      resetDeltaSyncTimer();
      console.log('⏸️ Drag завершён: блокировка Delta Sync на 5 сек');

      // Сохраняем данные перед очисткой состояния
      const savedState = pointerStateRef.current;
      
      // ✅ Немедленно очищаем состояние и удаляем обработчики для мгновенного отклика
      pointerStateRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);

      if (savedState.lastValidModel) {
        let newStart = savedState.lastValidModel.startWeek;
        const ws = savedState.evData.weeksSpan;
        newStart = clamp(newStart, 0, Math.max(0, WEEKS - ws));

        const updatedEvent = {
          ...savedState.evData,
          startWeek: newStart,
          resourceId: savedState.lastValidModel.resourceId,
          unitStart: savedState.lastValidModel.unitStart
        };

        console.log('📍 Перемещение завершено:', { 
          id: updatedEvent.id, 
          startWeek: updatedEvent.startWeek, 
          resourceId: updatedEvent.resourceId,
          unitStart: updatedEvent.unitStart
        });

        // 🔍 Проверяем, действительно ли событие изменилось (защита от ложных обновлений)
        const hasChanged = 
          updatedEvent.startWeek !== savedState.evData.startWeek ||
          updatedEvent.resourceId !== savedState.evData.resourceId ||
          updatedEvent.unitStart !== savedState.evData.unitStart;

        if (!hasChanged) {
          console.log('⏭️ Событие не изменилось - восстанавливаем DOM стили напрямую');
          
          // 🔧 Восстанавливаем исходные DOM стили напрямую
          // Важно: НЕ используем config.cellPaddingLeft/Right, т.к. для сросшихся событий они = 0
          // Поэтому просто пересчитываем из исходных данных события
          const correctWidth = savedState.originalWeeksSpan * config.weekPx - config.cellPaddingLeft - config.cellPaddingRight;
          const correctLeft = config.resourceW + savedState.originalStartWeek * config.weekPx + config.cellPaddingLeft;
          const correctTop = topFor(savedState.evData.resourceId, savedState.originalUnitStart, resources, visibleDepartments, config);
          const correctHeight = heightFor(savedState.originalUnitsTall, config);
          
          savedState.el.style.left = `${correctLeft}px`;
          savedState.el.style.top = `${correctTop}px`;
          savedState.el.style.width = `${correctWidth}px`;
          savedState.el.style.height = `${correctHeight}px`;
          
          return;
        }

        // ✅ Оптимистичное обновление UI (только если есть изменения)
        onEventsUpdate(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
        onSaveHistory(
          events.map(e => e.id === updatedEvent.id ? updatedEvent : e),
          eventZOrder,
          projects // ✅ ИСПРАВЛЕНО: добавили projects
        );

        // ✅ Обновление в базе данных происходит в фоне после завершения взаимодействия
        // Передаем ПОЛНЫЙ объект события для драга (startWeek, resourceId, unitStart меняются)
        onEventUpdate(updatedEvent.id, updatedEvent).catch(error => {
          console.error('❌ Ошибка обновления события при драге:', error);
        });
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    // 🚫 Отключаем polling
    setIsUserInteracting(true);
  }, [config, resources, visibleDepartments, events, projects, eventZOrder, onEventsUpdate, onEventZOrderUpdate, onSaveHistory, onEventUpdate, eventsContainerRef, setIsUserInteracting, resetDeltaSyncTimer]); // ✅ v3.3.5: добавили resetDeltaSyncTimer

  const startResize = useCallback((
    e: React.PointerEvent,
    el: HTMLElement,
    evData: SchedulerEvent,
    edges: { top?: boolean; bottom?: boolean; left?: boolean; right?: boolean }
  ) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const target = e.target as HTMLElement;
    if (target.setPointerCapture) {
      target.setPointerCapture(e.pointerId);
    }

    document.body.classList.add('dragging-mode');
    el.classList.add('dragging');
    el.classList.add('resizing'); // Скрываем внутренние скругления во время ресайза

    // Находим и помечаем соседние события того же проекта
    const affectedNeighbors: HTMLElement[] = [];
    const eventTop = evData.unitStart;
    const eventBottom = evData.unitStart + evData.unitsTall - 1;
    
    events.forEach(e => {
      if (e.id === evData.id) return;
      if (e.resourceId !== evData.resourceId) return;
      if (e.projectId !== evData.projectId) return;
      
      const eTop = e.unitStart;
      const eBottom = e.unitStart + e.unitsTall - 1;
      const hasVerticalOverlap = eventTop <= eBottom && eTop <= eventBottom;
      
      if (!hasVerticalOverlap) return;
      
      // Проверяем горизонтальную смежность
      const isLeftNeighbor = e.startWeek + e.weeksSpan === evData.startWeek;
      const isRightNeighbor = e.startWeek === evData.startWeek + evData.weeksSpan;
      
      if (isLeftNeighbor || isRightNeighbor) {
        const neighborEl = document.querySelector(`[data-event-id="${e.id}"]`) as HTMLElement;
        if (neighborEl) {
          neighborEl.classList.add('resizing');
          affectedNeighbors.push(neighborEl);
        }
      }
    });

    const maxZ = Math.max(...Array.from(eventZOrder.values()), 0);
    onEventZOrderUpdate(prev => new Map(prev).set(evData.id, maxZ + 1));

    const tableRect = eventsContainerRef.current?.getBoundingClientRect();
    if (!tableRect) return;

    const startLeft = parseFloat(el.style.left || '0');
    const startTop = parseFloat(el.style.top || '0');
    const startWidth = el.offsetWidth;
    const startHeight = el.offsetHeight;
    const startX = e.clientX;
    const startY = e.clientY;

    // 🔍 КРИТИЧНО: Вычисляем РЕАЛЬНЫЕ padding события ПЕРЕД ресайзом
    const neighborsMap = calculateEventNeighbors(events, projects);
    const neighborInfo = neighborsMap.get(evData.id);
    const hasAnyLeftNeighbor = neighborInfo?.hasAnyLeftNeighbor || false;
    const hasAnyRightNeighbor = neighborInfo?.hasAnyRightNeighbor || false;
    const realPaddingLeft = hasAnyLeftNeighbor ? 0 : config.cellPaddingLeft;
    const realPaddingRight = hasAnyRightNeighbor ? 0 : config.cellPaddingRight;

    pointerStateRef.current = {
      type: 'resize',
      id: evData.id,
      pointerId: e.pointerId,
      edges,
      startLeft,
      startTop,
      startWidth,
      startHeight,
      startX,
      startY,
      el,
      evData: { ...evData },
      tableRect,
      originalStartWeek: evData.startWeek,
      originalWeeksSpan: evData.weeksSpan,
      originalUnitStart: evData.unitStart,
      originalUnitsTall: evData.unitsTall,
      realPaddingLeft,
      realPaddingRight
    };

    const onMove = (ev: PointerEvent) => {
      if (!pointerStateRef.current || pointerStateRef.current.pointerId !== ev.pointerId) return;

      const dx = ev.clientX - pointerStateRef.current.startX;
      const dy = ev.clientY - pointerStateRef.current.startY;

      let newLeft = pointerStateRef.current.startLeft;
      let newTop = pointerStateRef.current.startTop;
      let newWidth = pointerStateRef.current.startWidth;
      let newHeight = pointerStateRef.current.startHeight;

      if (pointerStateRef.current.edges.left) {
        newLeft = pointerStateRef.current.startLeft + dx;
        newWidth = pointerStateRef.current.startWidth - dx;
      }
      if (pointerStateRef.current.edges.right) {
        newWidth = pointerStateRef.current.startWidth + dx;
      }
      if (pointerStateRef.current.edges.top) {
        newTop = pointerStateRef.current.startTop + dy;
        newHeight = pointerStateRef.current.startHeight - dy;
      }
      if (pointerStateRef.current.edges.bottom) {
        newHeight = pointerStateRef.current.startHeight + dy;
      }

      newWidth = Math.max(newWidth, 24);
      newHeight = Math.max(newHeight, 4);

      const maxLeftAbs = config.resourceW + (WEEKS * config.weekPx) - 10;
      newLeft = clamp(newLeft, config.cellPaddingLeft, maxLeftAbs);

      // Snap to grid
      if (pointerStateRef.current.edges.left || pointerStateRef.current.edges.right) {
        if (pointerStateRef.current.edges.left) {
          const deltaWeeks = Math.round(dx / config.weekPx);
          let newStartWeek = clamp(pointerStateRef.current.originalStartWeek + deltaWeeks, 0, WEEKS - 1);
          let newWeeksSpan = clamp(pointerStateRef.current.originalWeeksSpan - deltaWeeks, 1, WEEKS - newStartWeek);
          if (newStartWeek + newWeeksSpan > WEEKS) newWeeksSpan = WEEKS - newStartWeek;
          // 🔍 КРИТИЧНО: Используем РЕАЛЬНЫЕ padding (которые были применены при рендере)
          newWidth = newWeeksSpan * config.weekPx - pointerStateRef.current.realPaddingLeft - pointerStateRef.current.realPaddingRight;
          newLeft = config.resourceW + newStartWeek * config.weekPx + pointerStateRef.current.realPaddingLeft;
          // ✅ СОХРАНЯЕМ вычисленные значения для использования в onUp
          pointerStateRef.current.currentStartWeek = newStartWeek;
          pointerStateRef.current.currentWeeksSpan = newWeeksSpan;
        } else {
          // 🔍 КРИТИЧНО: Используем РЕАЛЬНЫЕ padding (которые были применены при рендере)
          let newWeeksSpan = Math.max(1, Math.round((newWidth + pointerStateRef.current.realPaddingLeft + pointerStateRef.current.realPaddingRight) / config.weekPx));
          newWeeksSpan = clamp(newWeeksSpan, 1, WEEKS - pointerStateRef.current.originalStartWeek);
          newWidth = newWeeksSpan * config.weekPx - pointerStateRef.current.realPaddingLeft - pointerStateRef.current.realPaddingRight;
          // ✅ СОХРАНЯЕМ вычисленные значения для использования в onUp
          pointerStateRef.current.currentWeeksSpan = newWeeksSpan;
        }
      }

      if (pointerStateRef.current.edges.top || pointerStateRef.current.edges.bottom) {
        if (pointerStateRef.current.edges.top) {
          const deltaUnits = Math.round(dy / config.unitStride);
          const newUnitStart = clamp(pointerStateRef.current.originalUnitStart + deltaUnits, 0, UNITS - 1);
          const newUnitsTall = clamp(pointerStateRef.current.originalUnitsTall - deltaUnits, 1, UNITS - newUnitStart);
          newHeight = heightFor(newUnitsTall, config);
          newTop = topFor(pointerStateRef.current.evData.resourceId, newUnitStart, resources, visibleDepartments, config);
        } else {
          const newUnitsTall = clamp(pointerStateRef.current.originalUnitsTall + Math.round(dy / config.unitStride), 1, UNITS - pointerStateRef.current.originalUnitStart);
          newHeight = heightFor(newUnitsTall, config);
        }
      }

      pointerStateRef.current.el.style.left = `${newLeft}px`;
      pointerStateRef.current.el.style.top = `${newTop}px`;
      pointerStateRef.current.el.style.width = `${Math.max(24, newWidth)}px`;
      pointerStateRef.current.el.style.height = `${newHeight}px`;
    };

    const onUp = async (ev: PointerEvent) => {
      if (!pointerStateRef.current || pointerStateRef.current.pointerId !== ev.pointerId) return;

      el.releasePointerCapture(ev.pointerId);
      document.body.classList.remove('dragging-mode');
      el.classList.remove('dragging');
      el.classList.remove('resizing'); // Восстанавливаем внутренние скругления после ресайза

      // Снимаем метку с соседних событий
      affectedNeighbors.forEach(neighborEl => {
        neighborEl.classList.remove('resizing');
      });

      // 🚫 ВКЛЮЧАЕМ polling обратно
      setIsUserInteracting(false);

      // ✅ v3.3.5: БЛОКИРУЕМ Delta Sync на 5 секунд после resize
      // Это предотвращает перезапись локальных изменений данными с сервера
      resetDeltaSyncTimer();
      console.log('⏸️ Resize завершён: блокировка Delta Sync на 5 сек');

      // Сохраняем данные перед очисткой состояния
      const savedState = pointerStateRef.current;
      const updatedEvent = { ...savedState.evData };

      if (savedState.edges.left || savedState.edges.right) {
        // ✅ ИСПОЛЬЗУЕМ сохранённые значения из onMove вместо пересчёта из gWidth!
        // Это гарантирует, что weeksSpan будет точно таким же, как был вычислен в onMove
        if (savedState.currentStartWeek !== undefined) {
          updatedEvent.startWeek = savedState.currentStartWeek;
        }
        if (savedState.currentWeeksSpan !== undefined) {
          updatedEvent.weeksSpan = savedState.currentWeeksSpan;
        }
      }

      if (savedState.edges.top || savedState.edges.bottom) {
        const gTop = parseFloat(savedState.el.style.top);
        const gHeight = parseFloat(savedState.el.style.height);

        const resourceTop = getResourceGlobalTop(updatedEvent.resourceId, resources, visibleDepartments, config);
        const withinRow = gTop - resourceTop - config.rowPaddingTop;
        updatedEvent.unitStart = clamp(Math.round(withinRow / config.unitStride), 0, UNITS - 1);
        updatedEvent.unitsTall = clamp(Math.round(gHeight / config.unitStride), 1, UNITS - updatedEvent.unitStart);
      }

      console.log('📏 Ресайз завершен:', { 
        id: updatedEvent.id, 
        startWeek: updatedEvent.startWeek, 
        weeksSpan: updatedEvent.weeksSpan,
        unitStart: updatedEvent.unitStart,
        unitsTall: updatedEvent.unitsTall
      });

      // ✅ Немедленно очищаем состояние и удаляем обработчики для мгновенного отклика
      pointerStateRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);

      // 🔍 Проверяем, действительно ли событие изменилось (защита от ложных обновлений)
      const hasChanged = 
        updatedEvent.startWeek !== savedState.originalStartWeek ||
        updatedEvent.weeksSpan !== savedState.originalWeeksSpan ||
        updatedEvent.unitStart !== savedState.originalUnitStart ||
        updatedEvent.unitsTall !== savedState.originalUnitsTall;

      if (!hasChanged) {
        console.log('⏭️ Событие не изменилось при ресайзе - восстанавливаем исходные стили');
        // ✅ ВОССТАНАВЛИВАЕМ исходные DOM стили, которые были ДО начала ресайза
        // Это предотвращает визуальные смещения из-за округлений в onMove
        savedState.el.style.left = `${savedState.startLeft}px`;
        savedState.el.style.top = `${savedState.startTop}px`;
        savedState.el.style.width = `${savedState.startWidth}px`;
        savedState.el.style.height = `${savedState.startHeight}px`;
        return;
      }

      // ✅ Оптимистичное обновление UI (только если есть изменения)
      onEventsUpdate(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
      onSaveHistory(
        events.map(e => e.id === updatedEvent.id ? updatedEvent : e),
        eventZOrder,
        projects // ✅ ИСПРАВЛЕНО: добавили projects
      );

      // ✅ Обновление в базе данных происходит в фоне после завершения взаимодействия
      // Передаем ПОЛНЫЙ объект события для ресайза (все поля могут измениться)
      onEventUpdate(updatedEvent.id, updatedEvent).catch(error => {
        console.error('❌ Ошибка обновления события при ресайзе:', error);
      });
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    // 🚫 Отключаем polling
    setIsUserInteracting(true);
  }, [config, resources, visibleDepartments, events, projects, eventZOrder, onEventsUpdate, onEventZOrderUpdate, onSaveHistory, onEventUpdate, eventsContainerRef, setIsUserInteracting, resetDeltaSyncTimer]); // ✅ v3.3.5: добавили resetDeltaSyncTimer

  return { startDrag, startResize };
}