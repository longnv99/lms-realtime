import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva('badge', {
  variants: {
    variant: {
      default: 'badge-muted',
      live: 'badge-live',
      muted: 'badge-muted',
      success: 'badge-success',
    },
  },
  defaultVariants: {
    variant: 'muted',
  },
});

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ className, variant }))} {...props} />;
}

export { Badge, badgeVariants };
