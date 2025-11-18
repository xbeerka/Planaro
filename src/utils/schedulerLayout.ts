import { Department, Resource, SchedulerEvent } from '../types/scheduler';
import { UNITS, WEEKS, sortResourcesByGrade } from './scheduler';

export interface LayoutConfig {
  weekPx: number;
  resourceW: number;
  rowH: number;
  eventRowH: number;
  gap: number;
  cellPaddingLeft: number;
  cellPaddingRight: number;
  rowPaddingTop: number;
  rowPaddingBottom: number;
  unitContentH: number;
  unitStride: number;
}

// Calculate gap based on size (for both row height and cell width)
export function getGapForSize(size: number): number {
  if (size <= 48) return 1; // Было 0.5, но это создавало дробные пиксели
  if (size <= 80) return 1;
  if (size <= 112) return 2;
  return 4;
}

// Calculate row padding based on row height
export function getRowPaddingForSize(size: number): number {
  if (size <= 48) return 2;
  if (size <= 80) return 4;
  if (size <= 112) return 6;
  return 8;
}

// Calculate cell padding based on cell width
export function getCellPaddingForSize(size: number): number {
  if (size <= 48) return 1;
  if (size <= 80) return 2;
  if (size <= 112) return 3;
  return 4;
}

// Calculate font size based on row height
export function getFontSizeForRowHeight(eventRowH: number): number {
  if (eventRowH <= 48) return 8;
  if (eventRowH <= 112) return 10;
  return 12;
}

// Calculate border radius based on row height
export function getBorderRadiusForRowHeight(eventRowH: number): number {
  if (eventRowH <= 48) return 4;
  if (eventRowH <= 80) return 6;
  if (eventRowH <= 112) return 8;
  return 10;
}

// Create layout config from dimensions
export function createLayoutConfig(
  weekPx: number, 
  eventRowH: number,
  displayMode?: 'with-patterns' | 'performance'
): LayoutConfig {
  // В режиме производительности используем фиксированные отступы
  const isPerformanceMode = displayMode === 'performance';
  
  const gap = isPerformanceMode ? 0 : getGapForSize(eventRowH);
  const rowPaddingTop = isPerformanceMode ? 2 : getRowPaddingForSize(eventRowH);
  const rowPaddingBottom = isPerformanceMode ? 0 : getRowPaddingForSize(eventRowH);
  // Унифицированные отступы: cellPadding = gap (вместо gap/2)
  // Теперь одиночные события имеют одинаковые отступы со всех сторон
  const cellPadding = isPerformanceMode ? 0 : gap;
  
  // Округляем все вычисления до целых пикселей для pixel-perfect позиционирования
  const unitContentH = Math.floor((eventRowH - (UNITS - 1) * gap - rowPaddingTop - rowPaddingBottom) / UNITS);
  const unitStride = unitContentH + gap;

  return {
    weekPx,
    resourceW: 284,
    rowH: 36,
    eventRowH,
    gap,
    cellPaddingLeft: cellPadding,
    cellPaddingRight: cellPadding,
    rowPaddingTop,
    rowPaddingBottom,
    unitContentH,
    unitStride
  };
}

export function getResourceGlobalTop(
  resourceId: string,
  resources: Resource[],
  departments: Department[],
  config: LayoutConfig
): number {
  let totalHeight = 2 * config.rowH;
  for (const dept of departments) {
    totalHeight += config.rowH;
    const deptResources = sortResourcesByGrade(resources.filter(r => r.departmentId === dept.id));
    for (const resource of deptResources) {
      if (resource.id === resourceId) return totalHeight;
      totalHeight += config.eventRowH;
    }
  }
  return totalHeight;
}

export function topFor(
  resourceId: string,
  unitStart: number,
  resources: Resource[],
  departments: Department[],
  config: LayoutConfig
): number {
  return getResourceGlobalTop(resourceId, resources, departments, config) +
    unitStart * config.unitStride +
    config.rowPaddingTop;
}

