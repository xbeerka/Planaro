import { useState, useCallback, useRef } from 'react';
import { SchedulerEvent, Project } from '../types/scheduler';

const MAX_HISTORY = 50;

interface HistoryState {
  events: SchedulerEvent[];
  projects: Project[];
  eventZOrder: Map<string, number>;
  timestamp: number;
  /**
   * ID событий, которые пользователь ИЗМЕНИЛ в переходе к этому снапшоту.
   * Используется для Selective Rebase — rebaseEvent НЕ перезаписывает
   * эти события, чтобы Undo/Redo корректно восстанавливал пользовательские изменения.
   */
  modifiedEventIds: Set<string>;
}

/**
 * Вычисляет какие события изменились между двумя массивами.
 * Возвращает Set из ID событий, которые были добавлены, удалены или изменены.
 */
function computeModifiedEventIds(
  prevEvents: SchedulerEvent[],
  nextEvents: SchedulerEvent[]
): Set<string> {
  const modified = new Set<string>();
  
  const prevMap = new Map<string, SchedulerEvent>();
  for (const e of prevEvents) prevMap.set(e.id, e);
  
  const nextMap = new Map<string, SchedulerEvent>();
  for (const e of nextEvents) nextMap.set(e.id, e);
  
  // Найти изменённые и удалённые
  for (const [id, prev] of prevMap) {
    const next = nextMap.get(id);
    if (!next) {
      // Удалён
      modified.add(id);
    } else if (
      prev.resourceId !== next.resourceId ||
      prev.projectId !== next.projectId ||
      prev.startWeek !== next.startWeek ||
      prev.weeksSpan !== next.weeksSpan ||
      prev.unitStart !== next.unitStart ||
      prev.unitsTall !== next.unitsTall ||
      prev.patternId !== next.patternId
    ) {
      // Изменён
      modified.add(id);
    }
  }
  
  // Найти добавленные
  for (const id of nextMap.keys()) {
    if (!prevMap.has(id)) {
      modified.add(id);
    }
  }
  
  return modified;
}

