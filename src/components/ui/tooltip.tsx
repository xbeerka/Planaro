"use client";

import * as React from "react";
import { cn } from "./utils";

// Simple tooltip implementation without Radix UI
// Compatible API with the original shadcn tooltip component

interface TooltipContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const TooltipContext = React.createContext<TooltipContextType>({
  open: false,
  setOpen: () => {},
});

function TooltipProvider({
  delayDuration = 0,
  children,
}: {
  delayDuration?: number;
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

function Tooltip({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);

  return (
    <TooltipProvider>
      <TooltipContext.Provider value={{ open, setOpen }}>
        {children}
      </TooltipContext.Provider>
    </TooltipProvider>
  );
}

function TooltipTrigger({
  children,
  asChild,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { asChild?: boolean }) {
  const { setOpen } = React.useContext(TooltipContext);

  return (
    <div
      {...props}
      style={{ position: 'relative', display: 'inline-block', ...props.style }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
    </div>
  );
}

function TooltipContent({
  className,
  sideOffset = 4,
  side = "bottom",
  align = "center",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  sideOffset?: number;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
}) {
  const { open } = React.useContext(TooltipContext);
  const tooltipRef = React.useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = React.useState<React.CSSProperties>({});

  // Base position based on side and align
  const basePosition = React.useMemo(() => {
    switch (side) {
      case "top":
        return {
          bottom: `calc(100% + ${sideOffset}px)`,
          ...(align === "start" ? { left: '0' } : align === "end" ? { right: '0' } : { left: '50%', transform: 'translateX(-50%)' }),
        };
      case "bottom":
        return {
          top: `calc(100% + ${sideOffset}px)`,
          ...(align === "start" ? { left: '0' } : align === "end" ? { right: '0' } : { left: '50%', transform: 'translateX(-50%)' }),
        };
      case "left":
        return {
          right: `calc(100% + ${sideOffset}px)`,
          ...(align === "start" ? { top: '0' } : align === "end" ? { bottom: '0' } : { top: '50%', transform: 'translateY(-50%)' }),
        };
      case "right":
        return {
          left: `calc(100% + ${sideOffset}px)`,
          ...(align === "start" ? { top: '0' } : align === "end" ? { bottom: '0' } : { top: '50%', transform: 'translateY(-50%)' }),
        };
      default:
        return {
          top: `calc(100% + ${sideOffset}px)`,
          ...(align === "start" ? { left: '0' } : align === "end" ? { right: '0' } : { left: '50%', transform: 'translateX(-50%)' }),
        };
    }
  }, [side, sideOffset, align]);

  // Adjust position to stay within viewport bounds
  React.useEffect(() => {
    if (!open || !tooltipRef.current) return;

    const tooltip = tooltipRef.current;
    const rect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 8; // минимальный отступ от края экрана

    let adjustments: React.CSSProperties = {};

    // Проверка горизонтальных границ (для top/bottom)
    if (side === 'top' || side === 'bottom') {
      // Только для center alignment проверяем центрирование
      if (align === 'center') {
        if (rect.left < margin) {
          // Тултип уходит влево за границу
          const offset = margin - rect.left;
          adjustments.transform = `translateX(calc(-50% + ${offset}px))`;
        } else if (rect.right > viewportWidth - margin) {
          // Тултип уходит вправо за границу
          const offset = rect.right - (viewportWidth - margin);
          adjustments.transform = `translateX(calc(-50% - ${offset}px))`;
        }
      } else {
        // Для start/end alignment - просто проверяем выход за границы
        if (align === 'start' && rect.right > viewportWidth - margin) {
          adjustments.maxWidth = `${viewportWidth - rect.left - margin}px`;
        } else if (align === 'end' && rect.left < margin) {
          adjustments.maxWidth = `${rect.right - margin}px`;
        }
      }
    }

    // Проверка вертикальных границ (для left/right)
    if (side === 'left' || side === 'right') {
      // Только для center alignment проверяем центрирование
      if (align === 'center') {
        if (rect.top < margin) {
          // Тултип уходит вверх за границу
          const offset = margin - rect.top;
          adjustments.transform = `translateY(calc(-50% + ${offset}px))`;
        } else if (rect.bottom > viewportHeight - margin) {
          // Тултип уходит вниз за границу
          const offset = rect.bottom - (viewportHeight - margin);
          adjustments.transform = `translateY(calc(-50% - ${offset}px))`;
        }
      }
    }

    // Проверка что тултип не уходит за верхнюю границу (для side="top")
    if (side === 'top' && rect.top < margin) {
      // Переключаем на bottom
      adjustments = {
        top: `calc(100% + ${sideOffset}px)`,
        bottom: 'auto',
        ...(align === 'start' ? { left: '0' } : align === 'end' ? { right: '0' } : { left: '50%', transform: 'translateX(-50%)' }),
      };
    }

    // Проверка что тултип не уходит за нижнюю границу (для side="bottom")
    if (side === 'bottom' && rect.bottom > viewportHeight - margin) {
      // Переключаем на top
      adjustments = {
        bottom: `calc(100% + ${sideOffset}px)`,
        top: 'auto',
        ...(align === 'start' ? { left: '0' } : align === 'end' ? { right: '0' } : { left: '50%', transform: 'translateX(-50%)' }),
      };
    }

    setAdjustedPosition(adjustments);
  }, [open, side, sideOffset, align]);

  // ✅ Условный return ПОСЛЕ всех хуков
  if (!open) return null;

  return (
    <div
      ref={tooltipRef}
      className={cn(
        "absolute z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground",
        "animate-in fade-in-0 zoom-in-95",
        "pointer-events-none",
        "whitespace-nowrap max-w-[300px]",
        className
      )}
      style={{ ...basePosition, ...adjustedPosition }}
      {...props}
    >
      {children}
    </div>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };