"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "./utils";

// Simple tooltip implementation using Portal for z-index safety

interface TooltipContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.MutableRefObject<HTMLElement | null>;
}

const TooltipContext = React.createContext<TooltipContextType>({
  open: false,
  setOpen: () => {},
  triggerRef: { current: null },
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
  const triggerRef = React.useRef<HTMLElement | null>(null);

  return (
    <TooltipProvider>
      <TooltipContext.Provider value={{ open, setOpen, triggerRef }}>
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
  const { setOpen, triggerRef } = React.useContext(TooltipContext);
  
  const handlers = {
    onMouseEnter: () => setOpen(true),
    onMouseLeave: () => setOpen(false),
    onFocus: () => setOpen(true),
    onBlur: () => setOpen(false),
  };

  // Callback ref to capture the element
  const setRef = React.useCallback((node: HTMLElement | null) => {
    if (node) {
      triggerRef.current = node;
    }
  }, [triggerRef]);

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement, {
      ...props,
      ...handlers,
      ref: setRef,
      className: cn(children.props.className, props.className)
    });
  }

  return (
    <div
      ref={setRef}
      {...props}
      style={{ display: 'inline-block', ...props.style }}
      {...handlers}
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
  const { open, triggerRef } = React.useContext(TooltipContext);
  const [position, setPosition] = React.useState<{ top: number; left: number; transform: string } | null>(null);

  React.useEffect(() => {
    if (open && triggerRef.current) {
      const updatePosition = () => {
        const trigger = triggerRef.current;
        if (!trigger) return;
        
        const rect = trigger.getBoundingClientRect();
        let top = 0;
        let left = 0;
        let transform = '';

        switch (side) {
          case 'top':
            top = rect.top - sideOffset;
            left = rect.left + rect.width / 2;
            transform = 'translate(-50%, -100%)';
            if (align === 'start') { left = rect.left; transform = 'translate(0, -100%)'; }
            if (align === 'end') { left = rect.right; transform = 'translate(-100%, -100%)'; }
            break;
          case 'bottom':
            top = rect.bottom + sideOffset;
            left = rect.left + rect.width / 2;
            transform = 'translate(-50%, 0)';
            if (align === 'start') { left = rect.left; transform = 'translate(0, 0)'; }
            if (align === 'end') { left = rect.right; transform = 'translate(-100%, 0)'; }
            break;
          case 'left':
            top = rect.top + rect.height / 2;
            left = rect.left - sideOffset;
            transform = 'translate(-100%, -50%)';
            break;
          case 'right':
            top = rect.top + rect.height / 2;
            left = rect.right + sideOffset;
            transform = 'translate(0, -50%)';
            break;
        }
        
        setPosition({ top, left, transform });
      };

      updatePosition();
      // Update on scroll/resize
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [open, side, sideOffset, align, triggerRef]);

  if (!open) return null;

  // Use Portal to render into body
  return createPortal(
    <div
      className={cn(
        "fixed z-[100000] overflow-hidden rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground",
        "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
        className
      )}
      style={{
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        transform: position?.transform ?? '',
        pointerEvents: 'none' // Tooltips shouldn't block interaction usually
      }}
      data-side={side}
      data-align={align}
      data-state={open && position ? "delayed-open" : "closed"}
      {...props}
    >
      {children}
    </div>,
    document.body
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
