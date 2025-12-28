import { forwardRef, ReactNode, SelectHTMLAttributes, InputHTMLAttributes } from 'react';

// ============================================================================
// UNIFIED INPUT COMPONENTS
// Единые стили для всех полей ввода в управлении
// Все поля имеют: белый фон + border + одинаковое скругление (8px)
// ============================================================================

const baseInputStyles = "w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all";
const disabledInputStyles = "bg-gray-50 text-gray-500 cursor-not-allowed";
const errorInputStyles = "border-red-300 focus:border-red-500 focus:ring-red-500/20";

// ============================================================================
// TEXT INPUT
// ============================================================================

interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  error?: boolean;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(({
  className = '',
  error,
  disabled,
  ...props
}, ref) => {
  const styles = [
    baseInputStyles,
    disabled && disabledInputStyles,
    error && errorInputStyles,
    className
  ].filter(Boolean).join(' ');

  return (
    <input
      ref={ref}
      type="text"
      className={styles}
      disabled={disabled}
      {...props}
    />
  );
});

TextInput.displayName = 'TextInput';

// ============================================================================
// NUMBER INPUT
// ============================================================================

interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  error?: boolean;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(({
  className = '',
  error,
  disabled,
  ...props
}, ref) => {
  const styles = [
    baseInputStyles,
    disabled && disabledInputStyles,
    error && errorInputStyles,
    className
  ].filter(Boolean).join(' ');

  return (
    <input
      ref={ref}
      type="number"
      className={styles}
      disabled={disabled}
      {...props}
    />
  );
});

NumberInput.displayName = 'NumberInput';

// ============================================================================
// SELECT INPUT
// ============================================================================

interface SelectInputProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const SelectInput = forwardRef<HTMLSelectElement, SelectInputProps>(({
  className = '',
  error,
  disabled,
  children,
  ...props
}, ref) => {
  const styles = [
    baseInputStyles,
    disabled && disabledInputStyles,
    error && errorInputStyles,
    'appearance-none cursor-pointer',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className="relative">
      <select
        ref={ref}
        className={styles}
        disabled={disabled}
        {...props}
      >
        {children}
      </select>
      {/* Custom arrow */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  );
});

SelectInput.displayName = 'SelectInput';

// ============================================================================
// SEARCH INPUT
// ============================================================================

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  icon?: ReactNode;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(({
  className = '',
  icon,
  ...props
}, ref) => {
  return (
    <div className="relative">
      {icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          {icon}
        </div>
      )}
      <input
        ref={ref}
        type="text"
        className={`${baseInputStyles} ${icon ? 'pl-10' : ''} ${className}`}
        {...props}
      />
    </div>
  );
});

SearchInput.displayName = 'SearchInput';

// ============================================================================
// COLOR INPUT (hex color)
// ============================================================================

interface ColorInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  error?: boolean;
}

export const ColorInput = forwardRef<HTMLInputElement, ColorInputProps>(({
  className = '',
  error,
  disabled,
  ...props
}, ref) => {
  const styles = [
    baseInputStyles,
    disabled && disabledInputStyles,
    error && errorInputStyles,
    'font-mono uppercase',
    className
  ].filter(Boolean).join(' ');

  return (
    <input
      ref={ref}
      type="text"
      className={styles}
      disabled={disabled}
      placeholder="#FFFFFF"
      maxLength={7}
      {...props}
    />
  );
});

ColorInput.displayName = 'ColorInput';

// ============================================================================
// LABEL
// ============================================================================

interface LabelProps {
  children: ReactNode;
  required?: boolean;
  htmlFor?: string;
  className?: string;
}

export function Label({ children, required, htmlFor, className = '' }: LabelProps) {
  return (
    <label 
      htmlFor={htmlFor}
      className={`block text-sm font-medium text-gray-700 mb-1.5 ${className}`}
    >
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );
}

// ============================================================================
// FORM FIELD (Label + Input wrapper)
// ============================================================================

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
  className?: string;
}

export function FormField({ label, required, error, children, className = '' }: FormFieldProps) {
  return (
    <div className={className}>
      <Label required={required}>{label}</Label>
      {children}
      {error && (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
