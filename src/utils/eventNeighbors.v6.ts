import { SchedulerEvent, Project } from '../types/scheduler';

// ============================================
// CONFIGURATION
// ============================================
const DEBUG = false; // Set to true for detailed logging

// ============================================
// TYPES
// ============================================

/**
 * Информация о соседях события для склейки
 */
export interface EventNeighborsInfo {
  // Типы соседей слева
  hasFullLeftNeighbor: boolean;      // Сосед полностью покрывает высоту (одинаковая высота)
  hasPartialLeftNeighbor: boolean;   // Частичное покрытие (1 внутренний угол)
  hasBothLeftNeighbors: boolean;     // 2 соседа покрывают сверху и снизу (2 внутренних угла)
  
  // Типы соседей справа
  hasFullRightNeighbor: boolean;     // Сосед полностью покрывает высоту (одинаковая высота)
  hasPartialRightNeighbor: boolean;  // Частичное покрытие (1 внутренний угол)
  hasBothRightNeighbors: boolean;    // 2 соседа покрывают сверху и снизу (2 внутренних угла)
  
  // Величина расширения (в единицах gap)
  expandLeftMultiplier: number;  // 0, 1, 2, ...
  expandRightMultiplier: number; // 0, 1, 2, ...
  
  // Какие углы скруглены (позитивная логика)
  roundTopLeft: boolean;
  roundTopRight: boolean;
  roundBottomLeft: boolean;
  roundBottomRight: boolean;
  
  // Цвета соседей для внутренних скруглений
  innerTopLeftColor?: string;
  innerBottomLeftColor?: string;
  innerTopRightColor?: string;
  innerBottomRightColor?: string;
}

/**
 * Индекс событий для быстрого поиска
 * Map<resourceId, Map<week, Event[]>>
 */
type EventIndex = Map<string, Map<number, SchedulerEvent[]>>;

/**
 * Проектный индекс для быстрого поиска цветов
 */
type ProjectIndex = Map<string, Project>;

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Создаёт индекс событий для быстрого поиска O(1) вместо O(n)
 */
function createEventIndex(events: SchedulerEvent[]): EventIndex {
  const index: EventIndex = new Map();
  
  for (const event of events) {
    // Получаем или создаём Map для ресурса
    let resourceMap = index.get(event.resourceId);
    if (!resourceMap) {
      resourceMap = new Map();
      index.set(event.resourceId, resourceMap);
    }
    
    // Добавляем событие на все недели которые оно покрывает
    for (let w = event.startWeek; w < event.startWeek + event.weeksSpan; w++) {
      let weekEvents = resourceMap.get(w);
      if (!weekEvents) {
        weekEvents = [];
        resourceMap.set(w, weekEvents);
      }
      weekEvents.push(event);
    }
  }
  
  return index;
}

/**
 * Создаёт индекс проектов для быстрого поиска цветов
 */
function createProjectIndex(projects: Project[]): ProjectIndex {
  const index = new Map<string, Project>();
  for (const project of projects) {
    index.set(project.id, project);
  }
  return index;
}

/**
 * Находит события на указанной неделе у указанного ресурса
 */
function getEventsAt(
  index: EventIndex,
  resourceId: string,
  week: number
): SchedulerEvent[] {
  return index.get(resourceId)?.get(week) || [];
}

/**
 * Проверяет пересечение двух событий по высоте (unitStart/unitsTall)
 */
function checkVerticalOverlap(
  event1Top: number,
  event1Bottom: number,
  event2Top: number,
  event2Bottom: number
): boolean {
  return event1Top <= event2Bottom && event2Top <= event1Bottom;
}

/**
 * Находит соседей события на указанной стороне
 */
