import type { SchedulerEvent, EventGap, Resource, Department } from '../types/scheduler';

/**
 * Находит все промежутки (gaps) между событиями
 * Промежуток - это граница между двумя соседними событиями,
 * которую можно перетаскивать для одновременного изменения обоих событий
 */

export function findEventGaps(
  events: SchedulerEvent[],
  resources: Resource[],
  visibleDepartments: Department[]
): EventGap[] {
  const gaps: EventGap[] = [];
  
  // Получаем список видимых ресурсов
  const visibleResourceIds = new Set(
    resources
      .filter(r => visibleDepartments.some(d => 
        // For virtual "NO_DEPT" department, include resources without department_id
        // For real departments, match by exact department ID
        d.id === 'NO_DEPT' 
          ? !r.departmentId 
          : d.id === r.departmentId
      ))
      .map(r => r.id)
  );
  
  // Фильтруем только видимые события
  const visibleEvents = events.filter(e => visibleResourceIds.has(e.resourceId));
  
  // Группируем события по ресурсам
  const eventsByResource = new Map<string, SchedulerEvent[]>();
  visibleEvents.forEach(event => {
    if (!eventsByResource.has(event.resourceId)) {
      eventsByResource.set(event.resourceId, []);
    }
    eventsByResource.get(event.resourceId)!.push(event);
  });
  
  // Для каждого ресурса ищем gaps
  eventsByResource.forEach((resourceEvents, resourceId) => {
    // 1. Vertical gaps (между событиями по вертикали в пределах одной недели)
    const verticalGaps = findVerticalGaps(resourceEvents, resourceId);
    gaps.push(...verticalGaps);
    
    // 2. Horizontal gaps (между событиями по горизонтали в пределах одного unitStart)
    const horizontalGaps = findHorizontalGaps(resourceEvents, resourceId);
    gaps.push(...horizontalGaps);
  });
  
  return gaps;
}

/**
 * Находит вертикальные gaps (между событиями сверху-снизу)
 * События должны быть на одной неделе и касаться друг друга по вертикали
 */
function findVerticalGaps(events: SchedulerEvent[], resourceId: string): EventGap[] {
  const gaps: EventGap[] = [];
  const processedPairs = new Set<string>(); // Для предотвращения дубликатов
  
  // Группируем события по неделям (событие может занимать несколько недель)
  const eventsByWeek = new Map<number, SchedulerEvent[]>();
  
  events.forEach(event => {
    // Добавляем событие для каждой недели которую оно занимает
    for (let week = event.startWeek; week < event.startWeek + event.weeksSpan; week++) {
      if (!eventsByWeek.has(week)) {
        eventsByWeek.set(week, []);
      }
      eventsByWeek.get(week)!.push(event);
    }
  });
  
  // Для каждой недели ищем соседние события по вертикали
  eventsByWeek.forEach((weekEvents, week) => {
    // Сортируем по unitStart
    const sortedEvents = [...weekEvents].sort((a, b) => a.unitStart - b.unitStart);
    
    // Ищем соседние события которые касаются друг друга
    for (let i = 0; i < sortedEvents.length - 1; i++) {
      const event1 = sortedEvents[i];
      const event2 = sortedEvents[i + 1];
      
      // Проверяем что события касаются (нижняя граница первого = верхняя граница второго)
      const event1Bottom = event1.unitStart + event1.unitsTall;
      const event2Top = event2.unitStart;
      
      if (event1Bottom === event2Top) {
        // Создаём уникальный ключ для пары событий (без учёта недели)
        const pairKey = `${event1.id}-${event2.id}`;
        
        // Создаём gap только один раз для пары событий
        if (!processedPairs.has(pairKey)) {
          processedPairs.add(pairKey);
          
          gaps.push({
            id: `vgap-${resourceId}-${week}-${event1.id}-${event2.id}`,
            type: 'vertical',
            resourceId,
            week,
            unitBoundary: event2Top,
            event1,
            event2,
          });
        }
      }
    }
  });
  
  return gaps;
}

/**
 * Находит горизонтальные gaps (между событиями слева-справа)
 * События должны быть на одном unitStart и касаться друг друга по горизонтали
 */
function findHorizontalGaps(events: SchedulerEvent[], resourceId: string): EventGap[] {
  const gaps: EventGap[] = [];
  const processedPairs = new Set<string>(); // Для предотвращения дубликатов
  
  // Группируем события по unitStart range (событие может занимать несколько units)
  const eventsByUnitRange = new Map<string, SchedulerEvent[]>();
  
  events.forEach(event => {
    // Добавляем событие для каждого unit который оно занимает
    for (let unit = event.unitStart; unit < event.unitStart + event.unitsTall; unit++) {
      const key = `${unit}`;
      if (!eventsByUnitRange.has(key)) {
        eventsByUnitRange.set(key, []);
      }
      eventsByUnitRange.get(key)!.push(event);
    }
  });
  
  // Для каждого unit range ищем соседние события по горизонтали
  eventsByUnitRange.forEach((unitEvents, unitKey) => {
    const unitStart = parseInt(unitKey);
    
    // Сортируем по startWeek
    const sortedEvents = [...unitEvents].sort((a, b) => a.startWeek - b.startWeek);
    
    // Ищем соседние события которые касаются друг друга
    for (let i = 0; i < sortedEvents.length - 1; i++) {
      const event1 = sortedEvents[i];
      const event2 = sortedEvents[i + 1];
      
      // Проверяем что события касаются (правая граница первого = левая граница второго)
      const event1Right = event1.startWeek + event1.weeksSpan;
      const event2Left = event2.startWeek;
      
      if (event1Right === event2Left) {
        // Проверяем что события перекрываются по вертикали
        const event1Bottom = event1.unitStart + event1.unitsTall;
        const event2Bottom = event2.unitStart + event2.unitsTall;
        const overlapTop = Math.max(event1.unitStart, event2.unitStart);
        const overlapBottom = Math.min(event1Bottom, event2Bottom);
        
        if (overlapBottom > overlapTop) {
          // Создаём уникальный ключ для пары событий (без учёта unit)
          const pairKey = `${event1.id}-${event2.id}`;
          
          // Создаём gap только один раз для пары событий
          if (!processedPairs.has(pairKey)) {
            processedPairs.add(pairKey);
            
            gaps.push({
              id: `hgap-${resourceId}-${unitStart}-${event1.id}-${event2.id}`,
              type: 'horizontal',
              resourceId,
              unitStart,
              weekBoundary: event2Left,
              event1,
              event2,
            });
          }
        }
      }
    }
  });
  
  return gaps;
}

