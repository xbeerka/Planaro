import { useRef, useEffect, useState, memo, useMemo } from 'react';
import { SchedulerEvent as Event, Project, EventPattern } from '../../types/scheduler';
import { LayoutConfig, getFontSizeForRowHeight, getBorderRadiusForRowHeight } from '../../utils/schedulerLayout';

interface SchedulerEventProps {
  event: Event;
  config: LayoutConfig;
  projects: Project[];
  eventPatterns: EventPattern[];
  scissorsMode: boolean;
  commentMode: boolean;
  isCtrlPressed: boolean;
  isPending?: boolean;
  isBlocked?: boolean; // ✅ Заблокировано для взаимодействия (временные ID)
  dimmed?: boolean;
  showGaps?: boolean;
  showPatterns?: boolean;
  showProjectWeight?: boolean;
  isContextMenuOpen?: boolean;
  currentWeekIndex?: number; // ✅ Индекс текущей недели для визуального эффекта прошедших частей
  // УПРОЩЁННАЯ ЛОГИКА v3.1: Позитивные флаги - какие углы скруглены
  roundTopLeft?: boolean;
  roundTopRight?: boolean;
  roundBottomLeft?: boolean;
  roundBottomRight?: boolean;
  // Цвета соседей для внутренних скруглений ::before/::after
  innerTopLeftColor?: string;
  innerBottomLeftColor?: string;
  innerTopRightColor?: string;
  innerBottomRightColor?: string;
  // Скрытие названия проекта для уменьшения визуального шума
  hideProjectName?: boolean;
  onContextMenu: (e: React.MouseEvent, event: Event) => void;
  onPointerDown: (e: React.PointerEvent, event: Event) => void;
  onHandlePointerDown: (e: React.PointerEvent, event: Event, edge: string) => void;
  onClick: (e: React.MouseEvent, event: Event) => void;
  onScissorClick: (eventId: string, boundaryWeek: number) => void;
  left: number;
  top: number;
  width: number;
  height: number;
  eventRowH: number;
}

