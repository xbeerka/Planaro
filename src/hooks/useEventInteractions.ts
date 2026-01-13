import { useRef, useCallback, useLayoutEffect } from 'react';
import { SchedulerEvent, Resource, Department, Project } from '../types/scheduler';
import { LayoutConfig, modelFromGeometry, topFor, heightFor, getResourceGlobalTop, getBorderRadiusForRowHeight } from '../utils/schedulerLayout';
import { clamp, UNITS } from '../utils/scheduler';
import { calculateEventNeighbors, MASK_ROUND_TL, MASK_ROUND_TR, MASK_ROUND_BL, MASK_ROUND_BR, MASK_FULL_LEFT, MASK_FULL_RIGHT } from '../utils/eventNeighbors';

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
  weeksInYear: number; // ✅ Динамическое количество недель (52 или 53)
  grades?: any[]; // ✅ Added grades
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
  eventNeighbors,
  weeksInYear,
  grades = [] // ✅ Added grades
}: UseEventInteractionsProps) {
  // ✅ Используем refs для events/projects/zOrder чтобы избежать stale closures в асинхронных onUp
  // Это критично для корректной работы истории (Undo/Redo) и предотвращения "группировки" действий
  const eventsRef = useRef(events);
  const projectsRef = useRef(projects);
  const eventZOrderRef = useRef(eventZOrder);
  const gradesRef = useRef(grades); // ✅ Added ref for grades

  // Обновляем refs при изменении props
  eventsRef.current = events;
  projectsRef.current = projects;
  eventZOrderRef.current = eventZOrder;
  gradesRef.current = grades; // ✅ Added ref for grades

  const pointerStateRef = useRef<PointerState | null>(null);

  const updateNeighborStyles = useCallback((neighborsMap: Map<string, any>) => {
    neighborsMap.forEach((info, eventId) => {
      // Skip current event (handled separately in drag/resize loop)
      if (pointerStateRef.current && eventId === pointerStateRef.current.id) return;
      
      const el = document.querySelector(`[data-event-id="${eventId}"]`) as HTMLElement;
      if (!el) return;
      
      const event = eventsRef.current.find(e => e.id === eventId);
      if (!event) return;
      
      // 1. BorderRadius
      const r = getBorderRadiusForRowHeight(config.eventRowH);
      const tl = (info.flags & MASK_ROUND_TL) ? r : 0;
      const tr = (info.flags & MASK_ROUND_TR) ? r : 0;
      const br = (info.flags & MASK_ROUND_BR) ? r : 0;
      const bl = (info.flags & MASK_ROUND_BL) ? r : 0;
      el.style.borderRadius = `${tl}px ${tr}px ${br}px ${bl}px`;
      
      // 2. Inner Colors & Classes
      const getCol = (pid?: string) => {
         if (!pid) return 'transparent';
         const p = projectsRef.current.find(prj => prj.id === pid);
         return p?.backgroundColor || 'transparent';
      };
      
      el.style.setProperty('--inner-tl-color', getCol(info.innerTopLeftProjectId));
      el.style.setProperty('--inner-tr-color', getCol(info.innerTopRightProjectId));
      el.style.setProperty('--inner-bl-color', getCol(info.innerBottomLeftProjectId));
      el.style.setProperty('--inner-br-color', getCol(info.innerBottomRightProjectId));
      
      el.classList.toggle('inner-tl', !!info.innerTopLeftProjectId);
      el.classList.toggle('inner-tr', !!info.innerTopRightProjectId);
      el.classList.toggle('inner-bl', !!info.innerBottomLeftProjectId);
      el.classList.toggle('inner-br', !!info.innerBottomRightProjectId);

      const wrapper = el.querySelector('.inner-bottom-wrapper');
      if (wrapper) {
          wrapper.classList.toggle('inner-bl', !!info.innerBottomLeftProjectId);
          wrapper.classList.toggle('inner-br', !!info.innerBottomRightProjectId);
      }
      
      // 3. Expansion (Width & Left)
      const expandLeftAmount = (info.expandLeftMultiplier || 0) * config.gap;
      const expandRightAmount = (info.expandRightMultiplier || 0) * config.gap;
      
      // Base dimensions from event data (using constant padding)
      const paddingLeft = config.cellPaddingLeft;
      const paddingRight = config.cellPaddingRight;
      
      const baseLeft = event.startWeek * config.weekPx + paddingLeft;
      const baseWidth = event.weeksSpan * config.weekPx - paddingLeft - paddingRight;
      
      const newLeft = baseLeft - expandLeftAmount;
      const newWidth = baseWidth + expandLeftAmount + expandRightAmount;
      
      el.style.left = `${newLeft}px`;
      el.style.width = `${newWidth}px`;
    });
  }, [config]);

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
    flushPendingChanges(updateHistoryEventId).catch(err => console.error('❌ Ошибка flush перед drag:', err));

    // ✅ ИСПРАВЛЕНО: Используем el (сам элемент события) для захвата курсора, а не target (который может быть ребенком)
    // Это гарантирует, что el.releasePointerCapture() в onUp сработает корректно
    if (el.setPointerCapture) {
      el.setPointerCapture(e.pointerId);
    }

    document.body.classList.add('dragging-mode');
    el.classList.add('dragging');
    
    // 🔧 ВРЕМЕННОЕ РЕШЕНИЕ: меняем z-index напрямую
    el.style.zIndex = '1000';

    // ✅ Блокируем Delta Sync (polling) во время перетаскивания
    setIsUserInteracting(true);

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
    
    // ✅ FIX JITTER: Calculate offset relative to GRID START (ignoring expansion)
    // This ensures snapping logic uses stable grid coordinates, not visual expanded coordinates
    const gridStartLeft = evData.startWeek * config.weekPx + config.cellPaddingLeft;
    const offsetXFromGrid = e.clientX - tableRect.left - gridStartLeft;
    
    const offsetY = e.clientY - tableRect.top - startTop;
    const offsetUnit = Math.floor(offsetY / config.unitStride);

    // ✅ КРИТИЧНО: Всегда вычисляем соседей на месте, чтобы использовать СВЕЖИЕ данные из eventsRef
    // Это реш��ет проблему "кэширования" и stale closures (когда events из пропсов пустой при первом рендере)
    let neighborsMap;
    try {
      neighborsMap = calculateEventNeighbors(eventsRef.current, projectsRef.current);
    } catch (err) {
      console.error('❌ Error calculating neighbors:', err);
      return;
    }
    
    const neighborInfo = neighborsMap.get(evData.id);
    
    // 🔍 КРИТИЧНО: Всегда используем константные отступы
    const realPaddingLeft = config.cellPaddingLeft;
    const realPaddingRight = config.cellPaddingRight;
    
    // 🔍 КРИТИЧНО: Учитываем РАСШИРЕНИЕ события (expandLeft/Right) при рендере!
    // Это предотвращает "прыжок" события при захвате, если оно было расширено
    const expandLeftAmount = (neighborInfo?.expandLeftMultiplier || 0) * config.gap;
    const expandRightAmount = (neighborInfo?.expandRightMultiplier || 0) * config.gap;

    const initialModel = modelFromGeometry(
      startLeft + config.resourceW,
      startTop,
      el.offsetWidth,
      el.offsetHeight,
      evData,
      resources,
      visibleDepartments,
      config,
      undefined,
      weeksInYear,
      gradesRef.current // ✅ Pass grades
    );

    pointerStateRef.current = {
      type: 'drag',
      id: evData.id,
      pointerId: e.pointerId,
      offsetX,
      offsetXFromGrid, // ✅ Store grid-based offset
      offsetY,
      offsetUnit, // ✅ Сохраняем offset внутри события
      el,
      evData: { ...evData },
      tableRect,
      lastValidModel: initialModel,
      startLeft,
      startTop,
      startX: e.clientX, // �� Сохраняем начальные координаты курсора
      startY: e.clientY, // ✅ Сохраняем начальные координаты курсора
      currentLeft: startLeft,
      currentTop: startTop,
      currentWidth: el.offsetWidth, // ✅ Capture initial width for stability
      currentHeight: el.offsetHeight,
      realPaddingLeft,
      realPaddingRight,
      expandLeftAmount,
      expandRightAmount,
      // ✅ Для отслеживания последней обработанной позиции (чтобы не пересчитывать повторно)
      lastProcessedResourceId: evData.resourceId,
      lastProcessedUnitStart: evData.unitStart,
      lastProcessedStartWeek: evData.startWeek
    };

    const onMove = (ev: PointerEvent) => {
      if (!pointerStateRef.current || pointerStateRef.current.pointerId !== ev.pointerId) return;

      const desiredTopAbs = ev.clientY - pointerStateRef.current.tableRect.top - pointerStateRef.current.offsetY;
      const cursorTopAbs = ev.clientY - pointerStateRef.current.tableRect.top;
      
      // ✅ FIX JITTER: Use Grid-based offset for snapping
      // This decouples the snapping logic from the visual expansion
      const offsetFromGrid = pointerStateRef.current.offsetXFromGrid ?? pointerStateRef.current.offsetX;
      const desiredGridLeftAbs = ev.clientX - pointerStateRef.current.tableRect.left - offsetFromGrid;
      
      // 🐛 DEBUG: Логируем координаты для диагностики
      // const debugLog = false; // ✅ ВЫКЛЮЧЕНО v4.0.13
      
      const debugJitter = false; // 🔍 Включаем для отладки дергания

      // 🔍 КРИТИЧНО: Используем РЕАЛЬНЫЕ padding (которые были применены при рендере)
      const desiredGridLeftRel = desiredGridLeftAbs - pointerStateRef.current.realPaddingLeft;
      const maxLeftRel = Math.max(0, (weeksInYear - pointerStateRef.current.evData.weeksSpan) * config.weekPx);
      const clampedRel = clamp(desiredGridLeftRel, 0, maxLeftRel);
      const snappedWeek = Math.round(clampedRel / config.weekPx);
      const snappedRel = clamp(snappedWeek * config.weekPx, 0, maxLeftRel);
      const snappedLeftAbs = snappedRel + pointerStateRef.current.realPaddingLeft;

      if (debugJitter) {
        console.error('🔍 JITTER_DEBUG: Drag Move', {
           clientX: ev.clientX,
           desiredGridLeftAbs,
           snappedWeek,
           snappedLeftAbs,
           offsetFromGrid
        });
      }

      // ✅ Используем реальную позицию курсора для определения ресурса (строки)
      // И ВСЕГДА передаём offsetUnit чтобы точка захвата следовала за курсором
      let newModel = null;
      try {
        // ✅ ИСПРАВЛЕНО v4.0.13: Используем cursorTopAbs вместо desiredTopAbs
        // Это работает и для внутри-строчного drag, и для межстрочного
        // desiredTopAbs (верх события) не подходит для межстрочного drag,
        // потому что событие физически ещё находится в старой строке
        // offsetUnit компенсирует разницу между курсором и верхом события
        // ✅ JITTER FIX: Используем стабильную ширину (без expansion) для логики модели
        // Это предотвращает обратную связь: модель -> соседи -> expansion -> width -> модель
        const stableWidth = pointerStateRef.current.evData.weeksSpan * config.weekPx - config.cellPaddingLeft - config.cellPaddingRight;
        
        newModel = modelFromGeometry(
          snappedLeftAbs + config.resourceW,
          cursorTopAbs, // ✅ ИСПРАВЛЕНО: используем позицию курсора
          stableWidth, // ✅ ИСПРАВЛЕНО: используем стабильную ширину вместо el.offsetWidth
          pointerStateRef.current.el.offsetHeight,
          pointerStateRef.current.evData,
          resources,
          visibleDepartments,
          config,
          pointerStateRef.current.offsetUnit, // ✅ Передаём offsetUnit для компенсации
          weeksInYear,
          gradesRef.current // ✅ Pass grades
        );
      } catch (err) {
        console.error('❌ Error in modelFromGeometry:', err);
        return;
      }

      if (newModel) {
        pointerStateRef.current.lastValidModel = newModel;
        
        // 🔍 КРИТИЧНО: Если позиция или высота изменилась, ПЕРЕСЧИТЫВАЕМ padding на основе НОВЫХ соседей!
        // Используем lastProcessed значения, чтобы избежать спама и КОРРЕКТНО обрабатывать возвращение на исходную позицию
        const positionChanged = 
          newModel.resourceId !== pointerStateRef.current.lastProcessedResourceId ||
          newModel.unitStart !== pointerStateRef.current.lastProcessedUnitStart ||
          newModel.startWeek !== pointerStateRef.current.lastProcessedStartWeek;
        
        // 🐛 DEBUG: Логируем переход на другую строку
        if (newModel.resourceId !== pointerStateRef.current.lastProcessedResourceId) {
          console.log('🔄 DRAG: Переход на другую строку:', {
            from: pointerStateRef.current.lastProcessedResourceId,
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
          // 🔍 КРИТИЧНО: Используем refs для избежания stale closures (иначе соседи считаются по старым данным)
          const otherEvents = eventsRef.current.filter(e => e.id !== tempEvent.id);
          const tempEvents = [...otherEvents, tempEvent];
          
          let neighborsMap;
          try {
            neighborsMap = calculateEventNeighbors(tempEvents, projectsRef.current);
          } catch (err) {
            console.error('❌ Error calculating neighbors in onMove:', err);
            // Fallback: пустая карта, чтобы не зависал интерфейс
            neighborsMap = new Map();
          }

          const neighborInfo = neighborsMap.get(tempEvent.id);
          
          // 🗑️ УБРАНО: Зависимость padding от соседей
          const newRealPaddingLeft = config.cellPaddingLeft;
          const newRealPaddingRight = config.cellPaddingRight;
          
          // ✅ Update Neighbors Styles
          updateNeighborStyles(neighborsMap);

          // 🔍 КРИТИЧНО: Пере��читываем РАСШИРЕНИЕ для НОВОЙ позиции!
          const newExpandLeftAmount = (neighborInfo?.expandLeftMultiplier || 0) * config.gap;
          const newExpandRightAmount = (neighborInfo?.expandRightMultiplier || 0) * config.gap;
          
          // Обновляем padding и расширение в состоянии
          pointerStateRef.current.realPaddingLeft = newRealPaddingLeft;
          pointerStateRef.current.realPaddingRight = newRealPaddingRight;
          pointerStateRef.current.expandLeftAmount = newExpandLeftAmount;
          pointerStateRef.current.expandRightAmount = newExpandRightAmount;

          // ✅ Обновляем стили соседей (динамическая склейка)
          updateNeighborStyles(neighborsMap);
          
          // ✅ ОБНОВЛЕНИЕ DOM: Применяем стили ТОЛЬКО к перетаскиваемому событию!
          // Соседи обновятся автоматически при ре-рендере после onUp
          // Это предотвращает наслоение из-за применения expansion к событиям которые не касаются
          const draggedInfo = neighborsMap.get(pointerStateRef.current.id);
          if (draggedInfo) {
            const el = pointerStateRef.current.el;
            const event = tempEvent; // Перетаскиваемое событие
            
            // 1. Apply Border Radius
            const r = getBorderRadiusForRowHeight(config.eventRowH);
            const tl = (draggedInfo.flags & MASK_ROUND_TL) ? r : 0;
            const tr = (draggedInfo.flags & MASK_ROUND_TR) ? r : 0;
            const br = (draggedInfo.flags & MASK_ROUND_BR) ? r : 0;
            const bl = (draggedInfo.flags & MASK_ROUND_BL) ? r : 0;
            el.style.borderRadius = `${tl}px ${tr}px ${br}px ${bl}px`;
            
            // 2. Apply Inner Colors (CSS variables) & Classes
            const getCol = (pid?: string) => {
              if (!pid) return 'transparent';
              const p = projectsRef.current.find(prj => prj.id === pid);
              return p?.backgroundColor || 'transparent';
            };
            el.style.setProperty('--inner-tl-color', getCol(draggedInfo.innerTopLeftProjectId));
            el.style.setProperty('--inner-tr-color', getCol(draggedInfo.innerTopRightProjectId));
            el.style.setProperty('--inner-bl-color', getCol(draggedInfo.innerBottomLeftProjectId));
            el.style.setProperty('--inner-br-color', getCol(draggedInfo.innerBottomRightProjectId));
            
            // Toggle classes for inner corners
            el.classList.toggle('inner-tl', !!draggedInfo.innerTopLeftProjectId);
            el.classList.toggle('inner-tr', !!draggedInfo.innerTopRightProjectId);
            el.classList.toggle('inner-bl', !!draggedInfo.innerBottomLeftProjectId);
            el.classList.toggle('inner-br', !!draggedInfo.innerBottomRightProjectId);
            
            const wrapper = el.querySelector('.inner-bottom-wrapper');
            if (wrapper) {
              wrapper.classList.toggle('inner-bl', !!draggedInfo.innerBottomLeftProjectId);
              wrapper.classList.toggle('inner-br', !!draggedInfo.innerBottomRightProjectId);
            }
            
            // 3. Apply Geometry (БЕЗ expansion для width!)
            const pLeft = config.cellPaddingLeft;
            const pRight = config.cellPaddingRight;
            
            // ✅ Width С УЧЁТОМ expansion (восстанавливаем визуальную склейку при драге)
            const newWidth = event.weeksSpan * config.weekPx 
              - pLeft 
              - pRight
              + newExpandLeftAmount
              + newExpandRightAmount;

            el.style.width = `${newWidth}px`;
            pointerStateRef.current.currentWidth = newWidth; // Update state
            
            // Позиция управляется курсором (в конце onMove)
          }
          
          // ✅ Обновля���� последнюю обработанную позицию
          pointerStateRef.current.lastProcessedResourceId = newModel.resourceId;
          pointerStateRef.current.lastProcessedUnitStart = newModel.unitStart;
          pointerStateRef.current.lastProcessedStartWeek = newModel.startWeek;
        } else {
          // ✅ Если позиция не изменилась, ГАРАНТИРУЕМ что ширина остаётся корректной
          // Это защищает от любых внешних изменений (например, ре-рендеров) во время микро-движений
          if (pointerStateRef.current.currentWidth) {
             pointerStateRef.current.el.style.width = `${pointerStateRef.current.currentWidth}px`;
          }
        }
      }

      if (pointerStateRef.current.lastValidModel) {
        const snappedTop = topFor(
          pointerStateRef.current.lastValidModel.resourceId,
          pointerStateRef.current.lastValidModel.unitStart,
          resources,
          visibleDepartments,
          config,
          gradesRef.current
        );
        
        // 🔍 Позиция перетаскиваемого события зависит ТОЛЬКО от startWeek и padding
        // 🔍 Применяем expansion �� перетаскиваемому событию для визуальной стабильности
        const finalSnappedRel = pointerStateRef.current.lastValidModel.startWeek * config.weekPx;
        let finalSnappedLeftAbs = finalSnappedRel + pointerStateRef.current.realPaddingLeft;
        
        // Вычитаем расширение влево (аналогично тому, как это делается в SchedulerEvent)
        finalSnappedLeftAbs -= (pointerStateRef.current.expandLeftAmount || 0);
        
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

      // ✅ CLEANUP: Гар��нтированная очистка классов и стилей
      try {
        if (el.releasePointerCapture) {
           el.releasePointerCapture(ev.pointerId);
        }
      } catch (err) {
        console.warn('⚠️ releasePointerCapture failed:', err);
      }
      
      document.body.classList.remove('dragging-mode');
      document.body.classList.remove('resizing-mode'); // 🛡️ Safety cleanup
      el.classList.remove('dragging');
      el.classList.remove('resizing'); // 🛡️ Safety cleanup
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
        window.removeEventListener('pointercancel', onUp); // ✅ Cleanup cancellation
        return;
      }

      // ✅ v3.3.5: БЛОКИРУЕМ Delta Sync на 5 секунд после drag
      // Это предотвращает перезапись локальных изменений данными с сервера
      resetDeltaSyncTimer();

      // Сохраняем данные перед очисткой состояния
      const savedState = pointerStateRef.current;
      
      // ✅ Немедленно очищаем состояние и удаляем обработчики для мгновенного отклика
      pointerStateRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp); // ✅ Cleanup cancellation

      if (savedState.lastValidModel) {
        let newStart = savedState.lastValidModel.startWeek;
        const ws = savedState.evData.weeksSpan;
        newStart = clamp(newStart, 0, Math.max(0, weeksInYear - ws));

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

        // 🔍 ��роверяем, действительно ли событие изменилось (защита от ложных обновлений)
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
          
          const correctTop = topFor(savedState.evData.resourceId, savedState.evData.unitStart, resources, visibleDepartments, config, gradesRef.current);
          const correctHeight = heightFor(savedState.evData.unitsTall, config);
          
          savedState.el.style.left = `${correctLeft}px`;
          savedState.el.style.top = `${correctTop}px`;
          savedState.el.style.width = `${correctWidth}px`;
          savedState.el.style.height = `${correctHeight}px`;
          
          return;
        }

        // ✅ Оптимистичное обновление UI (только если есть изменения)
        onEventsUpdate(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
        
        // 🔧 КРИТИЧНО: Немедленно корректируем DOM стили ПОСЛЕ обновления события
        // Используем ФИНАЛЬНЫЕ padding и expansion из последнего onMove
        // Это предотвращает "прыжок" при ре-рендере (который может пересчитать соседей неправильно)
        const finalWidth = updatedEvent.weeksSpan * config.weekPx 
          - savedState.realPaddingLeft 
          - savedState.realPaddingRight
          + (savedState.expandLeftAmount || 0)
          + (savedState.expandRightAmount || 0);

        let finalLeft = updatedEvent.startWeek * config.weekPx + savedState.realPaddingLeft;
        finalLeft -= (savedState.expandLeftAmount || 0);
        
        const finalTop = topFor(updatedEvent.resourceId, updatedEvent.unitStart, resources, visibleDepartments, config);
        const finalHeight = heightFor(updatedEvent.unitsTall, config);
        
        savedState.el.style.left = `${finalLeft}px`;
        savedState.el.style.top = `${finalTop}px`;
        savedState.el.style.width = `${finalWidth}px`;
        savedState.el.style.height = `${finalHeight}px`;
        
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
    window.addEventListener('pointercancel', onUp); // ✅ Handle cancellation

    // 🚫 Отключаем polling
    setIsUserInteracting(true);
  }, [config, resources, visibleDepartments, events, projects, eventZOrder, onEventsUpdate, onEventZOrderUpdate, onSaveHistory, onEventUpdate, eventsContainerRef, setIsUserInteracting, resetDeltaSyncTimer, flushPendingChanges, updateHistoryEventId, updateNeighborStyles]); // ✅ v3.3.7: добавили flushPendingChanges и updateHistoryEventId

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
          console.error('❌ Новый элемент не найден! Drag можт сломаться.');
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
        
        // ✅ Correctly apply classes based on interaction type
        if (pointerStateRef.current.type === 'resize') {
           if (!targetEl.classList.contains('resizing')) targetEl.classList.add('resizing');
           targetEl.classList.remove('dragging'); // 🛡️ Force remove conflict
           document.body.classList.add('resizing-mode');
           document.body.classList.remove('dragging-mode'); // 🛡️ Force remove conflict
        } else {
           if (!targetEl.classList.contains('dragging')) targetEl.classList.add('dragging');
           targetEl.classList.remove('resizing'); // 🛡️ Force remove conflict
           document.body.classList.add('dragging-mode');
           document.body.classList.remove('resizing-mode'); // 🛡️ Force remove conflict
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
    flushPendingChanges(updateHistoryEventId).catch(err => console.error('❌ Ошибка flush перед resize:', err));

    // ✅ ИСПРАВЛЕНО: Используем el (сам элемент события) для захвата курсора, а не target (который может быть ребенком)
    // Это гарантирует, что el.releasePointerCapture() в onUp сработает корректно
    if (el.setPointerCapture) {
      el.setPointerCapture(e.pointerId);
    }

    document.body.classList.add('resizing-mode');
    el.classList.add('resizing');
    // el.classList.add('resizing'); // ❌ УБРАНО: Скрывало внутренние скругления
    
    // 🔧 ВРЕМЕННОЕ РЕШЕНИЕ: меняем z-index напрямую
    el.style.zIndex = '1000';

    // Находим и помечаем соседние события того же проекта (для визуального отклика)
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
          // neighborEl.classList.add('resizing'); // ❌ УБРАНО: Скрывало внутренние скругления
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

    // ✅ Add class to body/element to disable transitions
    document.body.classList.add('resizing-mode');
    el.classList.add('resizing');
    // 🔧 ВРЕМЕННОЕ РЕШЕНИЕ: меняем z-index напрямую
    el.style.zIndex = '1000';

    const startLeft = parseFloat(el.style.left || '0');
    const startTop = parseFloat(el.style.top || '0');
    const startWidth = el.offsetWidth;
    const startHeight = el.offsetHeight;
    const startX = e.clientX;
    const startY = e.clientY;

    // 🔍 КРИТИЧНО: Вычисляем РЕАЛЬНЫЕ padding события ПЕРЕД ресайзом
    let neighborsMap;
    try {
      // ✅ КРИТИЧНО: Используем refs для свежих данных
      neighborsMap = calculateEventNeighbors(eventsRef.current, projectsRef.current);
    } catch (err) {
      console.error('❌ Error calculating neighbors:', err);
      return;
    }
    
    // 🔍 КРИТИЧНО: Всегда используем константные отступы (как в SchedulerMain)
    const realPaddingLeft = config.cellPaddingLeft;
    const realPaddingRight = config.cellPaddingRight;

    // 🔍 КРИТИЧНО: Учитываем начальное расширение, чтобы корректно добавлять его в onMove
    // Но теперь мы используем реальный `neighborInfo` который был получен выше
    const neighborInfo = neighborsMap.get(evData.id);
    const initialExpandLeft = (neighborInfo?.expandLeftMultiplier || 0) * config.gap;
    const initialExpandRight = (neighborInfo?.expandRightMultiplier || 0) * config.gap;

    // ✅ Add class to body/element to disable transitions
    document.body.classList.add('resizing-mode');
    el.classList.add('resizing');
    // 🔧 ВРЕМЕННОЕ РЕШЕНИЕ: меняем z-index напрямую
    el.style.zIndex = '1000';

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
      realPaddingRight,
      initialExpandLeft,  // ✅ Store initial expansion
      initialExpandRight  // ✅ Store initial expansion
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

      const maxLeftAbs = (weeksInYear * config.weekPx) - 10;
      newLeft = clamp(newLeft, config.cellPaddingLeft, maxLeftAbs);

      // Snap to grid
      if (pointerStateRef.current.edges.left || pointerStateRef.current.edges.right) {
        if (pointerStateRef.current.edges.left) {
          // 🔍 КРИТИЧНО: Используем РЕАЛЬНЫЕ padding (константные)
          // Слева ресайз: меняем startWeek и weeksSpan
          
          // Вычисляем логическую ширину (без expansion)
          const logicalWidth = newWidth 
            - (pointerStateRef.current.initialExpandLeft || 0) 
            - (pointerStateRef.current.initialExpandRight || 0);

          // Вычисляем deltaWeeks на основе dx
          // dx включает expansion difference? Нет, dx это mouse move.
          // Но newWidth меняется на -dx.
          // Лучше считать deltaWeeks от dx напрямую.
          let deltaWeeks = Math.round(dx / config.weekPx);

          // 🔒 Запрещаем уменьшать ширину меньше 1 недели при ресайзе слева
          if (deltaWeeks > pointerStateRef.current.originalWeeksSpan - 1) {
            deltaWeeks = pointerStateRef.current.originalWeeksSpan - 1;
          }

          let newStartWeek = clamp(pointerStateRef.current.originalStartWeek + deltaWeeks, 0, weeksInYear - 1);
          let newWeeksSpan = clamp(pointerStateRef.current.originalWeeksSpan - deltaWeeks, 1, weeksInYear - newStartWeek);
          if (newStartWeek + newWeeksSpan > weeksInYear) newWeeksSpan = weeksInYear - newStartWeek;
          
          // Чистая ширина
          newWidth = newWeeksSpan * config.weekPx - pointerStateRef.current.realPaddingLeft - pointerStateRef.current.realPaddingRight;
          newLeft = newStartWeek * config.weekPx + pointerStateRef.current.realPaddingLeft;
          
          // Добавляем начальное расширение обратно, чтобы коррекция в конце onMove сработала
          newWidth = newWidth + (pointerStateRef.current.initialExpandLeft || 0) + (pointerStateRef.current.initialExpandRight || 0);
          
          // newLeft также должен быть "базовым" (включающим начальное расширение влево),
          // потому что коррекция в конце вычитает (current - initial).
          // FinalLeft = CleanLeft - CurrentExpand.
          // Formula: NewLeft_Modified = NewLeft - (Current - Initial).
          // We want NewLeft_Modified = CleanLeft - Current.
          // So NewLeft must be CleanLeft - Initial.
          newLeft = newLeft - (pointerStateRef.current.initialExpandLeft || 0);

          // ✅ СОХРАНЯЕМ вычисленные значения для использования в onUp
          pointerStateRef.current.currentStartWeek = newStartWeek;
          pointerStateRef.current.currentWeeksSpan = newWeeksSpan;
        } else {
          // 🔍 КРИТИЧНО: Используем РЕАЛЬНЫЕ padding (константные)
          // Для расчета weeksSpan нам нужна "логическая" ширина без расширения
          // newWidth содержит initialExpandLeft + initialExpandRight (через startWidth) + dx
          // Поэтому вычитаем начальное расширение
          const logicalWidth = newWidth 
            - (pointerStateRef.current.initialExpandLeft || 0) 
            - (pointerStateRef.current.initialExpandRight || 0);

          let newWeeksSpan = Math.max(1, Math.round((logicalWidth + pointerStateRef.current.realPaddingLeft + pointerStateRef.current.realPaddingRight) / config.weekPx));
          newWeeksSpan = clamp(newWeeksSpan, 1, weeksInYear - pointerStateRef.current.originalStartWeek);
          
          // Базовая ширина по сетке (без расширений)
          // Используем её как основу, к которой потом добавится актуальное расширение в конце onMove
          newWidth = newWeeksSpan * config.weekPx - pointerStateRef.current.realPaddingLeft - pointerStateRef.current.realPaddingRight;
          
          // Добавляем начальное расширение обратно, чтобы коррекция в конце onMove сработала
          newWidth = newWidth + (pointerStateRef.current.initialExpandLeft || 0) + (pointerStateRef.current.initialExpandRight || 0);
          
          // ✅ СОХРАНЯЕМ вычисленные значения для использования в onUp
          pointerStateRef.current.currentWeeksSpan = newWeeksSpan;
        }
      }

      let currentUnitsTall = pointerStateRef.current.originalUnitsTall;

      if (pointerStateRef.current.edges.top || pointerStateRef.current.edges.bottom) {
        if (pointerStateRef.current.edges.top) {
          
          let deltaUnits = Math.round(dy / config.unitStride);

          
          // 🔒 Запрещаем уменьшать в��соту меньше 1 юнита при ресайзе сверху
          // originalUnitsTall - deltaUnits >= 1 => deltaUnits <= originalUnitsTall - 1
          if (deltaUnits > pointerStateRef.current.originalUnitsTall - 1) {

            deltaUnits = pointerStateRef.current.originalUnitsTall - 1;
          }

          const newUnitStart = clamp(pointerStateRef.current.originalUnitStart + deltaUnits, 0, UNITS - 1);
          const newUnitsTall = clamp(pointerStateRef.current.originalUnitsTall - deltaUnits, 1, UNITS - newUnitStart);
          

          
          newHeight = heightFor(newUnitsTall, config);
          newTop = topFor(pointerStateRef.current.evData.resourceId, newUnitStart, resources, visibleDepartments, config, gradesRef.current);
          currentUnitsTall = newUnitsTall;
          

          
          // ✅ СОХРАНЯЕМ вычисленные значения для использования в onUp
          pointerStateRef.current.currentUnitStart = newUnitStart;
          pointerStateRef.current.currentUnitsTall = newUnitsTall;
        } else {

          
          const deltaUnits = Math.round(dy / config.unitStride);

          
          const newUnitsTall = clamp(
            pointerStateRef.current.originalUnitsTall + deltaUnits, 
            1, 
            UNITS - pointerStateRef.current.originalUnitStart
          );
          

          
          newHeight = heightFor(newUnitsTall, config);
          currentUnitsTall = newUnitsTall;
          

          
          // ✅ СОХРАНЯЕМ вычисленные значения для использования в onUp
          pointerStateRef.current.currentUnitsTall = newUnitsTall;
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
      // Calculate new neighbors based on current resize state
      // We need to create a temporary event with current dimensions
      const tempEvent = {
        ...pointerStateRef.current.evData,
        startWeek: pointerStateRef.current.currentStartWeek !== undefined ? pointerStateRef.current.currentStartWeek : pointerStateRef.current.evData.startWeek,
        weeksSpan: pointerStateRef.current.currentWeeksSpan !== undefined ? pointerStateRef.current.currentWeeksSpan : pointerStateRef.current.evData.weeksSpan,
        unitStart: pointerStateRef.current.currentUnitStart !== undefined ? pointerStateRef.current.currentUnitStart : pointerStateRef.current.evData.unitStart,
        unitsTall: pointerStateRef.current.currentUnitsTall !== undefined ? pointerStateRef.current.currentUnitsTall : pointerStateRef.current.evData.unitsTall,
      };

      // Recalculate neighbors
      const otherEvents = eventsRef.current.filter(e => e.id !== tempEvent.id);
      const tempEvents = [...otherEvents, tempEvent];
      
      let neighborsMap;
      try {
        neighborsMap = calculateEventNeighbors(tempEvents, projectsRef.current);
      } catch (err) {
        console.error('❌ Error calculating neighbors during resize:', err);
      }

      if (neighborsMap) {
        const resizeInfo = neighborsMap.get(tempEvent.id);
        if (resizeInfo) {
             // Update resizing event styles (inner corners, etc.)
            const el = pointerStateRef.current.el;
            
            // 1. Apply Border Radius
            const r = getBorderRadiusForRowHeight(config.eventRowH);
            const tl = (resizeInfo.flags & MASK_ROUND_TL) ? r : 0;
            const tr = (resizeInfo.flags & MASK_ROUND_TR) ? r : 0;
            const br = (resizeInfo.flags & MASK_ROUND_BR) ? r : 0;
            const bl = (resizeInfo.flags & MASK_ROUND_BL) ? r : 0;
            el.style.borderRadius = `${tl}px ${tr}px ${br}px ${bl}px`;

            // 2. Apply Inner Colors & Classes
            const getCol = (pid?: string) => {
              if (!pid) return 'transparent';
              const p = projectsRef.current.find(prj => prj.id === pid);
              return p?.backgroundColor || 'transparent';
            };
            el.style.setProperty('--inner-tl-color', getCol(resizeInfo.innerTopLeftProjectId));
            el.style.setProperty('--inner-tr-color', getCol(resizeInfo.innerTopRightProjectId));
            el.style.setProperty('--inner-bl-color', getCol(resizeInfo.innerBottomLeftProjectId));
            el.style.setProperty('--inner-br-color', getCol(resizeInfo.innerBottomRightProjectId));

            el.classList.toggle('inner-tl', !!resizeInfo.innerTopLeftProjectId);
            el.classList.toggle('inner-tr', !!resizeInfo.innerTopRightProjectId);
            el.classList.toggle('inner-bl', !!resizeInfo.innerBottomLeftProjectId);
            el.classList.toggle('inner-br', !!resizeInfo.innerBottomRightProjectId);
            
            const wrapper = el.querySelector('.inner-bottom-wrapper');
            if (wrapper) {
              wrapper.classList.toggle('inner-bl', !!resizeInfo.innerBottomLeftProjectId);
              wrapper.classList.toggle('inner-br', !!resizeInfo.innerBottomRightProjectId);
            }

          // 🔍 КРИТИЧНО: Корректируем ширину и отступ с учётом склейки!
            // newWidth = "base" width from mouse drag + expansion difference
            // newLeft = "base" left from mouse drag - expansion difference (left side)
            
            const currentExpandLeft = (resizeInfo.expandLeftMultiplier || 0) * config.gap;
            const currentExpandRight = (resizeInfo.expandRightMultiplier || 0) * config.gap;
            const initialExpandLeft = pointerStateRef.current.initialExpandLeft || 0;
            const initialExpandRight = pointerStateRef.current.initialExpandRight || 0;
            
            const diffLeft = currentExpandLeft - initialExpandLeft;
            const diffRight = currentExpandRight - initialExpandRight;
            
            newWidth = newWidth + diffLeft + diffRight;
            newLeft = newLeft - diffLeft;
        }
        
        // Update neighbors
        updateNeighborStyles(neighborsMap);
      }

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

      // ✅ CLEANUP: Гарантированная очистка классов и стилей
      try {
        if (el.releasePointerCapture) {
           el.releasePointerCapture(ev.pointerId);
        }
      } catch (err) {
        console.warn('⚠️ releasePointerCapture failed:', err);
      }
      
      document.body.classList.remove('resizing-mode');
      document.body.classList.remove('dragging-mode'); // ✅ Safety cleanup
      el.classList.remove('dragging');
      el.classList.remove('resizing');
      el.style.zIndex = ''; // 🔧 Сбрасываем z-index

      // Снимаем метку с соседних событий
      affectedNeighbors.forEach(neighborEl => {
        neighborEl.classList.remove('resizing');
      });

      // 🚫 ВКЛЮЧАЕМ polling обратно
      setIsUserInteracting(false);

      // Сохраняем данные перед очисткой состояния
      const savedState = pointerStateRef.current;

      // ✅ Немедленно очищаем состояние и удаляем обработчики для мгновенного отклика
      pointerStateRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp); // ✅ Cleanup cancellation

      // ✅ v3.3.5: БЛОКИРУЕМ Delta Sync на 5 секунд после resize
      // Это предотвращает перезапись локальных изменений данными с сервера
      resetDeltaSyncTimer();

      // (savedState уже сохранен выше)

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
        // ✅ ИСПОЛЬЗУЕМ сохранённые значения из onMove вместо пересчёта из DOM координат!
        // Это гарантирует, что unitStart/unitsTall будут точно такими же, как были вычислены в onMove
        // Пересчёт из DOM координат приводит к ошибкам округления
        if (savedState.currentUnitStart !== undefined) {
          updatedEvent.unitStart = savedState.currentUnitStart;
        }
        if (savedState.currentUnitsTall !== undefined) {
          updatedEvent.unitsTall = savedState.currentUnitsTall;
        }
      }



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
    window.addEventListener('pointercancel', onUp); // ✅ Handle cancellation

    // 🚫 Отключаем polling
    setIsUserInteracting(true);
  }, [config, resources, visibleDepartments, events, projects, eventZOrder, onEventsUpdate, onEventZOrderUpdate, onSaveHistory, onEventUpdate, eventsContainerRef, setIsUserInteracting, resetDeltaSyncTimer, flushPendingChanges, updateHistoryEventId, updateNeighborStyles]); // ✅ v3.3.7: добавили flushPendingChanges и updateHistoryEventId

  return { startDrag, startResize };
}