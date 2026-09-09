import * as React from 'react';
import { cn } from '@/lib/utils';

export type ProgressProps = React.HTMLAttributes<HTMLDivElement> & {
  value?: number | null;
};

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, ...props }, ref) => {
    const normalizedValue = Math.max(0, Math.min(value ?? 0, 100));

    return (
      <div
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={normalizedValue}
        className={cn('progress-root', className)}
        data-slot="progress"
        ref={ref}
        role="progressbar"
        {...props}
      >
        <div
          className="progress-indicator"
          style={{ transform: `translateX(-${100 - normalizedValue}%)` }}
        />
      </div>
    );
  },
);
Progress.displayName = 'Progress';

export { Progress };
