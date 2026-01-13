import React, { useMemo } from 'react';
import type { EventGap, Resource, Department, Grade } from '../../types/scheduler';
import type { LayoutConfig } from '../../utils/schedulerLayout';
import { getResourceGlobalTop, EVENTS_TOP_OFFSET } from '../../utils/schedulerLayout';

interface EventGapHandlesProps {
  gaps: EventGap[];
  config: LayoutConfig;
  resources: Resource[];
  visibleDepartments: Department[];
  isCommandKeyHeld: boolean;
  onGapMouseDown: (gap: EventGap, e: React.PointerEvent) => void;
  grades: Grade[];
}

export const EventGapHandles: React.FC<EventGapHandlesProps> = React.memo(({
  gaps,
  config,
  resources,
  visibleDepartments,
  isCommandKeyHeld,
  onGapMouseDown,
  grades,
}) => {
  // Показываем handles только при зажатой Cmd
  if (!isCommandKeyHeld) return null;
  
  // ✅ FIX: Фильтруем департаменты так же, как в SchedulerGrid (скрываем пустые)
  // Иначе getResourceGlobalTop будет учитывать высоту скрытых заголовков департаментов
  const effectiveDepartments = useMemo(() => {
    const activeDeptIds = new Set<string>();
    resources.forEach(r => {
       activeDeptIds.add(r.departmentId || "NO_DEPT");
    });
    
    return visibleDepartments.filter(d => activeDeptIds.has(d.id));
  }, [resources, visibleDepartments]);

  // Вычисляем позицию ресурса в сетке
  const resourcePositions = useMemo(() => {
    const positions = new Map<string, number>();
    
    resources.forEach(resource => {
      const top = getResourceGlobalTop(resource.id, resources, effectiveDepartments, config, grades);
      positions.set(resource.id, top);
    });
    
    return positions;
  }, [resources, effectiveDepartments, config, grades]);
  
  return (
    <div className="event-gap-handles" style={{ pointerEvents: 'none' }}>
      {gaps && gaps.map(gap => {
        const resourceTop = resourcePositions.get(gap.resourceId);
        if (resourceTop === undefined) return null;
        
        // ✅ Проверяем загружаются ли события (временные ID)
        const isEvent1Pending = gap.event1.id.startsWith('ev_temp_');
        const isEvent2Pending = gap.event2.id.startsWith('ev_temp_');
        const isAnyEventPending = isEvent1Pending || isEvent2Pending;
        
        // Если хотя бы одно событие грузится - блокируем gap handle
        const handleColor = isAnyEventPending 
          ? 'rgba(156, 163, 175, 0.6)' // серый (gray-400)
          : 'rgba(59, 130, 246, 0.6)'; // синий (blue-500)
        
        const cursor = isAnyEventPending ? 'default' : (gap.type === 'vertical' ? 'ns-resize' : 'ew-resize');
        
        if (gap.type === 'vertical') {
          // Вертикальный gap handle (между событиями сверху-снизу)
          // Находим на каких неделях оба события присутствуют (пересечение)
          const event1StartWeek = gap.event1.startWeek;
          const event1EndWeek = gap.event1.startWeek + gap.event1.weeksSpan;
          const event2StartWeek = gap.event2.startWeek;
          const event2EndWeek = gap.event2.startWeek + gap.event2.weeksSpan;
          
          // Находим пересечение недель
          const overlapStartWeek = Math.max(event1StartWeek, event2StartWeek);
          const overlapEndWeek = Math.min(event1EndWeek, event2EndWeek);
          
          // Вычисляем позицию в ЦЕНТРЕ пересечения
          const centerWeek = overlapStartWeek + (overlapEndWeek - overlapStartWeek) / 2;
          const left = config.cellPaddingLeft + (centerWeek * config.weekPx);
          
          // Позиция по вертикали - СМЕЩАЕМ ВНИЗ на 0.5 gap (в центр промежутка)
          // ✅ FIX: Добавляем EVENTS_TOP_OFFSET (88px) чтобы соответствовать рендерингу событий
          const top = resourceTop + config.rowPaddingTop + (gap.unitBoundary! * config.unitStride) - config.gap / 2 + EVENTS_TOP_OFFSET;
          
          // Высота зоны клика = минимум из unitsTall обоих событий (НЕ пересечение недель!)
          // Вертикальный gap - это промежуток по вертикали, размер = меньшая высота событий
          const event1Height = (gap.event1.unitsTall * config.unitContentH) + ((gap.event1.unitsTall - 1) * config.gap);
          const event2Height = (gap.event2.unitsTall * config.unitContentH) + ((gap.event2.unitsTall - 1) * config.gap);
          const clickZoneHeight = Math.min(event1Height, event2Height);
          
          // Размеры: ширина 40px, высота = высота меньшего события
          const clickZoneWidth = 40; // фиксированная ширина зоны клика
          const handleHeight = 4; // видимая пипка (как у top/bottom resize handles)
          const handleWidth = Math.min(Math.max(config.gap, 12), 60); // 1 gap, но minWidth: 12px, maxWidth: 60px
          
          return (
            <div
              key={gap.id}
              className="gap-handle vertical-gap-handle"
              style={{
                position: 'absolute',
                left: `${left - clickZoneWidth / 2}px`,
                top: `${top - clickZoneHeight / 2}px`,
                width: `${clickZoneWidth}px`, // фиксированная ширина 40px
                height: `${clickZoneHeight}px`, // высота меньшего события
                cursor: cursor,
                pointerEvents: 'auto',
                zIndex: 200,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                // DEBUG: показать зону клика
                // background: 'rgba(255, 0, 0, 0.1)',
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                // Блокируем gap resize если хотя бы одно событие грузится
                if (isAnyEventPending) {
                  console.log('⏸️ Gap resize заблокирован - событие грузится:', {
                    event1: { id: gap.event1.id, pending: isEvent1Pending },
                    event2: { id: gap.event2.id, pending: isEvent2Pending },
                  });
                  return;
                }
                onGapMouseDown(gap, e);
              }}
            >
              {/* Видимый handle - маленькая пипка синего цвета */}
              <div
                style={{
                  width: `${handleWidth}px`, // маленькая видимая пипка (4px)
                  height: `${handleHeight}px`, // маленькая видимая пипка (1 gap)
                  background: handleColor,
                  borderRadius: '2px',
                  boxShadow: '0 0 4px rgba(59, 130, 246, 0.4)',
                }}
              />
            </div>
          );
        } else {
          // Горизонтальный gap handle (между событиями слева-справа)
          // Вычисляем позицию в ЦЕНТРЕ пересечения по вертикали
          const event1UnitStart = gap.event1.unitStart;
          const event1UnitEnd = gap.event1.unitStart + gap.event1.unitsTall;
          const event2UnitStart = gap.event2.unitStart;
          const event2UnitEnd = gap.event2.unitStart + gap.event2.unitsTall;
          
          const overlapUnitStart = Math.max(event1UnitStart, event2UnitStart);
          const overlapUnitEnd = Math.min(event1UnitEnd, event2UnitEnd);
          const overlapUnits = overlapUnitEnd - overlapUnitStart;
          const centerUnit = overlapUnitStart + overlapUnits / 2;
          // ✅ FIX: Добавляем EVENTS_TOP_OFFSET (88px) чтобы соответствовать рендерингу событий
          // Также вычитаем gap/2, так как unitStride включает полный gap, а центр события визуально выше
          const top = resourceTop + config.rowPaddingTop + (centerUnit * config.unitStride) - (config.gap / 2) + EVENTS_TOP_OFFSET;
          
          // Позиция по горизонтали - СМЕЩАЕМ ВЛЕВО на 1 gap
          const left = config.cellPaddingLeft + (gap.weekBoundary! * config.weekPx) - config.gap;
          
          // Размеры: просто квадрат 40×40px
          const clickZoneWidth = 40; // фиксированная ширина
          const clickZoneHeight = 40; // фиксированная высота
          const handleWidth = 4; // видимая пипка (как у left/right resize handles)
          const handleHeight = Math.min(Math.max(config.gap, 12), 40); // 1 gap, но minHeight: 12px, maxHeight: 40px
          
          return (
            <div
              key={gap.id}
              className="gap-handle horizontal-gap-handle"
              style={{
                position: 'absolute',
                left: `${left - clickZoneWidth / 2}px`,
                top: `${top - clickZoneHeight / 2}px`,
                width: `${clickZoneWidth}px`, // фиксированная ширина 40px
                height: `${clickZoneHeight}px`, // фиксированная высота 40px
                cursor: cursor,
                pointerEvents: 'auto',
                zIndex: 200,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                // DEBUG: показать зону клика
                // background: 'rgba(255, 0, 0, 0.1)',
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                // Блокируем gap resize если хотя бы одно событие грузится
                if (isAnyEventPending) {
                  console.log('⏸️ Gap resize заблокирован - событие грузится:', {
                    event1: { id: gap.event1.id, pending: isEvent1Pending },
                    event2: { id: gap.event2.id, pending: isEvent2Pending },
                  });
                  return;
                }
                onGapMouseDown(gap, e);
              }}
            >
              {/* Видимый handle - маленькая пипка синего цвета */}
              <div
                style={{
                  width: `${handleWidth}px`, // маленькая видимая пипка (4px)
                  height: `${handleHeight}px`, // маленькая видимая пипка (1 gap)
                  background: handleColor,
                  borderRadius: '2px',
                  boxShadow: '0 0 4px rgba(59, 130, 246, 0.4)',
                }}
              />
            </div>
          );
        }
      })}
    </div>
  );
});

EventGapHandles.displayName = 'EventGapHandles';