export function heightFor(unitsTall: number, config: LayoutConfig): number {
  return unitsTall * config.unitContentH + (unitsTall - 1) * config.gap;
}

export function findClosestResource(
  topAbs: number,
  resources: Resource[],
  departments: Department[],
  config: LayoutConfig
): Resource | null {
  let cur = 2 * config.rowH;

  // First pass: check if topAbs is inside any resource row bounds
  for (const dept of departments) {
    cur += config.rowH;
    const deptR = sortResourcesByGrade(resources.filter(r => r.departmentId === dept.id));
    for (const r of deptR) {
      const rowTop = cur;
      const rowBottom = cur + config.eventRowH;
      
      // If cursor is inside this resource row, return it immediately
      if (topAbs >= rowTop && topAbs < rowBottom) {
        return r;
      }
      
      cur += config.eventRowH;
    }
  }
  
  // If cursor is not inside any resource row (e.g., on department header), return null
  return null;
}

export function getAvailableFreeSpace(
  resourceId: string,
  week: number,
  clickedUnit: number,
  events: SchedulerEvent[],
  excludeEventId: string | null = null
): number {
  if (clickedUnit < 0 || clickedUnit >= UNITS) return 0;

  const cellEvents = events.filter(ev =>
    ev.resourceId === resourceId &&
    week >= ev.startWeek &&
    week < ev.startWeek + ev.weeksSpan &&
    ev.id !== excludeEventId
  );

  const occ = new Set<number>();
  cellEvents.forEach(ev => {
    for (let i = ev.unitStart; i < ev.unitStart + ev.unitsTall; i++) {
      occ.add(i);
    }
  });

  let max = 0;
  for (let i = clickedUnit; i < UNITS; i++) {
    if (occ.has(i)) break;
    max++;
  }
  return max;
}

export function modelFromGeometry(
  leftAbs: number,
  topAbs: number,
  width: number,
  height: number,
  evData: SchedulerEvent | null,
  resources: Resource[],
  departments: Department[],
  config: LayoutConfig
): {
  startWeek: number;
  resourceId: string;
  unitStart: number;
  unitsTall: number;
} | null {
  const leftRel = leftAbs - config.resourceW - config.cellPaddingLeft;
  const startWeek = Math.max(0, Math.min(WEEKS - 1, Math.round(leftRel / config.weekPx)));

  // findClosestResource now returns null if cursor is not inside any resource row
  const closest = findClosestResource(topAbs, resources, departments, config);
  if (!closest) return null;

  const resourceTop = getResourceGlobalTop(closest.id, resources, departments, config);
  const withinRow = topAbs - resourceTop - config.rowPaddingTop;
  // Use Math.floor instead of Math.round so event only moves to new unit when cursor is fully inside it
  let unitStart = Math.max(0, Math.min(UNITS - 1, Math.floor(withinRow / config.unitStride)));
  const unitsTall = evData
    ? evData.unitsTall
    : Math.max(1, Math.min(UNITS, Math.round(height / config.unitStride)));

  // Ensure event doesn't overflow the resource row
  // If unitStart + unitsTall > UNITS, shift unitStart down so event fits
  if (unitStart + unitsTall > UNITS) {
    unitStart = Math.max(0, UNITS - unitsTall);
  }

  return { startWeek, resourceId: closest.id, unitStart, unitsTall };
}

export function isValidPosition(
  model: { startWeek: number; resourceId: string; unitStart: number; unitsTall: number },
  evData: SchedulerEvent,
  events: SchedulerEvent[],
  excludeEventId: string | null = null,
  config?: LayoutConfig
): boolean {
  if (!model || !model.resourceId) return false;
  if (model.unitStart + evData.unitsTall > UNITS) return false;
  
  // Always allow overlap (ALLOW_OVERLAP = true)
  return true;
}