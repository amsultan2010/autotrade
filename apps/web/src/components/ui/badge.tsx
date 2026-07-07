import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center font-mono text-[9px] font-bold uppercase tracking-[0.08em] px-1.5 py-0.5 rounded-[3px] border',
  {
    variants: {
      variant: {
        default:
          'text-teal bg-teal-dim border-[rgba(0,200,150,0.25)]',
        pos:
          'text-pos bg-[rgba(0,200,150,0.08)] border-[rgba(0,200,150,0.2)]',
        neg:
          'text-neg bg-[rgba(255,59,82,0.08)] border-[rgba(255,59,82,0.2)]',
        warn:
          'text-warn bg-[rgba(240,165,0,0.08)] border-[rgba(240,165,0,0.2)]',
        muted:
          'text-ink-3 bg-white/4 border-line',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
