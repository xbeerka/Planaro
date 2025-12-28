import React, { InputHTMLAttributes, SelectHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../utils/cn'; // Assuming we have a cn utility, or I will implement a simple class joiner if not found, but standard projects usually have one.

// Fallback for cn if not available in project (safest bet is to assume it might be in /lib/utils or /utils/cn, but I'll use simple template literals if I can't find it. 
// Actually, I saw `import { cn } from "./utils";` in the input.tsx read earlier, so it's likely in /components/ui/utils or similar.
// I'll stick to simple string concatenation or standard template literals to be safe and avoid import errors, or try to locate it.
// The user's input.tsx import was `import { cn } from "./utils";` inside /components/ui/. 
// I'll just write clean className strings.

interface ManagementRowProps extends React.HTMLAttributes<HTMLDivElement> {
  isNew?: boolean;
  isHighlighted?: boolean;
}

export const ManagementRow = forwardRef<HTMLDivElement, ManagementRowProps>(
  ({ className, isNew, isHighlighted, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`
          px-6 py-3 border-b border-gray-100 transition-all duration-200 group
          ${isNew ? 'bg-blue-50/50' : isHighlighted ? 'bg-blue-50/30' : 'bg-white hover:bg-gray-50/50'}
          ${className || ''}
        `}
        {...props}
      >
        <div className="flex items-center gap-3">
          {children}
        </div>
      </div>
    );
  }
);

interface ManagementInputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const ManagementInput = forwardRef<HTMLInputElement, ManagementInputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`
          h-9 px-3 bg-white border border-gray-200 rounded-lg text-[14px] leading-none 
          transition-all outline-none placeholder:text-gray-400 
          focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500
          disabled:opacity-50 disabled:cursor-not-allowed
          ${className || ''}
        `}
        {...props}
      />
    );
  }
);

interface ManagementSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {}

export const ManagementSelect = forwardRef<HTMLSelectElement, ManagementSelectProps>(
  ({ className, style, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={`
          h-9 pl-3 pr-8 bg-white border border-gray-200 rounded-lg text-[14px] leading-none 
          transition-all outline-none cursor-pointer text-gray-700 
          focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500
          disabled:opacity-50 disabled:cursor-not-allowed
          appearance-none
          ${className || ''}
        `}
        style={{
          ...style,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239CA3AF' d='M10.293 3.293L6 7.586 1.707 3.293A1 1 0 00.293 4.707l5 5a1 1 0 001.414 0l5-5a1 1 0 10-1.414-1.414z'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 0.75rem center'
        }}
        {...props}
      />
    );
  }
);

interface ManagementActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'ghost';
  showOnHover?: boolean;
}

export const ManagementActionButton = forwardRef<HTMLButtonElement, ManagementActionButtonProps>(
  ({ className, variant = 'default', showOnHover = false, children, ...props }, ref) => {
    const baseStyles = "flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg transition-all";
    
    let variantStyles = "";
    if (variant === 'destructive') {
      variantStyles = "text-gray-400 hover:text-red-500 hover:bg-red-50";
    } else if (variant === 'ghost') {
      variantStyles = "text-gray-400 hover:text-gray-600 hover:bg-gray-100";
    } else {
      variantStyles = "text-gray-500 hover:bg-gray-100 hover:text-gray-900";
    }

    const visibilityStyles = showOnHover ? "opacity-0 group-hover:opacity-100" : "";

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variantStyles} ${visibilityStyles} ${className || ''}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

interface ManagementAvatarProps {
  src?: string;
  name: string;
  className?: string;
}

export const ManagementAvatar = ({ src, name, className }: ManagementAvatarProps) => {
  // Helper for initials
  const getInitials = (fullName: string): string => {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`w-9 h-9 rounded-[12px] object-cover bg-gray-100 ${className || ''}`}
      />
    );
  }

  return (
    <div
      className={`w-9 h-9 flex items-center justify-center rounded-[12px] bg-[#F6F6F6] ${className || ''}`}
    >
      <span className="text-sm font-medium text-[#868789]">
        {getInitials(name)}
      </span>
    </div>
  );
};
