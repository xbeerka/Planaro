import * as React from "react";

interface SimpleInputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const SimpleInput = React.forwardRef<HTMLInputElement, SimpleInputProps>(
  ({ className = "", type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={`flex h-9 w-full min-w-0 rounded-md border border-input bg-input-background px-3 py-1 transition-[color,box-shadow] outline-none placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] ${className}`}
        ref={ref}
        {...props}
      />
    );
  }
);

SimpleInput.displayName = "SimpleInput";