/**
 * Вычисляет новые размеры событий при перетаскивании gap границы
 * + находит все "прилипшие" события которые тоже нужно двигать
 * @param gap - промежуток между событиями
 * @param delta - изменение позиции границы (в units для vertical, в weeks для horizontal)
 * @param allEvents - все события (для поиска прилипших)
 * @returns новые данные для всех затронутых событий
 */
export function calculateGapResize(
  gap: EventGap,
  delta: number,
  allEvents?: SchedulerEvent[]
): {
  event1Update: Partial<SchedulerEvent>;
  event2Update: Partial<SchedulerEvent>;
  attachedUpdates?: Map<string, Partial<SchedulerEvent>>; // ID события -> обновления
} | null {
  if (gap.type === 'vertical') {
    // Вертикальный gap: изменяем unitsTall первого и unitStart + unitsTall второго
    const newEvent1UnitsTall = gap.event1.unitsTall + delta;
    const newEvent2UnitStart = gap.event2.unitStart + delta;
    const newEvent2UnitsTall = gap.event2.unitsTall - delta;
    
    // Валидация: события не должны исчезнуть
    if (newEvent1UnitsTall < 1 || newEvent2UnitsTall < 1) {
      return null;
    }
    
    // Валидация: события не должны выходить за пределы
    if (newEvent2UnitStart < 0 || newEvent2UnitStart + newEvent2UnitsTall > 16) {
      return null;
    }
    
    return {
      event1Update: { unitsTall: newEvent1UnitsTall },
      event2Update: { unitStart: newEvent2UnitStart, unitsTall: newEvent2UnitsTall },
    };
  } else {
    // Горизонтальный gap: изменяем weeksSpan первого и startWeek + weeksSpan второго
    const newEvent1WeeksSpan = gap.event1.weeksSpan + delta;
    const newEvent2StartWeek = gap.event2.startWeek + delta;
    const newEvent2WeeksSpan = gap.event2.weeksSpan - delta;
    
    // Валидация: события не должны исчезнуть
    if (newEvent1WeeksSpan < 1 || newEvent2WeeksSpan < 1) {
      return null;
    }
    
    // Валидация: события не должны выходить за пределы
    if (newEvent2StartWeek < 0 || newEvent2StartWeek + newEvent2WeeksSpan > 52) {
      return null;
    }
    
    const result: {
      event1Update: Partial<SchedulerEvent>;
      event2Update: Partial<SchedulerEvent>;
      attachedUpdates?: Map<string, Partial<SchedulerEvent>>;
    } = {
      event1Update: { weeksSpan: newEvent1WeeksSpan },
      event2Update: { startWeek: newEvent2StartWeek, weeksSpan: newEvent2WeeksSpan },
    };
    
    // Находим "прилипшие" события если передан allEvents
    if (allEvents) {
      const attachedUpdates = new Map<string, Partial<SchedulerEvent>>();
      
      // Граница между event1 и event2 (weekBoundary)
      const boundary = gap.weekBoundary!;
      
      // Находим все события на той же строке (resourceId)
      const sameRowEvents = allEvents.filter(e => e.resourceId === gap.resourceId);
      
      // Event1 заканчивается на boundary (occupies weeks from event1.startWeek to boundary-1)
      // Event2 начинается на boundary (occupies weeks from boundary onwards)
      
      // Находим ВСЕ события которые касаются границы (независимо от event1/event2):
      sameRowEvents.forEach(event => {
        // Пропускаем event1 и event2
        if (event.id === gap.event1.id || event.id === gap.event2.id) return;
        
        const eventRight = event.startWeek + event.weeksSpan;
        
        // СЛУЧАЙ 1: Событие ЗАКАНЧИВАЕТСЯ на границе
        // → Расширяем/сжимаем его weeksSpan (граница двигается → событие тоже)
        if (eventRight === boundary) {
          const newWeeksSpan = event.weeksSpan + delta;
          
          // FIX: Не даем уменьшить меньше 1 недели
          if (newWeeksSpan < 1) {
            return; 
          }
          
          attachedUpdates.set(event.id, { weeksSpan: newWeeksSpan });
        }
        
        // СЛУЧАЙ 2: Событие НАЧИНАЕТСЯ на границе
        // → Сдвигаем его startWeek + изменяем weeksSpan (граница двигается → событие тоже)
        else if (event.startWeek === boundary) {
          const newStartWeek = event.startWeek + delta;
          const newWeeksSpan = event.weeksSpan - delta;
          
          // FIX: Не даем уменьшить меньше 1 недели
          if (newWeeksSpan < 1 || newStartWeek < 0) {
             return;
          }
          
          attachedUpdates.set(event.id, { 
            startWeek: newStartWeek,
            weeksSpan: newWeeksSpan 
          });
        }
      });
      
      if (attachedUpdates.size > 0) {
        result.attachedUpdates = attachedUpdates;
      }
    }
    
    return result;
  }
}