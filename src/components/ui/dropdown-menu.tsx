"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react";
import { cn } from "./utils";

// Simple dropdown menu implementation without Radix UI
// Compatible API with the original shadcn dropdown-menu component

interface DropdownMenuProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const DropdownMenuContext = React.createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>({
  open: false,
  setOpen: () => {},
});

const DropdownMenuPositionContext = React.createContext<{
  triggerRef: React.RefObject<HTMLDivElement>;
}>({
  triggerRef: { current: null },
});

function DropdownMenu({ children, open: controlledOpen, onOpenChange }: DropdownMenuProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLDivElement>(null);
  
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = React.useCallback((value: boolean) => {
    if (onOpenChange) {
      onOpenChange(value);
    } else {
      setInternalOpen(value);
    }
  }, [onOpenChange]);

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen }}>
      <DropdownMenuPositionContext.Provider value={{ triggerRef }}>
        {children}
      </DropdownMenuPositionContext.Provider>
    </DropdownMenuContext.Provider>
  );
}

function DropdownMenuTrigger({ 
  children, 
  asChild,
  ...props 
}: React.HTMLAttributes<HTMLDivElement> & { asChild?: boolean }) {
  const { open, setOpen } = React.useContext(DropdownMenuContext);
  const { triggerRef } = React.useContext(DropdownMenuPositionContext);
  
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(!open);
  };
  
  if (asChild && React.isValidElement(children)) {
    return (
      <div ref={triggerRef} style={{ display: 'inline-block' }}>
        {React.cloneElement(children as React.ReactElement, {
          onClick: handleClick,
        })}
      </div>
    );
  }
  
  return (
    <div
      ref={triggerRef}
      {...props}
      onClick={handleClick}
      style={{ cursor: 'pointer' }}
    >
      {children}
    </div>
  );
}

function DropdownMenuContent({
  className,
  sideOffset = 4,
  align = "end",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  sideOffset?: number;
  align?: "start" | "center" | "end";
}) {
  const { open, setOpen } = React.useContext(DropdownMenuContext);
  const { triggerRef } = React.useContext(DropdownMenuPositionContext);
  const ref = React.useRef<HTMLDivElement>(null);
  const [position, setPosition] = React.useState({ top: 0, left: 0, right: 0 });

  // Calculate position based on trigger
  React.useEffect(() => {
    if (!open || !triggerRef.current) return;

    const updatePosition = () => {
      const triggerRect = triggerRef.current!.getBoundingClientRect();
      const contentRect = ref.current?.getBoundingClientRect();
      
      const top = triggerRect.bottom + sideOffset;
      
      let left = 0;
      let right = 0;
      
      if (align === "end") {
        right = window.innerWidth - triggerRect.right;
      } else if (align === "start") {
        left = triggerRect.left;
      } else {
        // center
        left = triggerRect.left + triggerRect.width / 2;
        if (contentRect) {
          left -= contentRect.width / 2;
        }
      }
      
      setPosition({ top, left, right });
    };

    updatePosition();
    
    // Update on scroll/resize
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, triggerRef, sideOffset, align]);

  // Close on click outside
  React.useEffect(() => {
    if (!open) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node) &&
          triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, setOpen, triggerRef]);

  if (!open) return null;

  const content = (
    <div
      ref={ref}
      className={cn(
        "fixed z-[9999] min-w-[8rem] overflow-hidden rounded-xl border bg-popover p-1 text-popover-foreground",
        "animate-in fade-in-0 zoom-in-95",
        className
      )}
      style={{
        top: `${position.top}px`,
        ...(align === "end" ? { right: `${position.right}px` } : { left: `${position.left}px` })
      }}
      {...props}
    >
      {children}
    </div>
  );

  // Render via portal to document.body to avoid overflow issues
  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  onClick,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  inset?: boolean;
  variant?: "default" | "destructive";
}) {
  const { setOpen } = React.useContext(DropdownMenuContext);

  return (
    <div
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2 text-sm outline-none transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        "focus:bg-accent focus:text-accent-foreground",
        variant === "destructive" && "text-destructive hover:bg-destructive/10 focus:bg-destructive/10",
        inset && "pl-8",
        className
      )}
      onClick={(e) => {
        onClick?.(e);
        setOpen(false);
      }}
      {...props}
    >
      {children}
    </div>
  );
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  checked?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-lg py-2 pl-8 pr-2 text-sm outline-none transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        "focus:bg-accent focus:text-accent-foreground",
        className
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        {checked && <CheckIcon className="h-4 w-4" />}
      </span>
      {children}
    </div>
  );
}

function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-lg py-2 pl-8 pr-2 text-sm outline-none transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        "focus:bg-accent focus:text-accent-foreground",
        className
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <CircleIcon className="h-2 w-2 fill-current" />
      </span>
      {children}
    </div>
  );
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  inset?: boolean;
}) {
  return (
    <div
      className={cn(
        "px-3 py-2 text-sm font-semibold",
        inset && "pl-8",
        className
      )}
      {...props}
    />
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("-mx-1 my-1 h-px bg-muted", className)}
      {...props}
    />
  );
}

function DropdownMenuShortcut({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("ml-auto text-xs tracking-widest opacity-60", className)}
      {...props}
    />
  );
}

function DropdownMenuGroup({ ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} />;
}

function DropdownMenuPortal({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function DropdownMenuSub({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  inset?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex cursor-pointer select-none items-center rounded-lg px-2 py-1.5 text-sm outline-none",
        "hover:bg-accent",
        inset && "pl-8",
        className
      )}
      {...props}
    />
  );
}

function DropdownMenuSubContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "z-50 min-w-[8rem] overflow-hidden rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg",
        className
      )}
      {...props}
    />
  );
}

function DropdownMenuRadioGroup({ ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} />;
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
};
