import * as React from "react";

interface SimpleLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

export function SimpleLabel({ className = "", children, ...props }: SimpleLabelProps) {
  return (
    <label
      className={`flex items-center gap-2 select-none ${className}`}
      {...props}
    >
      {children}
    </label>
  );
}
