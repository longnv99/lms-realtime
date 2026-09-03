import type { CSSProperties } from 'react';
import { Skeleton } from './ui/skeleton';

type LoadingBlockProps = {
  height?: number;
  label?: string;
};

export function LoadingBlock({ height = 120, label = 'Loading' }: LoadingBlockProps) {
  return (
    <Skeleton
      aria-label={label}
      role="status"
      style={{ '--loading-height': `${height}px` } as CSSProperties}
    />
  );
}
