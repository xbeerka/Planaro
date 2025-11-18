import * as React from "react";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={() => onOpenChange(false)}
      />
      {children}
    </div>
  );
}

interface DialogContentProps {
  className?: string;
  children: React.ReactNode;
}

export function DialogContent({ className = "", children }: DialogContentProps) {
  return (
    <div
      className={`relative bg-background z-[5001] grid w-full max-w-[calc(100%-2rem)] gap-4 rounded-lg border p-6 shadow-lg sm:max-w-lg ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

export function DialogHeader({ className = "", children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`flex flex-col gap-2 text-center sm:text-left ${className}`} {...props}>
      {children}
    </div>
  );
}

export function DialogTitle({ className = "", children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={`${className}`} {...props}>
      {children}
    </h2>
  );
}

export function DialogDescription({ className = "", children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={`text-muted-foreground ${className}`} {...props}>
      {children}
    </p>
  );
}
