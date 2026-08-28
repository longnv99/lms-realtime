import type { ReactNode } from 'react';

type StatusTone = 'live' | 'muted' | 'success';

type StatusBadgeProps = {
  children: ReactNode;
  tone?: StatusTone;
};

export function StatusBadge({ children, tone = 'muted' }: StatusBadgeProps) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