function SchedulerEventComponent({
  event,
  config,
  projects,
  eventPatterns,
  scissorsMode,
  commentMode,
  isCtrlPressed,
  isPending = false,
  isBlocked = false, // ✅ Заблокировано для взаимодействия
  dimmed = false,
  showGaps = true,
  showPatterns = true,
  showProjectWeight = true,
  isContextMenuOpen = false,
  currentWeekIndex = 0, // ✅ Индекс текущей недели для визуального эффекта прошедших частей
  roundTopLeft = true,
  roundTopRight = true,
  roundBottomLeft = true,
  roundBottomRight = true,
  innerTopLeftColor = 'transparent',
  innerBottomLeftColor = 'transparent',
  innerTopRightColor = 'transparent',
  innerBottomRightColor = 'transparent',
  hideProjectName = false,
  onContextMenu,
  onPointerDown,
  onHandlePointerDown,
  onClick,
  onScissorClick,
  left,
  top,
  width,
  height,
  eventRowH
}: SchedulerEventProps) {
  const eventRef = useRef<HTMLDivElement>(null);
  
  // Логируем каждый рендер для диагностики
  useEffect(() => {
    // console.log(`🎨 Event ${event.id}: рендер с showGaps=${showGaps}, showPatterns=${showPatterns}`);
  }, [event.id, showGaps, showPatterns]);

  const [hoveredScissor, setHoveredScissor] = useState<number | null>(null);
  
  // Кэшируем проект и стили для избежания повторных вычислений
  const project = useMemo(() => 
    projects.find(p => p.id === event.projectId) || { name: 'Без проекта' },
    [projects, event.projectId]
  );
  
  const fontSize = useMemo(() => getFontSizeForRowHeight(eventRowH), [eventRowH]);
  const baseBorderRadius = useMemo(() => getBorderRadiusForRowHeight(eventRowH), [eventRowH]);
  
  // Adaptive vertical padding based on event height, fixed horizontal padding
  const getPadding = useMemo(() => {
    if (height <= 12) return '1px 12px';
    if (height <= 20) return '2px 12px';
    if (height <= 40) return '4px 12px';
    return '8px 12px';
  }, [height]);

  // Generate scissor boundaries for multi-week events
  const scissorBoundaries = useMemo<number[]>(() => {
    if (!scissorsMode || event.weeksSpan <= 1) return [];
    
    const boundaries: number[] = [];
    for (let b = event.startWeek + 1; b < event.startWeek + event.weeksSpan; b++) {
      boundaries.push(b);
    }
    return boundaries;
  }, [scissorsMode, event.weeksSpan, event.startWeek]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, event);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('.handle-container')) return;
    // Блокируем перетаскивание в режиме ножниц и комментирования
    if (!scissorsMode && !commentMode) {
      onPointerDown(e, event);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    // В режиме ножниц и комментирования не обрабатываем клики
    if (scissorsMode || commentMode) return;
    
    // Обычный клик для открытия модального окна
    onClick(e, event);
  };

  // Get project style - кэшируем стили
  const eventStyle = useMemo(() => {
    const baseStyle: React.CSSProperties = {
      left: `${left}px`,
      top: `${top}px`,
      width: `${Math.max(24, width)}px`,
      height: `${height}px`,
      padding: getPadding,
      transform: 'translateZ(0)',
      willChange: 'transform, opacity',
      backfaceVisibility: 'hidden',
      opacity: 1
    };
    
    // Упрощённая логика v3.1: borderRadius на основе round* флагов
    // CSS border-radius: topLeft topRight bottomRight bottomLeft
    // roundTopLeft/Right/BottomLeft/Right = true означает что угол скруглён
    if (!showGaps) {
      baseStyle.borderRadius = '0px';
    } else {
      const tl = roundTopLeft ? baseBorderRadius : 0;
      const tr = roundTopRight ? baseBorderRadius : 0;
      const br = roundBottomRight ? baseBorderRadius : 0;
      const bl = roundBottomLeft ? baseBorderRadius : 0;
      baseStyle.borderRadius = `${tl}px ${tr}px ${br}px ${bl}px`;
    }
    
    // Добавляем CSS переменные для внутренних скруглений
    // Внутренний радиус = внешний радиус + gap (математически правильно)
    // В режиме производительности - внутренние скругления отключены
    const innerRadius = !showGaps ? 0 : baseBorderRadius + config.gap;
    (baseStyle as any)['--inner-radius-size'] = `${innerRadius}px`;
    (baseStyle as any)['--inner-tl-color'] = !showGaps ? 'transparent' : innerTopLeftColor;
    (baseStyle as any)['--inner-tr-color'] = !showGaps ? 'transparent' : innerTopRightColor;
    (baseStyle as any)['--inner-bl-color'] = !showGaps ? 'transparent' : innerBottomLeftColor;
    (baseStyle as any)['--inner-br-color'] = !showGaps ? 'transparent' : innerBottomRightColor;

    // Use backgroundColor from project if available
    if ('backgroundColor' in project && project.backgroundColor) {
      baseStyle.backgroundColor = project.backgroundColor;
      
      // Use pattern from project's patternId (project inherits pattern from event_patterns table)
      // Паттерны применяются только если showPatterns === true
      const projectPattern = showPatterns && 'patternId' in project && project.patternId 
        ? eventPatterns.find(p => p.id === project.patternId)
        : null;
      
      if (projectPattern && projectPattern.pattern) {
        // Parse pattern - it can contain multiple CSS properties separated by semicolons
        // Format: "gradient(...), gradient(...); background-size: 20px 20px; background-position: 0 0, 10px 10px"
        const pattern = projectPattern.pattern
          .replace(/\n/g, ' ')         // Replace newlines with spaces
          .replace(/\s+/g, ' ')        // Replace multiple spaces with single space
          .trim();
        
        if (pattern) {
          // Split by semicolons to get individual CSS declarations
          const parts = pattern.split(';').map(p => p.trim()).filter(p => p);
          
          if (parts.length > 0) {
            // First part is always background-image (gradient definitions)
            const firstPart = parts[0];
            
            // Check if it contains a CSS property name (like "background-size:")
            if (!firstPart.includes(':') || firstPart.startsWith('linear-gradient') || firstPart.startsWith('radial-gradient') || firstPart.startsWith('repeating-')) {
              // It's a gradient definition, set as backgroundImage
              baseStyle.backgroundImage = firstPart;
              
              // Process remaining parts as CSS properties
              for (let i = 1; i < parts.length; i++) {
                const part = parts[i];
                const colonIndex = part.indexOf(':');
                if (colonIndex > 0) {
                  const propName = part.substring(0, colonIndex).trim();
                  const propValue = part.substring(colonIndex + 1).trim();
                  
                  // Convert CSS property name to camelCase for React
                  const camelProp = propName.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
                  (baseStyle as any)[camelProp] = propValue;
                }
              }
              
              // Auto-detect multiple gradients and add default background-size if not specified
              const gradientCount = (firstPart.match(/gradient\(/g) || []).length;
              if (gradientCount >= 2 && !baseStyle.backgroundSize) {
                // Multiple gradients detected - likely a pattern
                // Add default background-size for dot patterns
                baseStyle.backgroundSize = '20px 20px';
                
                // Add default background-position for offset dot pattern
                if (!baseStyle.backgroundPosition) {
                  baseStyle.backgroundPosition = '0 0, 10px 10px';
                }
              }
            }
          }
        }
      }
    }

    // Use textColor from project if available
    if ('textColor' in project && project.textColor) {
      baseStyle.color = project.textColor;
    }

    // Dimmed events override background to gray, set dark text, and reduce opacity
    // But preserve backgroundImage pattern if present
    if (dimmed) {
      baseStyle.backgroundColor = '#AAA';
      baseStyle.color = '#333';
      baseStyle.opacity = 0.2;
    }

    // Context menu open - apply hover-like opacity
    if (isContextMenuOpen) {
      baseStyle.opacity = 0.9;
    }

    return baseStyle;
  }, [left, top, width, height, getPadding, baseBorderRadius, roundTopLeft, roundTopRight, roundBottomLeft, roundBottomRight, config.gap, project, eventPatterns, dimmed, showGaps, showPatterns, innerTopLeftColor, innerBottomLeftColor, innerTopRightColor, innerBottomRightColor, isContextMenuOpen]);

  // Вычисляем hasInner* из цветов (для CSS классов ::before/::after)
  const hasInnerTopLeft = innerTopLeftColor !== 'transparent';
  const hasInnerBottomLeft = innerBottomLeftColor !== 'transparent';
  const hasInnerTopRight = innerTopRightColor !== 'transparent';
  const hasInnerBottomRight = innerBottomRightColor !== 'transparent';

  return (
    <div
      ref={eventRef}
      className={`scheduler-event absolute flex gap-2 select-none min-w-[40px] ${
        event.unitsTall > 1 ? 'items-start' : ''
      } ${isCtrlPressed ? 'ctrl-move-mode' : ''} ${isPending || isBlocked ? 'pending' : ''} ${!('backgroundColor' in project && project.backgroundColor) ? `proj-${event.projectId}` : ''} ${
        showGaps && hasInnerTopLeft ? 'inner-tl' : ''
      } ${
        showGaps && hasInnerBottomLeft ? 'inner-bl' : ''
      } ${
        showGaps && hasInnerTopRight ? 'inner-tr' : ''
      } ${
        showGaps && hasInnerBottomRight ? 'inner-br' : ''
      }`}
      style={eventStyle}
      data-event-id={event.id}
      onContextMenu={handleContextMenu}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
    >
      {/* Wrapper для нижних внутренних скруглений - абсолютно позиционированный на дне события */}
      {/* В режиме производительности внутренние скругления отключены */}
      {showGaps && (hasInnerBottomLeft || hasInnerBottomRight) && (
        <div 
          className={`inner-bottom-wrapper ${hasInnerBottomLeft ? 'inner-bl' : ''} ${hasInnerBottomRight ? 'inner-br' : ''}`}
        />
      )}
      
      <div className="event__content flex w-full justify-between items-center relative gap-3 pointer-events-none">
        <div className="flex items-center" style={{ gap: '4px', minWidth: 0, flex: 1 }}>
          {!hideProjectName && (
            <div
              className="ev-name pointer-events-auto"
              style={{
                fontWeight: 700,
                fontSize: `${fontSize}px`,
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                margin: 0,
                display: 'inline-block',
                pointerEvents: 'none',
                position: 'sticky',
                left: 'var(--sticky-name-left)',
                zIndex: 2,
                background: 'inherit',
                paddingRight: '4px',
                transition: 'none'
              }}
            >
              {project.name}
            </div>
          )}
          {/* Показываем спиннер для pending (сохранение) и blocked (временные ID) событий */}
          {(isPending || isBlocked) && (
            <div 
              className="animate-spin rounded-full border-2"
              style={{ 
                width: '10px', 
                height: '10px',
                flexShrink: 0,
                borderColor: `${('textColor' in project && project.textColor) ? project.textColor : '#fff'}33`,
                borderTopColor: ('textColor' in project && project.textColor) ? project.textColor : '#fff'
              }}
            />
          )}
        </div>
        {showProjectWeight && (
          <div className="ev-weight pointer-events-auto text-right" style={{ fontSize: `${fontSize}px`, opacity: 0.6, position: 'relative', zIndex: 2, transition: 'none' }}>
            {event.unitsTall * 25}%
          </div>
        )}
      </div>

      {/* Scissor guides - absolutely positioned to not affect flex layout */}
      {scissorsMode && scissorBoundaries.length > 0 && (
        <div className="absolute inset-0 pointer-events-none">
          {scissorBoundaries.map(boundaryWeek => {
            // Позиция границы недели относительно grid (без resourceW, т.к. left уже учитывает это)
            const baseX = boundaryWeek * config.weekPx;
            const lineLeft = baseX - left;
            const isHovered = hoveredScissor === boundaryWeek;

            return (
              <div key={boundaryWeek}>
                {/* Scissor guide line */}
                <div
                  style={{
                    position: 'absolute',
                    left: `${lineLeft}px`,
                    top: 0,
                    bottom: 0,
                    width: '0px',
                    borderLeft: '1px dashed rgba(0, 0, 0, 0.6)',
                    opacity: isHovered ? 1 : 0.4,
                    zIndex: 100,
                    pointerEvents: 'none',
                    transition: 'opacity 0.15s ease'
                  }}
                />

                {/* Clickable area for scissor - invisible hitbox */}
                <div
                  style={{
                    position: 'absolute',
                    left: `${lineLeft - 8}px`,
                    top: 0,
                    width: '16px',
                    height: '100%',
                    cursor: 'pointer',
                    pointerEvents: 'auto',
                    zIndex: 101
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onScissorClick(event.id, boundaryWeek);
                  }}
                  onMouseEnter={() => setHoveredScissor(boundaryWeek)}
                  onMouseLeave={() => setHoveredScissor(null)}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Resize handles - скрываем для заблокированных событий */}
      {!scissorsMode && !isCtrlPressed && !isBlocked && (
        <>
          {/* Top handle - 50% max height to avoid overlap */}
          <div
            className="handle-container absolute left-0 right-0 top-0 cursor-ns-resize opacity-0 hover:opacity-100 transition-opacity flex items-start justify-center z-[150]"
            style={{ pointerEvents: 'auto', height: '50%', maxHeight: '32px' }}
            onPointerDown={(e) => onHandlePointerDown(e, event, 'top')}
          >
            <div className="handle-top h-1 rounded-sm bg-white/25 pointer-events-none mt-1" style={{ width: '50%', maxWidth: '60px', minWidth: '12px' }} />
          </div>

          {/* Bottom handle - 50% max height to avoid overlap */}
          <div
            className="handle-container absolute left-0 right-0 bottom-0 cursor-ns-resize opacity-0 hover:opacity-100 transition-opacity flex items-end justify-center z-[150]"
            style={{ pointerEvents: 'auto', height: '50%', maxHeight: '32px' }}
            onPointerDown={(e) => onHandlePointerDown(e, event, 'bottom')}
          >
            <div className="handle-bottom h-1 rounded-sm bg-white/25 pointer-events-none mb-1" style={{ width: '50%', maxWidth: '60px', minWidth: '12px' }} />
          </div>

          {/* Left handle - higher z-index, fixed width */}
          <div
            className="handle-container absolute left-0 top-0 bottom-0 w-8 px-1 cursor-ew-resize opacity-0 hover:opacity-100 transition-opacity flex items-center justify-start z-[151]"
            style={{ pointerEvents: 'auto' }}
            onPointerDown={(e) => onHandlePointerDown(e, event, 'left')}
          >
            <div className="handle-left w-1 rounded-sm bg-white/25 pointer-events-none" style={{ height: '50%', maxHeight: '40px', minHeight: '12px' }} />
          </div>

          {/* Right handle - higher z-index, fixed width */}
          <div
            className="handle-container absolute right-0 top-0 bottom-0 w-8 px-1 cursor-ew-resize opacity-0 hover:opacity-100 transition-opacity flex items-center justify-end z-[151]"
            style={{ pointerEvents: 'auto' }}
            onPointerDown={(e) => onHandlePointerDown(e, event, 'right')}
          >
            <div className="handle-right w-1 rounded-sm bg-white/25 pointer-events-none" style={{ height: '50%', maxHeight: '40px', minHeight: '12px' }} />
          </div>
        </>
      )}
    </div>
  );
}

// Обёртываем в React.memo для предотвращения лишних ре-рендеров
// Компонент будет ре-рендериться только если изменились критические пропсы
export const SchedulerEvent = memo(SchedulerEventComponent, (prevProps, nextProps) => {
  // Находим проект для сравнения стилей
  const prevProject = prevProps.projects.find(p => p.id === prevProps.event.projectId);
  const nextProject = nextProps.projects.find(p => p.id === nextProps.event.projectId);
  
  // Сравниваем стили проекта (backgroundColor, textColor, patternId)
  const projectStylesEqual = (
    prevProject?.backgroundColor === nextProject?.backgroundColor &&
    prevProject?.textColor === nextProject?.textColor &&
    prevProject?.patternId === nextProject?.patternId &&
    prevProject?.name === nextProject?.name
  );
  
  // Проверяем изменение showGaps / showPatterns
  const displayModeChanged = prevProps.showGaps !== nextProps.showGaps || prevProps.showPatterns !== nextProps.showPatterns;
  if (displayModeChanged) {
    console.log(`🔄 Event ${nextProps.event.id}: display settings changed`);
  }
  
  // Сравниваем только те поля, которые влияют на визуал
  const shouldSkipRender = (
    prevProps.event.id === nextProps.event.id &&
    prevProps.event.startWeek === nextProps.event.startWeek &&
    prevProps.event.weeksSpan === nextProps.event.weeksSpan &&
    prevProps.event.resourceIndex === nextProps.event.resourceIndex &&
    prevProps.event.unitsTall === nextProps.event.unitsTall &&
    prevProps.event.projectId === nextProps.event.projectId &&
    prevProps.left === nextProps.left &&
    prevProps.top === nextProps.top &&
    prevProps.width === nextProps.width &&
    prevProps.height === nextProps.height &&
    prevProps.eventRowH === nextProps.eventRowH &&
    prevProps.scissorsMode === nextProps.scissorsMode &&
    prevProps.commentMode === nextProps.commentMode &&
    prevProps.isCtrlPressed === nextProps.isCtrlPressed &&
    prevProps.isPending === nextProps.isPending &&
    prevProps.isBlocked === nextProps.isBlocked && // ✅ Сравниваем isBlocked для обновления спиннера
    prevProps.dimmed === nextProps.dimmed &&
    prevProps.showGaps === nextProps.showGaps &&
    prevProps.showPatterns === nextProps.showPatterns &&
    // Упрощённая логика v3.1: round* флаги
    prevProps.roundTopLeft === nextProps.roundTopLeft &&
    prevProps.roundTopRight === nextProps.roundTopRight &&
    prevProps.roundBottomLeft === nextProps.roundBottomLeft &&
    prevProps.roundBottomRight === nextProps.roundBottomRight &&
    // Внутренние скругления (для ::before/::after CSS)
    prevProps.innerTopLeftColor === nextProps.innerTopLeftColor &&
    prevProps.innerBottomLeftColor === nextProps.innerBottomLeftColor &&
    prevProps.innerTopRightColor === nextProps.innerTopRightColor &&
    prevProps.innerBottomRightColor === nextProps.innerBottomRightColor &&
    // Скрытие названия проекта
    prevProps.hideProjectName === nextProps.hideProjectName &&
    // КРИТИЧНО: Сравниваем стили проекта для обновления при изменении цветов/паттернов
    projectStylesEqual
  );
  
  return shouldSkipRender;
});