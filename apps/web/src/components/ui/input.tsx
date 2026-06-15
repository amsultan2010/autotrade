import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'bg-surface-2 border border-line-2 rounded-[var(--r-sm)] text-ink font-mono text-[13px] px-3 py-1.5 w-full outline-none transition-colors',
          'placeholder:text-ink-3 focus:border-teal',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