export function useOptimisticHistory(initialEvents: SchedulerEvent[], initialProjects: Project[]) {
  const [version, setVersion] = useState(0);
  
  const historyRef = useRef<{
    past: HistoryState[];
    present: HistoryState;
    future: HistoryState[];
  }>({
    past: [],
    present: { 
      events: initialEvents, 
      projects: initialProjects,
      eventZOrder: new Map(),
      modifiedEventIds: new Set(),
      timestamp: Date.now() 
    },
    future: []
  });

  const notifyChange = useCallback(() => {
    setVersion(v => v + 1);
  }, []);

  // Initialize/Reset history
  const resetHistory = useCallback((
    events: SchedulerEvent[], 
    projects: Project[],
    eventZOrder: Map<string, number> = new Map()
  ) => {
    historyRef.current = {
      past: [],
      present: { 
        events: JSON.parse(JSON.stringify(events)), 
        projects: JSON.parse(JSON.stringify(projects)),
        eventZOrder: new Map(eventZOrder),
        modifiedEventIds: new Set(),
        timestamp: Date.now()
      },
      future: []
    };
    notifyChange();
  }, [notifyChange]);

  // Push new state
  const pushState = useCallback((
    events: SchedulerEvent[], 
    projects: Project[],
    eventZOrder: Map<string, number> = new Map()
  ) => {
    const current = historyRef.current;
    
    if (
      current.present.events === events && 
      current.present.projects === projects
    ) {
      return;
    }

    // Вычисляем какие события пользователь изменил в этом переходе
    const modifiedIds = computeModifiedEventIds(current.present.events, events);

    // Limit history size
    if (current.past.length >= MAX_HISTORY) {
      current.past.shift();
    }

    current.past.push(current.present);
    current.present = {
      events: JSON.parse(JSON.stringify(events)),
      projects: JSON.parse(JSON.stringify(projects)),
      eventZOrder: new Map(eventZOrder),
      modifiedEventIds: modifiedIds,
      timestamp: Date.now()
    };
    current.future = [];
    
    if (modifiedIds.size > 0) {
      console.log(`📝 History push: ${modifiedIds.size} событий изменено пользователем:`, [...modifiedIds]);
    }
    
    notifyChange();
  }, [notifyChange]);

  // Direct access to current state
  const getSnapshot = useCallback(() => {
    return {
      events: historyRef.current.present.events,
      projects: historyRef.current.present.projects,
      eventZOrder: historyRef.current.present.eventZOrder
    };
  }, []);

  // Undo
  const undo = useCallback(() => {
    const current = historyRef.current;
    if (current.past.length === 0) {
      console.log('🔄 UNDO: история пуста (past.length = 0)');
      return null;
    }

    const previous = current.past.pop()!;
    current.future.push(current.present);
    current.present = previous;

    console.log(`🔄 UNDO: восстановлено ${previous.events.length} событий, ${previous.projects.length} проектов, ${previous.eventZOrder.size} z-order (past: ${current.past.length}, future: ${current.future.length})`);

    notifyChange();
    return { 
      events: previous.events, 
      projects: previous.projects,
      eventZOrder: previous.eventZOrder
    };
  }, [notifyChange]);

  // Redo
  const redo = useCallback(() => {
    const current = historyRef.current;
    if (current.future.length === 0) {
      console.log('🔄 REDO: нет доступных состояний для redo (future.length = 0)');
      return null;
    }

    const next = current.future.pop()!;
    current.past.push(current.present);
    current.present = next;

    console.log(`🔄 REDO: восстановлено ${next.events.length} событий, ${next.projects.length} проектов, ${next.eventZOrder.size} z-order (past: ${current.past.length}, future: ${current.future.length})`);

    notifyChange();
    return { 
      events: next.events, 
      projects: next.projects,
      eventZOrder: next.eventZOrder
    };
  }, [notifyChange]);

  // Update ID deep in history (for when server confirms a temp ID)
  const updateHistoryEventId = useCallback((tempId: string, realId: string) => {
    const replaceIdInList = (list: SchedulerEvent[]) => {
      // ✅ КРИТИЧНО: Если realId уже есть в списке (от rebaseInsertEvent),
      // просто удаляем temp версию вместо переименования (иначе будет дубликат)
      const hasRealId = list.some(ev => ev.id === realId);
      if (hasRealId) {
        return list.filter(ev => ev.id !== tempId);
      }
      return list.map(ev => ev.id === tempId ? { ...ev, id: realId } : ev);
    };
    
    const replaceIdInSet = (set: Set<string>) => {
      if (set.has(tempId)) {
        set.delete(tempId);
        set.add(realId);
      }
    };

    const current = historyRef.current;

    current.past.forEach(state => {
      state.events = replaceIdInList(state.events);
      if (state.modifiedEventIds) replaceIdInSet(state.modifiedEventIds);
    });

    current.present.events = replaceIdInList(current.present.events);
    if (current.present.modifiedEventIds) replaceIdInSet(current.present.modifiedEventIds);

    current.future.forEach(state => {
      state.events = replaceIdInList(state.events);
      if (state.modifiedEventIds) replaceIdInSet(state.modifiedEventIds);
    });
    
    notifyChange();
  }, [notifyChange]);

  /**
   * 🔄 Selective Rebase UPDATE: обновить событие в истории от другого пользователя.
   * 
   * КЛЮЧЕВОЕ ОТЛИЧИЕ от старой версии:
   * - Старая: обновляла событие во ВСЕХ снапшотах → Undo бесполезен
   * - Новая: ПРОПУСКАЕТ снапшоты где пользователь сам менял это событие
   * 
   * Логика: если в снапшоте или в СЛЕДУЮЩЕМ за ним снапшоте событие помечено
   * как modifiedEventIds, значит пользователь менял его → не перезаписываем.
   * Это сохраняет возможность Undo/Redo для пользовательских изменений.
   */
  const rebaseEvent = useCallback((eventId: string, newData: Partial<SchedulerEvent>) => {
    const current = historyRef.current;
    
    // Собираем все снапшоты в порядке: past[0], past[1], ..., present, future[last], ..., future[0]
    const allStates = [...current.past, current.present, ...current.future];
    
    // Определяем в каких снапшотах пользователь менял это событие
    // Событие "защищено" если оно в modifiedEventIds текущего снапшота
    // ИЛИ следующего (т.к. modifiedEventIds хранит что изменилось В ПЕРЕХОДЕ К этому снапшоту,
    // значит предыдущий снапшот содержит "до" версию этого изменения — её тоже нужно сохранить)
    const protectedIndices = new Set<number>();
    
    for (let i = 0; i < allStates.length; i++) {
      const mids = allStates[i].modifiedEventIds;
      if (mids && mids.has(eventId)) {
        protectedIndices.add(i);     // Сам снапшот с изменением
        protectedIndices.add(i - 1); // Предыдущий (содержит "до")
      }
    }
    
    let rebased = 0;
    let skipped = 0;
    
    const updateInState = (state: HistoryState, index: number) => {
      if (protectedIndices.has(index)) {
        skipped++;
        return;
      }
      
      const idx = state.events.findIndex(e => e.id === eventId);
      if (idx !== -1) {
        state.events = state.events.map(e => 
          e.id === eventId ? { ...e, ...newData } : e
        );
        rebased++;
      }
    };

    allStates.forEach((state, index) => updateInState(state, index));
    
    console.log(`🔄 History selective rebase UPDATE: ${eventId} — rebased: ${rebased}, protected: ${skipped} (user edits preserved)`);
  }, []);

  // 🗑️ Rebase DELETE: удалить событие из истории
  // Используем Selective подход: НЕ удаляем из снапшотов, где пользователь
  // сам менял это событие — это сохраняет возможность Undo для пользовательских действий.
  // Удаляем только из "чистых" снапшотов (изменения другого юзера).
  const rebaseDeleteEvent = useCallback((eventId: string) => {
    const current = historyRef.current;
    
    // Собираем все снапшоты
    const allStates = [...current.past, current.present, ...current.future];
    
    // Определяем защищённые снапшоты (где пользователь менял это событие)
    const protectedIndices = new Set<number>();
    for (let i = 0; i < allStates.length; i++) {
      const mids = allStates[i].modifiedEventIds;
      if (mids && mids.has(eventId)) {
        protectedIndices.add(i);     // Сам снапшот
        protectedIndices.add(i - 1); // Предыдущий ("до" версия)
      }
    }
    
    let removed = 0;
    let skipped = 0;
    
    allStates.forEach((state, index) => {
      if (protectedIndices.has(index)) {
        skipped++;
        return;
      }
      const before = state.events.length;
      state.events = state.events.filter(e => e.id !== eventId);
      if (state.events.length < before) removed++;
      if (state.modifiedEventIds) state.modifiedEventIds.delete(eventId);
    });
    
    console.log(`🗑️ History rebase DELETE: ${eventId} — removed: ${removed}, protected: ${skipped}`);
  }, []);

  // ✨ Rebase INSERT: добавить событие в ТЕКУЩЕЕ состояние истории
  // НЕ добавляем в past — прошлые снапшоты отражают состояние ДО создания события.
  // Если добавить в past, то Undo будет "воскрешать" событие в состояниях,
  // где его не было (например, разрез → undo → правая часть не исчезает).
  // Delta Sync позаботится о событиях других пользователей при необходимости.
  const rebaseInsertEvent = useCallback((event: SchedulerEvent) => {
    const current = historyRef.current;
    
    const addToState = (state: HistoryState) => {
      if (!state.events.some(e => e.id === event.id)) {
        state.events = [...state.events, JSON.parse(JSON.stringify(event))];
      }
    };

    // ✅ Только present — past снапшоты отражают историю пользователя
    addToState(current.present);
    
    console.log(`✨ History rebase INSERT: ${event.id} добавлен в present`);
  }, []);

  return {
    undo,
    redo,
    pushState,
    resetHistory,
    updateHistoryEventId,
    rebaseEvent,
    rebaseDeleteEvent,
    rebaseInsertEvent,
    canUndo: historyRef.current.past.length > 0,
    canRedo: historyRef.current.future.length > 0,
    currentEvents: historyRef.current.present.events,
    currentProjects: historyRef.current.present.projects,
    currentEventZOrder: historyRef.current.present.eventZOrder,
    getSnapshot
  };
}