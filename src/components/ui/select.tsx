"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "./utils";

interface SelectContextType {
  value?: string;
  onValueChange?: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  placeholder?: string;
  selectedLabel?: string;
  setSelectedLabel: (label: string) => void;
}

const SelectContext = React.createContext<SelectContextType>({
  open: false,
  setOpen: () => {},
  setSelectedLabel: () => {},
});

const Select = ({
  value,
  onValueChange,
  children,
  ...props
}: {
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}) => {
  const [open, setOpen] = React.useState(false);
  const [selectedLabel, setSelectedLabel] = React.useState("");

  return (
    <SelectContext.Provider
      value={{
        value,
        onValueChange,
        open,
        setOpen,
        selectedLabel,
        setSelectedLabel,
      }}
    >
      <div className="relative" {...props}>
        {children}
      </div>
    </SelectContext.Provider>
  );
};

const SelectGroup = ({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div className={cn("", className)} {...props}>
      {children}
    </div>
  );
};

const SelectValue = ({
  placeholder,
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { placeholder?: string }) => {
  const { value, selectedLabel } = React.useContext(SelectContext);
  return (
    <span className={cn("block truncate text-base md:text-sm", className)} {...props}>
      {value ? selectedLabel || value : placeholder}
    </span>
  );
};

const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => {
  const { open, setOpen } = React.useContext(SelectContext);
  
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => setOpen(!open)}
      className={cn(
        "flex h-12 w-full items-center justify-between rounded-xl border border-gray-200 bg-transparent px-4 py-2 text-base md:text-sm shadow-none ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all hover:border-primary/50",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 opacity-50" />
    </button>
  );
});
SelectTrigger.displayName = "SelectTrigger";

const SelectContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, position = "popper", ...props }, ref) => {
  const { open, setOpen } = React.useContext(SelectContext);
  
  if (!open) return null;

  return (
    <>
      <div 
        className="fixed inset-0 z-50" 
        onClick={() => setOpen(false)} 
      />
      <div
        ref={ref}
        className={cn(
          "absolute z-50 min-w-[8rem] overflow-hidden rounded-xl border bg-popover text-popover-foreground animate-in fade-in-80 zoom-in-95",
          position === "popper" && "translate-y-1",
          className
        )}
        style={{ top: "100%", width: "100%" }}
        {...props}
      >
        <div className="p-1 h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]">
          {children}
        </div>
      </div>
    </>
  );
});
SelectContent.displayName = "SelectContent";

const SelectLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("py-2 pl-8 pr-2 text-sm font-semibold text-muted-foreground", className)}
    {...props}
  />
));
SelectLabel.displayName = "SelectLabel";

const SelectItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value: string }
>(({ className, children, value: itemValue, ...props }, ref) => {
  const { value, onValueChange, setOpen, setSelectedLabel } = React.useContext(SelectContext);
  const isSelected = value === itemValue;

  // Update label if selected (simple effect)
  React.useEffect(() => {
    if (isSelected) {
      // We need to extract text content for the label
      let label = "";
      if (typeof children === 'string') label = children;
      else if (Array.isArray(children)) label = children.map(c => typeof c === 'string' ? c : '').join('');
      // Fallback or heuristic
      if (!label && React.isValidElement(children)) { 
          // Try to get children if it's simple
          // @ts-ignore
          if (typeof children.props.children === 'string') label = children.props.children;
      }
      setSelectedLabel(label || (children as string));
    }
  }, [isSelected, children, setSelectedLabel]);

  return (
    <div
      ref={ref}
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-lg py-2.5 pl-10 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 hover:bg-accent hover:text-accent-foreground transition-colors",
        isSelected && "bg-secondary/50 text-secondary-foreground font-medium",
        className
      )}
      onClick={(e) => {
        e.stopPropagation();
        onValueChange?.(itemValue);
        setOpen(false);
      }}
      {...props}
    >
      <span className="absolute left-3 flex h-3.5 w-3.5 items-center justify-center">
        {isSelected && <Check className="h-4 w-4 text-primary" />}
      </span>
      <span className="truncate">{children}</span>
    </div>
  );
});
SelectItem.displayName = "SelectItem";

const SelectSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
));
SelectSeparator.displayName = "SelectSeparator";

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
};
