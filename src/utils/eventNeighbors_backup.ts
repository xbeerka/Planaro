import { SchedulerEvent, Project } from "../types/scheduler";

// ============================================
// CONFIGURATION
// ============================================
const DEBUG = true; // Set to true for detailed logging

// ============================================
// TYPES
// ============================================

/**
 * Информация о соседях события для склейки
 */
export interface EventNeighborsInfo {
  // Типы соседей слева
  hasFullLeftNeighbor: boolean; // Сосед полностью покрывает высоту (одинаковая высота)
  hasPartialLeftNeighbor: boolean; // Частичное покрытие (1 внутренний угол)
  hasBothLeftNeighbors: boolean; // 2 соседа покрывают сверху и снизу (2 внутренних угла)

  // Типы соседей справа
  hasFullRightNeighbor: boolean; // Сосед полностью покрывает высоту (одинаковая высота)
  hasPartialRightNeighbor: boolean; // Частичное покрытие (1 внутренний угол)
  hasBothRightNeighbors: boolean; // 2 соседа покрывают сверху и снизу (2 внутренних угла)

  // Величина расширения (в единицах gap)
  expandLeftMultiplier: number; // 0, 1, 2, ...
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

  // Скрытие названия проекта для уменьшения визуального шума
  hideProjectName?: boolean;
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
function createEventIndex(
  events: SchedulerEvent[],
): EventIndex {
  const index: EventIndex = new Map();

  for (const event of events) {
    // Получаем или создаём Map для ресурса
    let resourceMap = index.get(event.resourceId);
    if (!resourceMap) {
      resourceMap = new Map();
      index.set(event.resourceId, resourceMap);
    }

    // Добавляем событие на все недели которые оно покрывает
    for (
      let w = event.startWeek;
      w < event.startWeek + event.weeksSpan;
      w++
    ) {
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
  week: number,
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
  event2Bottom: number,
): boolean {
  return event1Top <= event2Bottom && event2Top <= event1Bottom;
}

/**
 * Находит соседей события на указанной стороне
 */
function findNeighbors(
  index: EventIndex,
  event: SchedulerEvent,
  side: "left" | "right",
  filterOptions?: {
    sameProject?: boolean;
    differentProject?: boolean;
    excludeEventId?: string;
  },
): SchedulerEvent[] {
  const eventTop = event.unitStart;
  const eventBottom = event.unitStart + event.unitsTall - 1;

  // Определяем неделю для поиска
  const targetWeek =
    side === "left"
      ? event.startWeek - 1
      : event.startWeek + event.weeksSpan;

  // Получаем все события на этой неделе
  const candidates = getEventsAt(
    index,
    event.resourceId,
    targetWeek,
  );

  // Фильтруем соседей
  return candidates.filter((neighbor) => {
    // Исключаем само событие
    if (
      filterOptions?.excludeEventId &&
      neighbor.id === filterOptions.excludeEventId
    ) {
      return false;
    }

    // Фильтр по проекту
    if (
      filterOptions?.sameProject &&
      neighbor.projectId !== event.projectId
    ) {
      return false;
    }
    if (
      filterOptions?.differentProject &&
      neighbor.projectId === event.projectId
    ) {
      return false;
    }

    // Проверяем что сосед именно на нужной неделе (не просто покрывает её)
    if (side === "left") {
      // Левый сосед должен ЗАКАНЧИВАТЬСЯ на этой неделе
      if (
        neighbor.startWeek + neighbor.weeksSpan - 1 !==
        targetWeek
      ) {
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
    const neighborBottom =
      neighbor.unitStart + neighbor.unitsTall - 1;
    return checkVerticalOverlap(
      eventTop,
      eventBottom,
      neighborTop,
      neighborBottom,
    );
  });
}

/**
 * Анализирует соседей и возвращает информацию о покрытии углов
 */
function analyzeNeighborCoverage(
  neighbors: SchedulerEvent[],
  event: SchedulerEvent,
  projectIndex: ProjectIndex,
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

  const hasPartial =
    (hasTopCovered || hasBottomCovered) && !hasFull;
  const hasBoth =
    hasTopCovered &&
    hasBottomCovered &&
    !hasFull &&
    neighbors.length >= 2;

  return {
    hasFull,
    hasPartial,
    hasBoth,
    hasTopCovered,
    hasBottomCovered,
    innerTopColor,
    innerBottomColor,
    alignedTop,
    alignedBottom,
  };
}

// ============================================
// RULE-BASED LOGIC (PASS 3)
// ============================================

/**
 * Применяет правила стекинга (наложения) событий друг на друга.
 *
 * Правила (обновлено v6.24 - +2 Gap for Rule 2):
 *
 * Правило 1 (B over A):
 * Если B (сверху) имеет Inner Bottom Corner на стороне X,
 * И A (снизу) имеет Outer Top Corner на стороне X:
 * -> Проект Б расширяется (+1 gap) на стороне X.
 * -> Сосед Проекта Б на стороне X сбрасывается в 0.
 * -> Проект А НЕ расширяется (остаётся default).
 *
 * Правило 2 (V over G):
 * Если V (сверху) имеет Outer Bottom Corner на стороне X,
 * И G (снизу) имеет Inner Top Corner на стороне X:
 * -> Проект В сбрасывается (0 gap) на стороне X.
 * -> Сосед Проекта В на стороне X расширяется ДВАЖДЫ (+2 gap = 1 standard + 1 extra).
 *
 * Логика применяется НЕЗАВИСИМО для левой и правой стороны.
 */
function applyStackingRules(
  events: SchedulerEvent[],
  neighbors: Map<string, EventNeighborsInfo>,
  eventIndex: EventIndex,
) {
  // helpers for consistent vertical calculations
  const getTop = (e: SchedulerEvent) => e.unitStart;
  const getBottom = (e: SchedulerEvent) =>
    e.unitStart + e.unitsTall - 1;

  for (const bottomEvent of events) {
    // Ищем ближайшее событие сверху (в той же колонке, другого проекта)
    // v6.42 FIX: Ищем кандидатов во всех неделях, которые покрывает bottomEvent, а не только в startWeek.
    // Это критично для событий, которые пересекаются только в середине или конце (например Bottom W44-45, Top W45-46).
    const candidateSet = new Set<SchedulerEvent>();
    const endWeek = bottomEvent.startWeek + bottomEvent.weeksSpan;
    
    for (let w = bottomEvent.startWeek; w < endWeek; w++) {
       const eventsOnWeek = getEventsAt(eventIndex, bottomEvent.resourceId, w);
       for (const e of eventsOnWeek) {
          if (e.id !== bottomEvent.id && e.projectId !== bottomEvent.projectId) {
             candidateSet.add(e);
          }
       }
    }
    const stackedEvents = Array.from(candidateSet);

    if (stackedEvents.length === 0) continue;

    // Top event: ближайший сверху — выбираем событие с maximal bottom <= top(bottomEvent)
    // v6.41 FIX: Используем нестрогое сравнение (<=), чтобы ловить события, которые касаются или имеют нахлест в 1 юнит
    const topEvent = stackedEvents
      .filter((e) => getBottom(e) <= getTop(bottomEvent)) // Relaxed from < to <=
      .sort((a, b) => getBottom(b) - getBottom(a))[0]; // closest = largest bottom

    if (!topEvent) continue;

    const bInfo = neighbors.get(bottomEvent.id);
    const tInfo = neighbors.get(topEvent.id);
    if (!bInfo || !tInfo) continue;

    // ========================
    // LEFT SIDE CHECK
    // ========================
    const tLeft = findNeighbors(eventIndex, topEvent, "left", {
      sameProject: true,
    });
    const bLeft = findNeighbors(
      eventIndex,
      bottomEvent,
      "left",
      { sameProject: true },
    );

    if (tLeft.length > 0 && bLeft.length > 0) {
      // Геометрия Left:
      // topHasInnerBottomL: левый сосед сверху имеет bottom > bottom(topEvent)
      const topHasInnerBottomL = tLeft.some(
        (n) => getBottom(n) > getBottom(topEvent),
      );
      // botHasOuterTopL: левый сосед снизу имеет top >= top(bottomEvent) (начинается ниже ИЛИ на том же уровне)
      // v6.41 FIX: Changed > to >=. Aligned neighbors are "Outer" (Walls).
      const botHasOuterTopL = bLeft.some(
        (n) => getTop(n) >= getTop(bottomEvent),
      );
      // topHasOuterBottomL: левый сосед сверху имеет bottom <= bottom(topEvent)
      const topHasOuterBottomL = tLeft.some(
        (n) => getBottom(n) <= getBottom(topEvent),
      );
      // botHasInnerTopL: левый сосед снизу имеет top < top(bottomEvent)
      const botHasInnerTopL = bLeft.some(
        (n) => getTop(n) < getTop(bottomEvent),
      );

      // RULE 1 LEFT (B over A)
      if (topHasInnerBottomL && botHasOuterTopL) {
        tInfo.expandLeftMultiplier = Math.max(
          tInfo.expandLeftMultiplier,
          1,
        );
        tLeft.forEach((n) => {
          const ni = neighbors.get(n.id);
          if (ni) ni.expandRightMultiplier = 0;
        });

        if (DEBUG)
          console.log(
            `📐 RULE 1 (Left): B ${topEvent.id} over A ${bottomEvent.id}`,
          );
      }

      // RULE 2 LEFT (V over G)
      if (topHasOuterBottomL && botHasInnerTopL) {
        tInfo.expandLeftMultiplier = 0;
        // Expand Top's Left Neighbor -> +1 EXTRA (Total +2 usually)
        tLeft.forEach((n) => {
          const ni = neighbors.get(n.id);
          if (ni) ni.expandRightMultiplier += 1;
        });

        if (DEBUG)
          console.log(
            `📐 RULE 2 (Left): V ${topEvent.id} over G ${bottomEvent.id} -> Neighbor +2`,
          );
      }
    }

    // ========================
    // RIGHT SIDE CHECK
    // ========================
    const tRight = findNeighbors(
      eventIndex,
      topEvent,
      "right",
      { sameProject: true },
    );
    const bRight = findNeighbors(
      eventIndex,
      bottomEvent,
      "right",
      { sameProject: true },
    );

    if (tRight.length > 0 && bRight.length > 0) {
      // Геометрия Right:
      const topHasInnerBottomR = tRight.some(
        (n) => getBottom(n) > getBottom(topEvent),
      );
      // v6.41 FIX: Changed > to >=. Aligned neighbors are "Outer".
      const botHasOuterTopR = bRight.some(
        (n) => getTop(n) >= getTop(bottomEvent),
      );
      const topHasOuterBottomR = tRight.some(
        (n) => getBottom(n) <= getBottom(topEvent),
      );
      const botHasInnerTopR = bRight.some(
        (n) => getTop(n) < getTop(bottomEvent),
      );

      // RULE 1 RIGHT (B over A)
      if (topHasInnerBottomR && botHasOuterTopR) {
        tInfo.expandRightMultiplier = Math.max(
          tInfo.expandRightMultiplier,
          1,
        );
        tRight.forEach((n) => {
          const ni = neighbors.get(n.id);
          if (ni) ni.expandLeftMultiplier = 0;
        });

        if (DEBUG)
          console.log(
            `📐 RULE 1 (Right): B ${topEvent.id} over A ${bottomEvent.id}`,
          );
      }

      // RULE 2 RIGHT (V over G)
      if (topHasOuterBottomR && botHasInnerTopR) {
        tInfo.expandRightMultiplier = 0;
        // Expand Top's Right Neighbor -> +1 EXTRA
        tRight.forEach((n) => {
          const ni = neighbors.get(n.id);
          if (ni) ni.expandLeftMultiplier += 1;
        });

        if (DEBUG)
          console.log(
            `📐 RULE 2 (Right): V ${topEvent.id} over G ${bottomEvent.id} -> Neighbor +2`,
          );
      }
    }
  }
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
 * 7. Откусывание при вклинивании между событиями с ДВОЙНОЙ gap
 */
export function calculateEventNeighbors(
  events: SchedulerEvent[],
  projects: Project[],
): Map<string, EventNeighborsInfo> {
  if (DEBUG) {
    console.log(
      "🔄 calculateEventNeighbors v6.0 OPTIMIZED! События:",
      events.length,
      "Проекты:",
      projects.length,
    );
  }

  const neighbors = new Map<string, EventNeighborsInfo>();

  // ========================================
  // STEP 0: Создаём индексы для быстрого поиска
  // ========================================
  const eventIndex = createEventIndex(events);
  const projectIndex = createProjectIndex(projects);

  if (DEBUG) {
    console.log("📇 Индексы созданы:", {
      resources: eventIndex.size,
      projects: projectIndex.size,
    });
  }

  // ========================================
  // PASS 1: Базовое расширение + вычисление углов
  // ========================================
  // Объединили два прохода в один для оптимизации!
  for (const event of events) {
    // Находим соседей
    const leftNeighbors = findNeighbors(
      eventIndex,
      event,
      "left",
      { sameProject: true },
    );
    const rightNeighbors = findNeighbors(
      eventIndex,
      event,
      "right",
      { sameProject: true },
    );

    // Анализируем покрытие
    const leftCoverage = analyzeNeighborCoverage(
      leftNeighbors,
      event,
      projectIndex,
    );
    const rightCoverage = analyzeNeighborCoverage(
      rightNeighbors,
      event,
      projectIndex,
    );

    // Базовое расширение: события с внутренними углами расширяются на 1 gap
    // При полной склейке расширения НЕТ
    // v6.1 FIX: Добавляем геометрическую проверку (hasTopCovered && hasBottomCovered)
    // Это защищает от случаев, когда innerColor не определён (например, ошибка projectIndex)
    const geometricInnerLeft =
      leftCoverage.hasTopCovered &&
      leftCoverage.hasBottomCovered;
    const geometricInnerRight =
      rightCoverage.hasTopCovered &&
      rightCoverage.hasBottomCovered;

    const hasInnerLeft =
      !!leftCoverage.innerTopColor ||
      !!leftCoverage.innerBottomColor ||
      geometricInnerLeft;
    const hasInnerRight =
      !!rightCoverage.innerTopColor ||
      !!rightCoverage.innerBottomColor ||
      geometricInnerRight;

    const expandLeft =
      hasInnerLeft && !leftCoverage.hasFull ? 1 : 0;
    const expandRight =
      hasInnerRight && !rightCoverage.hasFull ? 1 : 0;

    // Вычисляем какие углы скруглены
    // Угол НЕ скруглён если: полная склейка ИЛИ внутренний угол ИЛИ границы выровнены
    const roundTopLeft = !(
      leftCoverage.hasFull ||
      !!leftCoverage.innerTopColor ||
      leftCoverage.alignedTop
    );
    const roundBottomLeft = !(
      leftCoverage.hasFull ||
      !!leftCoverage.innerBottomColor ||
      leftCoverage.alignedBottom
    );
    const roundTopRight = !(
      rightCoverage.hasFull ||
      !!rightCoverage.innerTopColor ||
      rightCoverage.alignedTop
    );
    const roundBottomRight = !(
      rightCoverage.hasFull ||
      !!rightCoverage.innerBottomColor ||
      rightCoverage.alignedBottom
    );

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
  // PASS 2: Расширение навстречу (Expand Towards)
  // ========================================
  // v6.18 FIX: Убрали блокировку конфликтов.

  for (const event of events) {
    const neighborInfo = neighbors.get(event.id);
    if (!neighborInfo) continue;

    const eventTop = event.unitStart;
    const eventBottom = event.unitStart + event.unitsTall - 1;

    // Проверяем правых соседей
    const rightNeighbors = findNeighbors(
      eventIndex,
      event,
      "right",
      { sameProject: true },
    );
    const shouldExpandRight = rightNeighbors.some(
      (neighbor) => {
        const nInfo = neighbors.get(neighbor.id);
        return (
          nInfo &&
          (nInfo.innerTopLeftColor ||
            nInfo.innerBottomLeftColor)
        );
      },
    );

    if (
      shouldExpandRight &&
      neighborInfo.expandRightMultiplier === 0
    ) {
      neighborInfo.expandRightMultiplier = 1;
    }

    // Проверяем левых соседей
    const leftNeighbors = findNeighbors(
      eventIndex,
      event,
      "left",
      { sameProject: true },
    );
    const shouldExpandLeft = leftNeighbors.some((neighbor) => {
      const nInfo = neighbors.get(neighbor.id);
      return (
        nInfo &&
        (nInfo.innerTopRightColor ||
          nInfo.innerBottomRightColor)
      );
    });

    if (
      shouldExpandLeft &&
      neighborInfo.expandLeftMultiplier === 0
    ) {
      neighborInfo.expandLeftMultiplier = 1;
    }
  }

  // ========================================
  // PASS 3: Обработка краевых сценариев (Edge Case Logic)
  // ========================================
  // Логика основана на геометрии событий и их вертикальном расположении.
  // Правила вынесены в отдельную функцию applyStackingRules для чистоты кода.
  applyStackingRules(events, neighbors, eventIndex);

  // ========================================
  // PASS 4: Откусывание при вклинивании (ДВОЙНОЙ gap!)
  // ========================================
  for (const event of events) {
    const neighborInfo = neighbors.get(event.id);
    if (!neighborInfo) continue;

    const eventTop = event.unitStart;
    const eventBottom = event.unitStart + event.unitsTall - 1;

    // Проверяем LEFT: если нет левого соседа своего проекта
    const hasLeftNeighbor =
      findNeighbors(eventIndex, event, "left", {
        sameProject: true,
      }).length > 0;

    if (!hasLeftNeighbor) {
      // Ищем события ДРУГОГО проекта слева с expandRight >= 2
      const otherProjectsLeft = findNeighbors(
        eventIndex,
        event,
        "left",
        { differentProject: true },
      );

      for (const otherEvent of otherProjectsLeft) {
        const otherInfo = neighbors.get(otherEvent.id);
        if (otherInfo && otherInfo.expandRightMultiplier >= 2) {
          neighborInfo.expandLeftMultiplier -= 1;
          if (DEBUG) {
            console.log(
              `🪓 ОТКУСЫВАНИЕ LEFT: Событие ${event.id} вклинилось в ДВОЙНОЙ gap (expandRight=${otherInfo.expandRightMultiplier})`,
            );
          }
          break;
        }
      }
    }

    // Проверяем RIGHT: если нет правого соседа своего проекта
    const hasRightNeighbor =
      findNeighbors(eventIndex, event, "right", {
        sameProject: true,
      }).length > 0;

    if (!hasRightNeighbor) {
      // Ищем события ДРУГОГО проекта справа с expandLeft >= 2
      const otherProjectsRight = findNeighbors(
        eventIndex,
        event,
        "right",
        { differentProject: true },
      );

      for (const otherEvent of otherProjectsRight) {
        const otherInfo = neighbors.get(otherEvent.id);
        if (otherInfo && otherInfo.expandLeftMultiplier >= 2) {
          neighborInfo.expandRightMultiplier -= 1;
          if (DEBUG) {
            console.log(
              `🪓 ОТКУСЫВАНИЕ RIGHT: Событие ${event.id} вклинилось в ДВОЙНОЙ gap (expandLeft=${otherInfo.expandLeftMultiplier})`,
            );
          }
          break;
        }
      }
    }
  }

  // ========================================
  // PASS 5: Скрытие названий проектов для уменьшения визуального шума
  // ========================================
  // ВАЖНО: Сортируем события по времени, чтобы цепочка скрытия (A->B->C) обрабатывалась слева направо.
  // Иначе, если B обработается раньше A, он не узнает, что A скрыт, и тоже скроется (некорректно).
  // Это критично при Undo/Redo, когда порядок событий в массиве может меняться (из-за Z-order).
  const timeSortedEvents = [...events].sort((a, b) => {
    if (a.resourceId !== b.resourceId)
      return a.resourceId.localeCompare(b.resourceId);
    return a.startWeek - b.startWeek;
  });

  // Умное чередование: короткое событие скрывает название ТОЛЬКО ЕСЛИ левый сосед САМ показывает название
  // Это создаст автоматическое чередование: показано → скрыто → показано → скрыто...
  for (const event of timeSortedEvents) {
    const neighborInfo = neighbors.get(event.id);
    if (!neighborInfo) continue;

    // Событие короткое (≤ 2 недель)?
    const isShort = event.weeksSpan <= 2;

    if (isShort) {
      // Ищем левого соседа того же проекта
      const leftNeighbors = findNeighbors(
        eventIndex,
        event,
        "left",
        { sameProject: true },
      );

      if (leftNeighbors.length > 0) {
        // Берем первого левого соседа (ближайший)
        const leftNeighbor = leftNeighbors[0];
        const leftNeighborInfo = neighbors.get(leftNeighbor.id);

        // Скрываем название ТОЛЬКО ЕСЛИ левый сосед САМ показывает название (не скрыт)
        // Благодаря сортировке timeSortedEvents, leftNeighborInfo уже обработан и имеет корректный hideProjectName
        if (
          leftNeighborInfo &&
          !leftNeighborInfo.hideProjectName
        ) {
          neighborInfo.hideProjectName = true;

          if (DEBUG) {
            console.log(
              `🙈 СКРЫТИЕ: Событие ${event.id} (${event.weeksSpan} нед.) скрывает название (левый ${leftNeighbor.id} показывает)`,
            );
          }
        } else {
          // Левый сосед скрыт → показываем это событие (чередование)
          neighborInfo.hideProjectName = false;
        }
      } else {
        // Нет левого соседа → показываем (первое в цепочке)
        neighborInfo.hideProjectName = false;
      }
    } else {
      // Длинные события всегда показывают название
      neighborInfo.hideProjectName = false;
    }
  }

  if (DEBUG) {
    console.log(
      "✅ calculateEventNeighbors v6.0 завершён! Результатов:",
      neighbors.size,
    );
  }

  return neighbors;
}