function findNeighbors(
  index: EventIndex,
  event: SchedulerEvent,
  side: 'left' | 'right',
  filterOptions?: {
    sameProject?: boolean;
    differentProject?: boolean;
    excludeEventId?: string;
  }
): SchedulerEvent[] {
  const eventTop = event.unitStart;
  const eventBottom = event.unitStart + event.unitsTall - 1;
  
  // Определяем неделю для поиска
  const targetWeek = side === 'left' 
    ? event.startWeek - 1 
    : event.startWeek + event.weeksSpan;
  
  // Получаем все события на этой неделе
  const candidates = getEventsAt(index, event.resourceId, targetWeek);
  
  // Фильтруем соседей
  return candidates.filter(neighbor => {
    // Исключаем само событие
    if (filterOptions?.excludeEventId && neighbor.id === filterOptions.excludeEventId) {
      return false;
    }
    
    // Фильтр по проекту
    if (filterOptions?.sameProject && neighbor.projectId !== event.projectId) {
      return false;
    }
    if (filterOptions?.differentProject && neighbor.projectId === event.projectId) {
      return false;
    }
    
    // Проверяем что сосед именно на нужной неделе (не просто покрывает её)
    if (side === 'left') {
      // Левый сосед должен ЗАКАНЧИВАТЬСЯ на этой неделе
      if (neighbor.startWeek + neighbor.weeksSpan - 1 !== targetWeek) {
        return false;
      }
    } else {
      // Правый сосед должен НАЧИНАТЬСЯ на этой неделе
      if (neighbor.startWeek !== targetWeek) {
        return false;
      }
    }
    
    // Проверяем пересечение по высоте
    const neighborTop = neighbor.unitStart;
    const neighborBottom = neighbor.unitStart + neighbor.unitsTall - 1;
    return checkVerticalOverlap(eventTop, eventBottom, neighborTop, neighborBottom);
  });
}

/**
 * Анализирует соседей и возвращает информацию о покрытии углов
 */
function analyzeNeighborCoverage(
  neighbors: SchedulerEvent[],
  event: SchedulerEvent,
  projectIndex: ProjectIndex
): {
  hasFull: boolean;
  hasPartial: boolean;
  hasBoth: boolean;
  hasTopCovered: boolean;
  hasBottomCovered: boolean;
  innerTopColor?: string;
  innerBottomColor?: string;
  alignedTop: boolean;
  alignedBottom: boolean;
} {
  const eventTop = event.unitStart;
  const eventBottom = event.unitStart + event.unitsTall - 1;
  
  let hasFull = false;
  let hasTopCovered = false;
  let hasBottomCovered = false;
  let innerTopColor: string | undefined;
  let innerBottomColor: string | undefined;
  let alignedTop = false;
  let alignedBottom = false;
  
  for (const neighbor of neighbors) {
    const nTop = neighbor.unitStart;
    const nBottom = neighbor.unitStart + neighbor.unitsTall - 1;
    
    // Полное покрытие (одинаковая высота)
    if (nTop === eventTop && nBottom === eventBottom) {
      hasFull = true;
    }
    
    // Покрытие верхнего угла
    if (nTop <= eventTop && eventTop <= nBottom) {
      hasTopCovered = true;
      // Внутренний угол: сосед начинается ВЫШЕ
      if (nTop < eventTop) {
        const project = projectIndex.get(neighbor.projectId);
        innerTopColor = project?.backgroundColor;
      }
    }
    
    // Покрытие нижнего угла
    if (nTop <= eventBottom && eventBottom <= nBottom) {
      hasBottomCovered = true;
      // Внутренний угол: сосед заканчивается НИЖЕ
      if (nBottom > eventBottom) {
        const project = projectIndex.get(neighbor.projectId);
        innerBottomColor = project?.backgroundColor;
      }
    }
    
    // Выравнивание границ
    if (nTop === eventTop) alignedTop = true;
    if (nBottom === eventBottom) alignedBottom = true;
  }
  
  const hasPartial = (hasTopCovered || hasBottomCovered) && !hasFull;
  const hasBoth = hasTopCovered && hasBottomCovered && !hasFull && neighbors.length >= 2;
  
  return {
    hasFull,
    hasPartial,
    hasBoth,
    hasTopCovered,
    hasBottomCovered,
    innerTopColor,
    innerBottomColor,
    alignedTop,
    alignedBottom
  };
}

// ============================================
// MAIN ALGORITHM
// ============================================

/**
 * ОПТИМИЗИРОВАННЫЙ АЛГОРИТМ СКЛЕЙКИ v6.0
 * 
 * Улучшения:
 * - Индексация событий O(1) вместо O(n) для поиска соседей
 * - Утилитарные функции для переиспользования кода
 * - Меньше проходов (4 вместо 5)
 * - Опциональные логи (DEBUG mode)
 * - Чистый и читаемый код
 * 
 * Правила:
 * 1. События с внутренними углами расширяются на 1 gap в эту сторону
 * 2. Соседи расширяются навстречу на 1 gap
 * 3. При полной склейке (одинаковая высота) расширения нет (padding убран)
 * 4. Если другой проект в той же ячейке имеет соседа с пересечением → блокируем расширение
 * 5. Поджатие событий с внешними углами если есть внутренние углы в ячейке
 * 6. Компенсация для соседей поджатых событий
 * 7. Откусывание при вклинивании между событиями с ДВОЙНЫМ gap
 */
