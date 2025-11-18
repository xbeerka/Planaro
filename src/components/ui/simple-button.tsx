import * as React from "react";

interface SimpleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
}

export function SimpleButton({
  className = "",
  variant = "default",
  size = "default",
  children,
  ...props
}: SimpleButtonProps) {
  const variantClasses = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    outline: "border bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    destructive: "bg-destructive text-white hover:bg-destructive/90"
  };

  const sizeClasses = {
    default: "h-9 px-4 py-2",
    sm: "h-8 px-3",
    lg: "h-10 px-6",
    icon: "size-9"
  };

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md transition-all disabled:pointer-events-none disabled:opacity-50 outline-none ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
