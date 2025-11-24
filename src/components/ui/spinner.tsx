import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  color?: string;
}

const sizeClasses = {
  sm: 'w-6 h-6',
  md: 'w-10 h-10',
  lg: 'w-16 h-16',
  xl: 'w-24 h-24',
};

export function Spinner({ size = 'md', className = '', color }: SpinnerProps) {
  const sizeClass = sizeClasses[size];
  const colorClass = color || 'text-[#39EC00]';
  
  return (
    <div className={`relative ${sizeClass} ${className}`} role="status" aria-label="Загрузка">
      <svg
        className="animate-spin"
        viewBox="0 0 50 50"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Background circle (faded) */}
        <circle
          className="opacity-25"
          cx="25"
          cy="25"
          r="20"
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
          style={{ color: colorClass.replace('text-', '') === colorClass ? colorClass : undefined }}
        />
        {/* Animated path */}
        <circle
          className="spinner-path"
          cx="25"
          cy="25"
          r="20"
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeDasharray="1, 200"
          strokeDashoffset="0"
          style={{ 
            color: colorClass.replace('text-', '') === colorClass ? colorClass : undefined,
            animation: 'spinner-dash 1.5s ease-in-out infinite'
          }}
        />
      </svg>
    </div>
  );
}

interface LoadingScreenProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function LoadingScreen({ message = 'Загрузка...', size = 'lg' }: LoadingScreenProps) {
  return (
    <div className="min-h-screen bg-[#f7f9fb] flex items-center justify-center">
      <div className="text-center">
        <Spinner size={size} className="text-[#39EC00] mx-auto mb-6" />
        <p className="text-gray-600 text-lg">{message}</p>
      </div>
    </div>
  );
}