export function calculateEventNeighbors(
  events: SchedulerEvent[],
  projects: Project[]
): Map<string, EventNeighborsInfo> {
  if (DEBUG) {
    console.log('🔄 calculateEventNeighbors v6.0 OPTIMIZED! События:', events.length, 'Проекты:', projects.length);
  }
  
  const neighbors = new Map<string, EventNeighborsInfo>();
  
  // ========================================
  // STEP 0: Создаём индексы для быстрого поиска
  // ========================================
  const eventIndex = createEventIndex(events);
  const projectIndex = createProjectIndex(projects);
  
  if (DEBUG) {
    console.log('📇 Индексы созданы:', {
      resources: eventIndex.size,
      projects: projectIndex.size
    });
  }
  
  // ========================================
  // PASS 1: Базовое расширение + вычисление углов
  // ========================================
  // Объединили два прохода в один для оптимизации!
  for (const event of events) {
    // Находим соседей
    const leftNeighbors = findNeighbors(eventIndex, event, 'left', { sameProject: true });
    const rightNeighbors = findNeighbors(eventIndex, event, 'right', { sameProject: true });
    
    // Анализируем покрытие
    const leftCoverage = analyzeNeighborCoverage(leftNeighbors, event, projectIndex);
    const rightCoverage = analyzeNeighborCoverage(rightNeighbors, event, projectIndex);
    
    // Базовое расширение: события с внутренними углами расширяются на 1 gap
    // При полной склейке расширения НЕТ
    const hasInnerLeft = !!leftCoverage.innerTopColor || !!leftCoverage.innerBottomColor;
    const hasInnerRight = !!rightCoverage.innerTopColor || !!rightCoverage.innerBottomColor;
    
    const expandLeft = (hasInnerLeft && !leftCoverage.hasFull) ? 1 : 0;
    const expandRight = (hasInnerRight && !rightCoverage.hasFull) ? 1 : 0;
    
    // Вычисляем какие углы скруглены
    // Угол НЕ скруглён если: полная склейка ИЛИ внутренний угол ИЛИ границы выровнены
    const roundTopLeft = !(leftCoverage.hasFull || !!leftCoverage.innerTopColor || leftCoverage.alignedTop);
    const roundBottomLeft = !(leftCoverage.hasFull || !!leftCoverage.innerBottomColor || leftCoverage.alignedBottom);
    const roundTopRight = !(rightCoverage.hasFull || !!rightCoverage.innerTopColor || rightCoverage.alignedTop);
    const roundBottomRight = !(rightCoverage.hasFull || !!rightCoverage.innerBottomColor || rightCoverage.alignedBottom);
    
    // Сохраняем результат
    neighbors.set(event.id, {
      hasFullLeftNeighbor: leftCoverage.hasFull,
      hasPartialLeftNeighbor: leftCoverage.hasPartial,
      hasBothLeftNeighbors: leftCoverage.hasBoth,
      hasFullRightNeighbor: rightCoverage.hasFull,
      hasPartialRightNeighbor: rightCoverage.hasPartial,
      hasBothRightNeighbors: rightCoverage.hasBoth,
      expandLeftMultiplier: expandLeft,
      expandRightMultiplier: expandRight,
      innerTopLeftColor: leftCoverage.innerTopColor,
      innerBottomLeftColor: leftCoverage.innerBottomColor,
      innerTopRightColor: rightCoverage.innerTopColor,
      innerBottomRightColor: rightCoverage.innerBottomColor,
      roundTopLeft,
      roundTopRight,
      roundBottomLeft,
      roundBottomRight,
    });
  }
  
  // ========================================
  // PASS 2: Расширение навстречу + блокировка конфликтов
  // ========================================
  for (const event of events) {
    const neighborInfo = neighbors.get(event.id);
    if (!neighborInfo) continue;
    
    const eventTop = event.unitStart;
    const eventBottom = event.unitStart + event.unitsTall - 1;
    
    // Проверяем правых соседей
    const rightNeighbors = findNeighbors(eventIndex, event, 'right', { sameProject: true });
    const shouldExpandRight = rightNeighbors.some(neighbor => {
      const nInfo = neighbors.get(neighbor.id);
      return nInfo && (nInfo.innerTopLeftColor || nInfo.innerBottomLeftColor);
    });
    
    // Блокировка конфликтов с другими проектами
    let blockExpandRight = false;
    if (shouldExpandRight) {
      const otherProjectsInSameCell = getEventsAt(eventIndex, event.resourceId, event.startWeek)
        .filter(e => 
          e.id !== event.id &&
          e.projectId !== event.projectId &&
          checkVerticalOverlap(eventTop, eventBottom, e.unitStart, e.unitStart + e.unitsTall - 1)
        );
      
      for (const otherEvent of otherProjectsInSameCell) {
        const otherTop = otherEvent.unitStart;
        const otherBottom = otherEvent.unitStart + otherEvent.unitsTall - 1;
        
        const otherRightNeighbor = findNeighbors(eventIndex, otherEvent, 'right', { sameProject: true })
          .find(n => checkVerticalOverlap(eventTop, eventBottom, n.unitStart, n.unitStart + n.unitsTall - 1));
        
        if (otherRightNeighbor) {
          blockExpandRight = true;
          if (DEBUG) {
            console.log(`🚫 БЛОКИРОВКА RIGHT для события ${event.id}: конфликт с проектом ${otherEvent.projectId}`);
          }
          break;
        }
      }
    }
    
    if (shouldExpandRight && !blockExpandRight && neighborInfo.expandRightMultiplier === 0) {
      neighborInfo.expandRightMultiplier = 1;
    }
    
    // Проверяем левых соседей
    const leftNeighbors = findNeighbors(eventIndex, event, 'left', { sameProject: true });
    const shouldExpandLeft = leftNeighbors.some(neighbor => {
      const nInfo = neighbors.get(neighbor.id);
      return nInfo && (nInfo.innerTopRightColor || nInfo.innerBottomRightColor);
    });
    
    // Блокировка конфликтов с другими проектами
    let blockExpandLeft = false;
    if (shouldExpandLeft) {
      const otherProjectsInSameCell = getEventsAt(eventIndex, event.resourceId, event.startWeek)
        .filter(e => 
          e.id !== event.id &&
          e.projectId !== event.projectId &&
          checkVerticalOverlap(eventTop, eventBottom, e.unitStart, e.unitStart + e.unitsTall - 1)
        );
      
      for (const otherEvent of otherProjectsInSameCell) {
        const otherLeftNeighbor = findNeighbors(eventIndex, otherEvent, 'left', { sameProject: true })
          .find(n => checkVerticalOverlap(eventTop, eventBottom, n.unitStart, n.unitStart + n.unitsTall - 1));
        
        if (otherLeftNeighbor) {
          blockExpandLeft = true;
          if (DEBUG) {
            console.log(`🚫 БЛОКИРОВКА LEFT для события ${event.id}: конфликт с проектом ${otherEvent.projectId}`);
          }
          break;
        }
      }
    }
    
    if (shouldExpandLeft && !blockExpandLeft && neighborInfo.expandLeftMultiplier === 0) {
      neighborInfo.expandLeftMultiplier = 1;
    }
  }
  
  // ========================================
  // PASS 3: Поджатие + компенсация
  // ========================================
  // Объединили два прохода для оптимизации!
  for (const event of events) {
    const neighborInfo = neighbors.get(event.id);
    if (!neighborInfo) continue;
    
    const eventTop = event.unitStart;
    const eventBottom = event.unitStart + event.unitsTall - 1;
    
    // Поджатие LEFT (только roundBottomLeft!)
    if (neighborInfo.roundBottomLeft) {
      const eventsWithInnerLeft = getEventsAt(eventIndex, event.resourceId, event.startWeek)
        .filter(e => {
          if (e.id === event.id) return false;
          const eInfo = neighbors.get(e.id);
          return eInfo && (eInfo.innerTopLeftColor || eInfo.innerBottomLeftColor);
        });
      
      const shouldShrink = eventsWithInnerLeft.some(e => event.unitsTall >= e.unitsTall);
      
      if (shouldShrink) {
        neighborInfo.expandLeftMultiplier = 0;
        
        // КОМПЕНСАЦИЯ: левые соседи получают +1 gap
        const leftNeighbors = findNeighbors(eventIndex, event, 'left', { sameProject: true });
        for (const neighbor of leftNeighbors) {
          const nInfo = neighbors.get(neighbor.id);
          if (nInfo) {
            nInfo.expandRightMultiplier += 1;
            if (DEBUG) {
              console.log(`💰 КОМПЕНСАЦИЯ: Левый сосед ${neighbor.id} получает expandRight += 1`);
            }
          }
        }
      }
    }
    
    // Поджатие RIGHT (только roundBottomRight!)
    if (neighborInfo.roundBottomRight) {
      const lastWeek = event.startWeek + event.weeksSpan - 1;
      const eventsWithInnerRight = getEventsAt(eventIndex, event.resourceId, lastWeek)
        .filter(e => {
          if (e.id === event.id) return false;
          const eInfo = neighbors.get(e.id);
          return eInfo && (eInfo.innerTopRightColor || eInfo.innerBottomRightColor);
        });
      
      const shouldShrink = eventsWithInnerRight.some(e => event.unitsTall >= e.unitsTall);
      
      if (shouldShrink) {
        neighborInfo.expandRightMultiplier = 0;
        
        // КОМПЕНСАЦИЯ: правые соседи получают +1 gap
        const rightNeighbors = findNeighbors(eventIndex, event, 'right', { sameProject: true });
        for (const neighbor of rightNeighbors) {
          const nInfo = neighbors.get(neighbor.id);
          if (nInfo) {
            nInfo.expandLeftMultiplier += 1;
            if (DEBUG) {
              console.log(`💰 КОМПЕНСАЦИЯ: Правый сосед ${neighbor.id} получает expandLeft += 1`);
            }
          }
        }
      }
    }
  }
  
  // ========================================
  // PASS 4: Откусывание при вклинивании (ДВОЙНОЙ gap!)
  // ========================================
  for (const event of events) {
    const neighborInfo = neighbors.get(event.id);
    if (!neighborInfo) continue;
    
    const eventTop = event.unitStart;
    const eventBottom = event.unitStart + event.unitsTall - 1;
    
    // Проверяем LEFT: если нет левого соседа своего проекта
    const hasLeftNeighbor = findNeighbors(eventIndex, event, 'left', { sameProject: true }).length > 0;
    
    if (!hasLeftNeighbor) {
      // Ищем события ДРУГОГО проекта слева с expandRight >= 2
      const otherProjectsLeft = findNeighbors(eventIndex, event, 'left', { differentProject: true });
      
      for (const otherEvent of otherProjectsLeft) {
        const otherInfo = neighbors.get(otherEvent.id);
        if (otherInfo && otherInfo.expandRightMultiplier >= 2) {
          neighborInfo.expandLeftMultiplier -= 1;
          if (DEBUG) {
            console.log(`🪓 ОТКУСЫВАНИЕ LEFT: Событие ${event.id} вклинилось в ДВОЙНОЙ gap (expandRight=${otherInfo.expandRightMultiplier})`);
          }
          break;
        }
      }
    }
    
    // Проверяем RIGHT: если нет правого соседа своего проекта
    const hasRightNeighbor = findNeighbors(eventIndex, event, 'right', { sameProject: true }).length > 0;
    
    if (!hasRightNeighbor) {
      // Ищем события ДРУГОГО проекта справа с expandLeft >= 2
      const otherProjectsRight = findNeighbors(eventIndex, event, 'right', { differentProject: true });
      
      for (const otherEvent of otherProjectsRight) {
        const otherInfo = neighbors.get(otherEvent.id);
        if (otherInfo && otherInfo.expandLeftMultiplier >= 2) {
          neighborInfo.expandRightMultiplier -= 1;
          if (DEBUG) {
            console.log(`🪓 ОТКУСЫВАНИЕ RIGHT: Событие ${event.id} вклинилось в ДВОЙНОЙ gap (expandLeft=${otherInfo.expandLeftMultiplier})`);
          }
          break;
        }
      }
    }
  }
  
  if (DEBUG) {
    console.log('✅ calculateEventNeighbors v6.0 завершён! Результатов:', neighbors.size);
  }
  
  return neighbors;
}
