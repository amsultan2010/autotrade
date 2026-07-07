import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all motion-safe:duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-50 cursor-pointer active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:
          'bg-accent text-bg hover:bg-accent-hover shadow-sm',
        destructive:
          'bg-negative text-ink hover:brightness-110',
        outline:
          'border border-border-strong bg-transparent text-ink-secondary hover:bg-surface-overlay hover:text-ink',
        ghost:
          'bg-transparent text-ink-secondary hover:bg-surface-overlay hover:text-ink',
        secondary:
          'bg-surface-overlay text-ink border border-border hover:border-border-strong',
        link:
          'text-accent underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2 min-h-[44px]',
        sm: 'h-8 px-3 text-xs min-h-[36px]',
        lg: 'h-12 px-6 text-base min-h-[48px]',
        icon: 'h-10 w-10 min-h-[44px] min-w-[44px]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
