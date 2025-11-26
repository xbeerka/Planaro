"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "./utils";

// Simple Context-based Dialog implementation to replace Radix UI
// avoiding "Failed to fetch" errors.

interface DialogContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextType>({
  open: false,
  setOpen: () => {},
});

function Dialog({
  children,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  defaultOpen = false,
  ...props
}: {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  [key: string]: any;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = React.useCallback(
    (newOpen: boolean) => {
      if (controlledOnOpenChange) {
        controlledOnOpenChange(newOpen);
      }
      if (!isControlled) {
        setUncontrolledOpen(newOpen);
      }
    },
    [controlledOnOpenChange, isControlled]
  );

  return (
    <DialogContext.Provider value={{ open, setOpen }}>
      <div data-slot="dialog" {...props}>
        {children}
      </div>
    </DialogContext.Provider>
  );
}

function DialogTrigger({
  children,
  asChild,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const { setOpen } = React.useContext(DialogContext);
  
  // Simplified trigger handling
  return (
    <button
      data-slot="dialog-trigger"
      onClick={(e) => {
        setOpen(true);
        props.onClick?.(e);
      }}
      {...props}
    >
      {children}
    </button>
  );
}

function DialogPortal({ children, ...props }: { children: React.ReactNode }) {
  // In a real app we might use createPortal, but for simplicity and stability
  // we render inline or just assume the user handles z-index.
  // However, to ensure it overlays, we relying on fixed positioning in Content/Overlay.
  // Since we are replacing Radix, we will just render children if open.
  const { open } = React.useContext(DialogContext);
  
  if (!open) return null;

  return (
    <div data-slot="dialog-portal" {...props}>
      {children}
    </div>
  );
}

function DialogClose({
  children,
  asChild,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const { setOpen } = React.useContext(DialogContext);
  
  return (
    <button
      data-slot="dialog-close"
      onClick={(e) => {
        setOpen(false);
        props.onClick?.(e);
      }}
      {...props}
    >
      {children}
    </button>
  );
}

const DialogOverlay = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => {
  const { setOpen } = React.useContext(DialogContext);
  return (
    <div
      ref={ref}
      data-slot="dialog-overlay"
      onClick={() => setOpen(false)}
      className={cn(
        "fixed inset-0 z-[5000] bg-black/50 animate-in fade-in-0",
        className
      )}
      {...props}
    />
  );
});
DialogOverlay.displayName = "DialogOverlay";

const DialogContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<"div">
>(({ className, children, ...props }, ref) => {
  const { setOpen } = React.useContext(DialogContext);
  return (
    <DialogPortal>
      <DialogOverlay />
      <div
        ref={ref}
        data-slot="dialog-content"
        className={cn(
          "fixed top-[50%] left-[50%] z-[5000] grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 animate-in fade-in-0 zoom-in-95 sm:max-w-lg",
          className
        )}
        {...props}
      >
        {children}
        <button
          onClick={() => setOpen(false)}
          className="absolute top-4 right-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
      </div>
    </DialogPortal>
  );
});
DialogContent.displayName = "DialogContent";

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.ComponentPropsWithoutRef<"h2">
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    data-slot="dialog-title"
    className={cn("text-lg leading-none font-semibold", className)}
    {...props}
  />
));
DialogTitle.displayName = "DialogTitle";

const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentPropsWithoutRef<"p">
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    data-slot="dialog-description"
    className={cn("text-muted-foreground text-sm", className)}
    {...props}
  />
));
DialogDescription.displayName = "DialogDescription";

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
