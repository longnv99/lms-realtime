import type { CSSProperties } from 'react';

type LoadingBlockProps = {
  height?: number;
  label?: string;
};

export function LoadingBlock({ height = 120, label = 'Dang tai' }: LoadingBlockProps) {
  return (
    <div
      aria-label={label}
      className="loading-block"
      role="status"
      style={{ '--loading-height': `${height}px` } as CSSProperties}
    />
  );
}
