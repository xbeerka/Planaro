import { useRef, useCallback, useLayoutEffect } from 'react';
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
  flushPendingChanges: (updateHistoryEventId?: (oldId: string, newId: string) => void) => Promise<void>; // ✅ v3.3.7: Flush pending operations перед drag/resize
  updateHistoryEventId: (oldId: string, newId: string) => void; // ✅ Для обновления истории после flush
  getEvents: () => { events: SchedulerEvent[], projects: Project[], eventZOrder: Map<string, number> }; // ✅ Функция для получения свежего снапшота
  eventNeighbors?: Map<string, any>; // ✅ Оптимизация: принимаем готовые соседи
}

interface PointerState {
  type: 'drag' | 'resize';
  id: string;
  pointerId: number;
  el: HTMLElement;
  evData: SchedulerEvent;
  tableRect: DOMRect;
  currentLeft?: number;
  currentTop?: number;
  currentWidth?: number;
  currentHeight?: number;
  startX?: number; // ✅ Added for click detection
  startY?: number; // ✅ Added for click detection
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
  resetDeltaSyncTimer,
  flushPendingChanges,
  updateHistoryEventId,
  getEvents, // ✅ Получаем функцию для доступа к снапшоту
  eventNeighbors
}: UseEventInteractionsProps) {
  // ✅ Используем refs для events/projects/zOrder чтобы избежать stale closures в асинхронных onUp
  // Это критично для корректной работы истории (Undo/Redo) и предотвращения "группировки" действий
  const eventsRef = useRef(events);
  const projectsRef = useRef(projects);
  const eventZOrderRef = useRef(eventZOrder);

  // Обновляем refs при изменении props
  eventsRef.current = events;
  projectsRef.current = projects;
  eventZOrderRef.current = eventZOrder;

  const pointerStateRef = useRef<PointerState | null>(null);

  const startDrag = useCallback((
    e: React.PointerEvent,
    el: HTMLElement,
    evData: SchedulerEvent
  ) => {
    if (e.button !== 0) return;
    
    // 🚫 БЛОКИРОВКА DRAG для временных событий
    if (evData.id.startsWith('ev_temp_')) {
      console.log('🚫 DRAG ЗАБЛОКИРОВАН: временное событие ещё создаётся на сервере:', evData.id);
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();

    // ✅ v3.3.7: Flush pending changes ПЕРЕД началом drag
    // Это гарантирует что все события с временными ID будут созданы на сервере
    // и получат реальные ID ДО того как drag попадёт в историю
    console.log('🚀 DRAG: Flush pending операций перед началом drag');
    flushPendingChanges(updateHistoryEventId).catch(err => console.error('❌ Ошибка flush перед drag:', err));

    const target = e.target as HTMLElement;
    if (target.setPointerCapture) {
      target.setPointerCapture(e.pointerId);
    }

    document.body.classList.add('dragging-mode');
    el.classList.add('dragging');
    
    // 🔧 ВРЕМЕННОЕ РЕШЕНИЕ: меняем z-index напрямую
    el.style.zIndex = '1000';

    // 🛡️ FALLBACK: Если ref недоступен, используем offsetParent
    let tableRect: DOMRect;
    const container = eventsContainerRef.current || el.offsetParent as HTMLElement;
    
    if (container) {
      tableRect = container.getBoundingClientRect();
    } else {
      console.error('❌ Container not found (both ref and offsetParent are null)!');
      return;
    }

    const startLeft = parseFloat(el.style.left || '0');
    const startTop = parseFloat(el.style.top || '0');
    const offsetX = e.clientX - tableRect.left - startLeft;
    const offsetY = e.clientY - tableRect.top - startTop;
    const offsetUnit = Math.floor(offsetY / config.unitStride);

    console.log('📏 Drag geometry:', { startLeft, startTop, offsetX, offsetY, offsetUnit });

    let neighborsMap;
    if (eventNeighbors) {
      // ✅ Оптимизация: используем переданные соседи, если они есть
      neighborsMap = eventNeighbors;
    } else {
      // Fallback: вычисляем на месте (как было раньше)
      try {
        neighborsMap = calculateEventNeighbors(events, projects);
      } catch (err) {
        console.error('❌ Error calculating neighbors:', err);
        // Fallback to basic neighbors or continue without neighbors?
        // Better to return to prevent weird behavior
        return;
      }
    }
    
    const neighborInfo = neighborsMap.get(evData.id);
    const hasAnyLeftNeighbor = neighborInfo?.hasFullLeftNeighbor || false;
    const hasAnyRightNeighbor = neighborInfo?.hasFullRightNeighbor || false;
    const realPaddingLeft = hasAnyLeftNeighbor ? 0 : config.cellPaddingLeft;
    const realPaddingRight = hasAnyRightNeighbor ? 0 : config.cellPaddingRight;
    
    // 🔍 КРИТИЧНО: Учитываем РАСШИРЕНИЕ события (expandLeft/Right) при рендере!
    // Это предотвращает "прыжок" события при захвате, если оно было расширено
    const expandLeftAmount = (neighborInfo?.expandLeftMultiplier || 0) * config.gap;
    const expandRightAmount = (neighborInfo?.expandRightMultiplier || 0) * config.gap;

    console.log(`🔍 DRAG START для события ${evData.id}:`, {
      hasFullLeftNeighbor: neighborInfo?.hasFullLeftNeighbor,
      hasFullRightNeighbor: neighborInfo?.hasFullRightNeighbor,
      expandLeftMultiplier: neighborInfo?.expandLeftMultiplier,
      expandRightMultiplier: neighborInfo?.expandRightMultiplier,
      expandLeftAmount,
      expandRightAmount,
      realPaddingLeft,
      realPaddingRight,
      'config.cellPaddingLeft': config.cellPaddingLeft,
      'config.cellPaddingRight': config.cellPaddingRight,
      startWeek: evData.startWeek,
      weeksSpan: evData.weeksSpan,
      unitStart: evData.unitStart,
      unitsTall: evData.unitsTall
    });

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
      offsetUnit, // ✅ Сохраняем offset внутри события
      el,
      evData: { ...evData },
      tableRect,
      lastValidModel: initialModel,
      startLeft,
      startTop,
      startX: e.clientX, // ✅ Сохраняем начальные координаты курсора
      startY: e.clientY, // ✅ Сохраняем начальные координаты курсора
      currentLeft: startLeft,
      currentTop: startTop,
      realPaddingLeft,
      realPaddingRight,
      expandLeftAmount,
      expandRightAmount,
      // ✅ Для отслеживания последней обработанной позиции (чтобы не пересчитывать повторно)
      lastProcessedResourceId: evData.resourceId,
      lastProcessedUnitStart: evData.unitStart
    };

    const onMove = (ev: PointerEvent) => {
      if (!pointerStateRef.current || pointerStateRef.current.pointerId !== ev.pointerId) return;

      const desiredLeftAbs = ev.clientX - pointerStateRef.current.tableRect.left - pointerStateRef.current.offsetX;
      const desiredTopAbs = ev.clientY - pointerStateRef.current.tableRect.top - pointerStateRef.current.offsetY;
      const cursorTopAbs = ev.clientY - pointerStateRef.current.tableRect.top;
      
      // ✅ ИСПРАВЛЕНО v4.0.12: НЕ вычитаем UNIFIED_GRID_OFFSET здесь!
      // modelFromGeometry уже делает компенсацию внутри себя
      // Двойная компенсация приводит к тому что события не двигаются по вертикали
      
      // 🐛 DEBUG: Логируем координаты для диагностики
      const debugLog = false; // ✅ ВЫКЛЮЧЕНО v4.0.13
      if (debugLog && pointerStateRef.current.evData.resourceId === pointerStateRef.current.evData.resourceId) {
        console.log('🐛 DRAG onMove:', {
          cursorTopAbs: Math.round(cursorTopAbs),
          eventTopAbs: Math.round(desiredTopAbs),
          offsetY: Math.round(pointerStateRef.current.offsetY),
          offsetUnit: pointerStateRef.current.offsetUnit,
          currentResourceId: pointerStateRef.current.evData.resourceId,
          currentUnitStart: pointerStateRef.current.evData.unitStart
        });
      }

      // 🔍 КРИТИЧНО: Используем РЕАЛЬНЫЕ padding (которые были применены при рендере)
      const desiredLeftRel = desiredLeftAbs - pointerStateRef.current.realPaddingLeft;
      const maxLeftRel = Math.max(0, (WEEKS - pointerStateRef.current.evData.weeksSpan) * config.weekPx);
      const clampedRel = clamp(desiredLeftRel, 0, maxLeftRel);
      const snappedWeek = Math.round(clampedRel / config.weekPx);
      const snappedRel = clamp(snappedWeek * config.weekPx, 0, maxLeftRel);
      const snappedLeftAbs = snappedRel + pointerStateRef.current.realPaddingLeft;

      // ✅ Используем реальную позицию курсора для определения ресурса (строки)
      // И ВСЕГДА передаём offsetUnit чтобы точка захвата следовала за курсором
      let newModel = null;
      try {
        // ✅ ИСПРАВЛЕНО v4.0.13: Используем cursorTopAbs вместо desiredTopAbs
        // Это работает и для внутри-строчного drag, и для межстрочного
        // desiredTopAbs (верх события) не подходит для межстрочного drag,
        // потому что событие физически ещё находится в старой строке
        // offsetUnit компенсирует разницу между курсором и верхом события
        newModel = modelFromGeometry(
          snappedLeftAbs,
          cursorTopAbs, // ✅ ИСПРАВЛЕНО: используем позицию курсора
          pointerStateRef.current.el.offsetWidth,
          pointerStateRef.current.el.offsetHeight,
          pointerStateRef.current.evData,
          resources,
          visibleDepartments,
          config,
          pointerStateRef.current.offsetUnit // ✅ Передаём offsetUnit для компенсации
        );
      } catch (err) {
        console.error('❌ Error in modelFromGeometry:', err);
        return;
      }

      if (newModel) {
        pointerStateRef.current.lastValidModel = newModel;
        
        // 🔍 КРИТИЧНО: Если позиция или высота изменилась, ПЕРЕСЧИТЫВАЕМ padding на основе НОВЫХ соседей!
        // Это предотвращает смещение на 1 гап при перемещении между событиями разной высоты
        const positionChanged = 
          newModel.resourceId !== pointerStateRef.current.evData.resourceId ||
          newModel.unitStart !== pointerStateRef.current.evData.unitStart;
        
        // 🐛 DEBUG: Логируем переход на другую строку
        if (newModel.resourceId !== pointerStateRef.current.evData.resourceId) {
          console.log('🔄 DRAG: Переход на другую строку:', {
            from: pointerStateRef.current.evData.resourceId,
            to: newModel.resourceId,
            unitStart: newModel.unitStart
          });
        }
        
        if (positionChanged) {
          // Создаём временное событие с НОВОЙ позицией для вычисления соседей
          const tempEvent = {
            ...pointerStateRef.current.evData,
            resourceId: newModel.resourceId,
            unitStart: newModel.unitStart,
            startWeek: newModel.startWeek
          };
          
          // Вычисляем соседей для НОВОЙ позиции (без учёта текущего события)
          const otherEvents = events.filter(e => e.id !== tempEvent.id);
          const tempEvents = [...otherEvents, tempEvent];
          const neighborsMap = calculateEventNeighbors(tempEvents, projects);
          const neighborInfo = neighborsMap.get(tempEvent.id);
          
          const hasAnyLeftNeighbor = neighborInfo?.hasFullLeftNeighbor || false;
          const hasAnyRightNeighbor = neighborInfo?.hasFullRightNeighbor || false;
          const newRealPaddingLeft = hasAnyLeftNeighbor ? 0 : config.cellPaddingLeft;
          const newRealPaddingRight = hasAnyRightNeighbor ? 0 : config.cellPaddingRight;
          
          // 🔍 КРИТИЧНО: Пересчитываем РАСШИРЕНИЕ для НОВОЙ позиции!
          const newExpandLeftAmount = (neighborInfo?.expandLeftMultiplier || 0) * config.gap;
          const newExpandRightAmount = (neighborInfo?.expandRightMultiplier || 0) * config.gap;
          
          // Обновляем padding и расширение в состоянии
          pointerStateRef.current.realPaddingLeft = newRealPaddingLeft;
          pointerStateRef.current.realPaddingRight = newRealPaddingRight;
          pointerStateRef.current.expandLeftAmount = newExpandLeftAmount;
          pointerStateRef.current.expandRightAmount = newExpandRightAmount;
          
          // ✅ Обновляем последнюю обработанную позицию (чтобы не пересчитывать повторно для той же позиции)
          pointerStateRef.current.lastProcessedResourceId = newModel.resourceId;
          pointerStateRef.current.lastProcessedUnitStart = newModel.unitStart;
        }
      }

      if (pointerStateRef.current.lastValidModel) {
        const snappedTop = topFor(
          pointerStateRef.current.lastValidModel.resourceId,
          pointerStateRef.current.lastValidModel.unitStart,
          resources,
          visibleDepartments,
          config
        );
        
        // 🔍 КРИТИЧНО: Пересчитываем snappedLeftAbs с ОБНОВЛЁННЫМ padding И расирением!
        // При рендере событие смещается влево на expandLeftAmount, поэтому мы тоже должны это учесть
        const finalSnappedRel = pointerStateRef.current.lastValidModel.startWeek * config.weekPx;
        let finalSnappedLeftAbs = finalSnappedRel + pointerStateRef.current.realPaddingLeft;
        
        // ⚠️ КРИТИЧНО: Вычитаем expandLeftAmount чтобы событие смещалось влево как при рендере!
        finalSnappedLeftAbs -= pointerStateRef.current.expandLeftAmount;
        
        // ✅ Обновляем текущие координаты в ref
        pointerStateRef.current.currentLeft = finalSnappedLeftAbs;
        pointerStateRef.current.currentTop = snappedTop;

        pointerStateRef.current.el.style.left = `${finalSnappedLeftAbs}px`;
        pointerStateRef.current.el.style.top = `${snappedTop}px`;
      }
    };

    const onUp = async (ev: PointerEvent) => {
      if (!pointerStateRef.current || pointerStateRef.current.pointerId !== ev.pointerId) return;

      // ✅ Проверяем, был ли это реальный drag или просто клик
      const dist = Math.hypot(
        ev.clientX - (pointerStateRef.current.startX || 0),
        ev.clientY - (pointerStateRef.current.startY || 0)
      );
      const isClick = dist < 3; // Порог 3px

      el.releasePointerCapture(ev.pointerId);
      document.body.classList.remove('dragging-mode');
      el.classList.remove('dragging');
      el.style.zIndex = ''; // 🔧 Сбрасываем z-index

      // 🚫 ВКЛЮЧАЕМ polling обратно
      setIsUserInteracting(false);

      if (isClick) {
        console.log('🚫 Drag отменён (распознан как клик)');
        // Восстанавливаем исходные координаты на случай микро-сдвигов
        el.style.left = `${pointerStateRef.current.startLeft}px`;
        el.style.top = `${pointerStateRef.current.startTop}px`;
        
        pointerStateRef.current = null;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        return;
      }

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

        // ✅ Получаем АБСОЛЮТНО СВЕЖЕЕ состояние из истории
        let currentEvents = eventsRef.current;
        let currentProjects = projectsRef.current;
        let currentZOrder = eventZOrderRef.current;

        if (typeof getEvents === 'function') {
           const snapshot = getEvents();
           currentEvents = snapshot.events;
           currentProjects = snapshot.projects;
           currentZOrder = snapshot.eventZOrder;
        } else {
           console.warn('⚠️ useEventInteractions: getEvents is not a function, using refs fallback');
        }

        // ✅ Получаем актуальное событие из snapshot
        const latestEvent = currentEvents.find(e => e.id === savedState.evData.id) || savedState.evData;

        const updatedEvent = {
          ...latestEvent, // ✅ Используем latestEvent вместо savedState.evData
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
        // Сравниваем с latestEvent (актуальным состоянием), а не savedState.evData (старым)
        const hasChanged = 
          updatedEvent.startWeek !== latestEvent.startWeek ||
          updatedEvent.resourceId !== latestEvent.resourceId ||
          updatedEvent.unitStart !== latestEvent.unitStart;

        if (!hasChanged) {
          console.log('⏭️ Собтие не измнилось - восстанавливаем DOM стили напрямую');
          
          // 🔧 Восстанавливаем исходные DOM стили напрямую
          // КРИТИЧНО: используем realPaddingLeft/Right (учитывают склейку), а НЕ config.cellPaddingLeft/Right!
          // КРИТИЧНО: учитываем expandLeftAmount/RightAmount (расширение на gap)!
          const correctWidth = savedState.evData.weeksSpan * config.weekPx 
            - savedState.realPaddingLeft 
            - savedState.realPaddingRight
            + (savedState.expandLeftAmount || 0)
            + (savedState.expandRightAmount || 0);

          let correctLeft = savedState.evData.startWeek * config.weekPx + savedState.realPaddingLeft;
          correctLeft -= (savedState.expandLeftAmount || 0); // ⚠️ Вычитаем расширение влево!
          
          const correctTop = topFor(savedState.evData.resourceId, savedState.evData.unitStart, resources, visibleDepartments, config);
          const correctHeight = heightFor(savedState.evData.unitsTall, config);
          
          savedState.el.style.left = `${correctLeft}px`;
          savedState.el.style.top = `${correctTop}px`;
          savedState.el.style.width = `${correctWidth}px`;
          savedState.el.style.height = `${correctHeight}px`;
          
          return;
        }

        // ✅ Оптимистичное обновление UI (только если есть изменения)
        onEventsUpdate(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
        
        // ✅ Используем snapshot для сохранения истории
        onSaveHistory(
          currentEvents.map(e => e.id === updatedEvent.id ? updatedEvent : e),
          currentZOrder,
          currentProjects
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
    console.log('✅ DRAG START successful, setting isUserInteracting(true)');
    setIsUserInteracting(true);
  }, [config, resources, visibleDepartments, events, projects, eventZOrder, onEventsUpdate, onEventZOrderUpdate, onSaveHistory, onEventUpdate, eventsContainerRef, setIsUserInteracting, resetDeltaSyncTimer, flushPendingChanges, updateHistoryEventId]); // ✅ v3.3.7: добавили flushPendingChanges и updateHistoryEventId

  // ✅ v3.3.21: Восстанавливаем стили dragged элемента после ре-рендера
  // Это критично для предотвращения залипания курсора, если во время drag
  // происходит ре-рендер (напимер, из-за Delta Sync или flushPendingChanges)
  useLayoutEffect(() => {
    if (pointerStateRef.current) {
      const { id, el, currentLeft, currentTop, currentWidth, currentHeight } = pointerStateRef.current;
      
      // Если элемент исчез из DOM (например, при ре-рендере с изменением key),
      // пытаемся найти новый элемент по ID
      let targetEl = el;
      if (!document.contains(el)) {
        console.warn('⚠️ Drag элемент потерян из DOM, ищем замену...', id);
        const newEl = document.querySelector(`[data-event-id="${id}"]`) as HTMLElement;
        if (newEl) {
          console.log('✅ Найден новый элемент для drag:', id);
          targetEl = newEl;
          // Обновляем ref
          pointerStateRef.current.el = newEl;
        } else {
          console.error('❌ Новый элемент не найден! Drag может сломаться.');
          return;
        }
      }

      // Восстанавливаем стили на (возможно новом) элементе
      if (document.contains(targetEl)) {
        // Восстанавливаем координаты и размеры
        if (currentLeft !== undefined) targetEl.style.left = `${currentLeft}px`;
        if (currentTop !== undefined) targetEl.style.top = `${currentTop}px`;
        if (currentWidth !== undefined) targetEl.style.width = `${currentWidth}px`;
        if (currentHeight !== undefined) targetEl.style.height = `${currentHeight}px`;
        
        // Гарантируем, что z-index и классы на месте
        targetEl.style.zIndex = '1000';
        if (!targetEl.classList.contains('dragging')) targetEl.classList.add('dragging');
        document.body.classList.add('dragging-mode');
        
        if (pointerStateRef.current.type === 'resize') {
          if (!targetEl.classList.contains('resizing')) targetEl.classList.add('resizing');
        }
      }
    }
  }); // Запускаем после каждого рендера

  const startResize = useCallback((
    e: React.PointerEvent,
    el: HTMLElement,
    evData: SchedulerEvent,
    edges: { top?: boolean; bottom?: boolean; left?: boolean; right?: boolean }
  ) => {
    if (e.button !== 0) return;
    
    // 🚫 БЛОКИРОВКА RESIZE для временных событий
    if (evData.id.startsWith('ev_temp_')) {
      console.log('🚫 RESIZE ЗАБЛОКИРОВАН: временное событие ещё создаётся на сервере:', evData.id);
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();

    // ✅ v3.3.7: Flush pending changes ПЕРЕД началом resize
    // Это гарантирует что все события с временными ID будут созданы на сервере
    // и получат реальные ID ДО того как resize попадёт в историю
    console.log('🚀 RESIZE: Flush pending операций перед началом resize');
    flushPendingChanges(updateHistoryEventId).catch(err => console.error('❌ Ошибка flush перед resize:', err));

    const target = e.target as HTMLElement;
    if (target.setPointerCapture) {
      target.setPointerCapture(e.pointerId);
    }

    document.body.classList.add('dragging-mode');
    el.classList.add('dragging');
    el.classList.add('resizing'); // Скрываем внутренние скругления во время ресайза
    
    // 🔧 ВРЕМЕННОЕ РЕШЕНИЕ: меняем z-index напрямую
    el.style.zIndex = '1000';

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

    // 🛡️ FALLBACK: Если ref недоступен, используем offsetParent
    let tableRect: DOMRect;
    const container = eventsContainerRef.current || el.offsetParent as HTMLElement;
    
    if (container) {
      tableRect = container.getBoundingClientRect();
    } else {
      console.error('❌ Container not found (both ref and offsetParent are null)!');
      return;
    }

    const startLeft = parseFloat(el.style.left || '0');
    const startTop = parseFloat(el.style.top || '0');
    const startWidth = el.offsetWidth;
    const startHeight = el.offsetHeight;
    const startX = e.clientX;
    const startY = e.clientY;

    // 🔍 КРИТИЧНО: Вычисляем РЕАЛЬНЫЕ padding события ПЕРЕД ресайзом
    let neighborsMap;
    if (eventNeighbors) {
      // ✅ Оптимизация: используем переданные соседи, если они есть
      neighborsMap = eventNeighbors;
    } else {
      try {
        neighborsMap = calculateEventNeighbors(events, projects);
      } catch (err) {
        console.error('❌ Error calculating neighbors:', err);
        return;
      }
    }
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
      currentLeft: startLeft,
      currentTop: startTop,
      currentWidth: startWidth,
      currentHeight: startHeight,
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

      const maxLeftAbs = (WEEKS * config.weekPx) - 10;
      newLeft = clamp(newLeft, config.cellPaddingLeft, maxLeftAbs);

      // Snap to grid
      if (pointerStateRef.current.edges.left || pointerStateRef.current.edges.right) {
        if (pointerStateRef.current.edges.left) {
          let deltaWeeks = Math.round(dx / config.weekPx);

          // 🔒 Запрещаем уменьшать ширину меньше 1 недели при ресайзе слева
          // Если мы тянем левый край вправо (dx > 0), deltaWeeks положительный
          // originalWeeksSpan - deltaWeeks >= 1  =>  deltaWeeks <= originalWeeksSpan - 1
          if (deltaWeeks > pointerStateRef.current.originalWeeksSpan - 1) {
            deltaWeeks = pointerStateRef.current.originalWeeksSpan - 1;
          }

          let newStartWeek = clamp(pointerStateRef.current.originalStartWeek + deltaWeeks, 0, WEEKS - 1);
          let newWeeksSpan = clamp(pointerStateRef.current.originalWeeksSpan - deltaWeeks, 1, WEEKS - newStartWeek);
          if (newStartWeek + newWeeksSpan > WEEKS) newWeeksSpan = WEEKS - newStartWeek;
          // 🔍 КРИТИЧНО: Используем РЕАЛЬНЫЕ padding (которые были применены при рендере)
          newWidth = newWeeksSpan * config.weekPx - pointerStateRef.current.realPaddingLeft - pointerStateRef.current.realPaddingRight;
          newLeft = newStartWeek * config.weekPx + pointerStateRef.current.realPaddingLeft;
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

      let currentUnitsTall = pointerStateRef.current.originalUnitsTall;

      if (pointerStateRef.current.edges.top || pointerStateRef.current.edges.bottom) {
        if (pointerStateRef.current.edges.top) {
          let deltaUnits = Math.round(dy / config.unitStride);
          
          // 🔒 Запрещаем уменьшать высоту меньше 1 юнита при ресайзе сверху
          // originalUnitsTall - deltaUnits >= 1 => deltaUnits <= originalUnitsTall - 1
          if (deltaUnits > pointerStateRef.current.originalUnitsTall - 1) {
            deltaUnits = pointerStateRef.current.originalUnitsTall - 1;
          }

          const newUnitStart = clamp(pointerStateRef.current.originalUnitStart + deltaUnits, 0, UNITS - 1);
          const newUnitsTall = clamp(pointerStateRef.current.originalUnitsTall - deltaUnits, 1, UNITS - newUnitStart);
          newHeight = heightFor(newUnitsTall, config);
          newTop = topFor(pointerStateRef.current.evData.resourceId, newUnitStart, resources, visibleDepartments, config);
          currentUnitsTall = newUnitsTall;
        } else {
          const newUnitsTall = clamp(pointerStateRef.current.originalUnitsTall + Math.round(dy / config.unitStride), 1, UNITS - pointerStateRef.current.originalUnitStart);
          newHeight = heightFor(newUnitsTall, config);
          currentUnitsTall = newUnitsTall;
        }
      }

      // ⚡️ ГНОВЕННОЕ ОБНОВЛЕНИЕ UI ВНУТРИ СОБЫТИЯ
      // 1. Обновляем padding в зависимости от высоты (логика из SchedulerEvent)
      let newPadding = '8px 12px';
      if (newHeight <= 12) newPadding = '1px 12px';
      else if (newHeight <= 20) newPadding = '2px 12px';
      else if (newHeight <= 40) newPadding = '4px 12px';
      
      pointerStateRef.current.el.style.padding = newPadding;

      // 2. Обновляем выравнивание (items-start если > 1 юнита)
      if (currentUnitsTall > 1) {
        if (!pointerStateRef.current.el.classList.contains('items-start')) {
          pointerStateRef.current.el.classList.add('items-start');
        }
      } else {
        if (pointerStateRef.current.el.classList.contains('items-start')) {
          pointerStateRef.current.el.classList.remove('items-start');
        }
      }

      // 3. Обновляем текст веса проекта (если есть)
      const weightEl = pointerStateRef.current.el.querySelector('.ev-weight');
      if (weightEl) {
         weightEl.textContent = `${currentUnitsTall * 25}%`;
      }

      // ✅ Обновляем текущие координаты в ref
      pointerStateRef.current.currentLeft = newLeft;
      pointerStateRef.current.currentTop = newTop;
      pointerStateRef.current.currentWidth = Math.max(24, newWidth);
      pointerStateRef.current.currentHeight = newHeight;

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
      el.style.zIndex = ''; // 🔧 Сбрасываем z-index

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

      // ✅ Получаем АБСОЛЮТНО СВЕЖЕЕ состояние из истории
      let currentEvents = eventsRef.current;
      let currentProjects = projectsRef.current;
      let currentZOrder = eventZOrderRef.current;

      if (typeof getEvents === 'function') {
         const snapshot = getEvents();
         currentEvents = snapshot.events;
         currentProjects = snapshot.projects;
         currentZOrder = snapshot.eventZOrder;
      } else {
         console.warn('⚠️ useEventInteractions: getEvents is not a function (resize), using refs fallback');
      }

      // ✅ Получаем актуальное событие из snapshot
      const latestEvent = currentEvents.find(e => e.id === savedState.evData.id) || savedState.evData;

      const updatedEvent = { ...latestEvent }; // ✅ Копируем из latestEvent

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
        
        // ✅ ИСПРАВЛЕНО v4.0.6: Вычитаем компенсацию +88px (которая добавляется в topFor)
        // Это критично для корректного обратного преобразования координат в Unified CSS Grid
        const UNIFIED_GRID_OFFSET = 88; // 80px (новые заголовки 152px - старые 72px) + 8px отступ
        const withinRow = gTop - resourceTop - config.rowPaddingTop - UNIFIED_GRID_OFFSET;
        
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
        updatedEvent.startWeek !== latestEvent.startWeek || // Сравниваем с latestEvent
        updatedEvent.weeksSpan !== latestEvent.weeksSpan ||
        updatedEvent.unitStart !== latestEvent.unitStart ||
        updatedEvent.unitsTall !== latestEvent.unitsTall;

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
      
      // ✅ Используем snapshot для сохранения истории
      // Это гарантирует строгую последоваельность изменений без пропусков
      onSaveHistory(
        currentEvents.map(e => e.id === updatedEvent.id ? updatedEvent : e),
        currentZOrder,
        currentProjects
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
    console.log('✅ RESIZE START successful, setting isUserInteracting(true)');
    setIsUserInteracting(true);
  }, [config, resources, visibleDepartments, events, projects, eventZOrder, onEventsUpdate, onEventZOrderUpdate, onSaveHistory, onEventUpdate, eventsContainerRef, setIsUserInteracting, resetDeltaSyncTimer, flushPendingChanges, updateHistoryEventId]); // ✅ v3.3.7: добавили flushPendingChanges и updateHistoryEventId

  return { startDrag, startResize };
}