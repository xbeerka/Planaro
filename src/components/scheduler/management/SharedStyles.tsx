import React from 'react';
import { cn } from '../../ui/utils';

export const ManagementInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-9 w-full rounded-lg border border-gray-200 bg-white px-3 py-1 text-sm shadow-sm transition-all",
      "file:border-0 file:bg-transparent file:text-sm file:font-medium",
      "placeholder:text-gray-400",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-500",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "hover:border-gray-300",
      className
    )}
    {...props}
  />
));
ManagementInput.displayName = 'ManagementInput';

export const ManagementSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <div className="relative">
    <select
      ref={ref}
      className={cn(
        "flex h-9 w-full appearance-none rounded-lg border border-gray-200 bg-white pl-3 pr-8 py-1 text-sm shadow-sm transition-all cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-500",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "hover:border-gray-300",
        className
      )}
      {...props}
    >
      {children}
    </select>
    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-gray-400">
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M2.5 4.5L6 8L9.5 4.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  </div>
));
ManagementSelect.displayName = 'ManagementSelect';

export const ManagementIconButton = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'danger' | 'default' | 'ghost' }>(({ className, variant = 'default', ...props }, ref) => {
  const variants = {
    default: "text-gray-400 hover:text-gray-600 hover:bg-gray-100",
    danger: "text-gray-400 hover:text-red-600 hover:bg-red-50",
    ghost: "text-gray-400 hover:text-gray-600",
  };

  return (
    <button
      ref={ref}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-lg transition-all",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        className
      )}
      {...props}
    />
  );
});
ManagementIconButton.displayName = 'ManagementIconButton';
