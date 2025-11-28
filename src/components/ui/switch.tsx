"use client";

import * as React from "react";
import { cn } from "./utils";

// Custom Switch implementation to replace Radix UI
// avoiding "Failed to fetch" errors.

interface SwitchProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked: controlledChecked, onCheckedChange, defaultChecked = false, disabled, ...props }, ref) => {
    const [uncontrolledChecked, setUncontrolledChecked] = React.useState(defaultChecked);
    const isControlled = controlledChecked !== undefined;
    const checked = isControlled ? controlledChecked : uncontrolledChecked;

    const toggle = () => {
      if (disabled) return;
      const newValue = !checked;
      if (!isControlled) {
        setUncontrolledChecked(newValue);
      }
      onCheckedChange?.(newValue);
    };

    const state = checked ? "checked" : "unchecked";

    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        data-state={state}
        disabled={disabled}
        ref={ref}
        onClick={toggle}
        className={cn(
          "peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-switch-background focus-visible:border-ring focus-visible:ring-ring/50 dark:data-[state=unchecked]:bg-input/80 inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
          // Fallback for bg-switch-background if not defined
          "data-[state=unchecked]:bg-input/50",
          className
        )}
        {...props}
      >
        <span
          data-state={state}
          className={cn(
            "bg-card dark:data-[state=unchecked]:bg-card-foreground dark:data-[state=checked]:bg-primary-foreground pointer-events-none block size-4 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0"
          )}
        />
      </button>
    );
  }
);
Switch.displayName = "Switch";

export { Switch };
