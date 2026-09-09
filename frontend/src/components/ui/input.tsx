import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input className={cn('field-control', className)} ref={ref} type={type} {...props} />
  ),
);
Input.displayName = 'Input';

export { Input };
