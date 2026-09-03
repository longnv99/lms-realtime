import type { ReactNode } from 'react';
import { Badge } from './ui/badge';

type StatusTone = 'live' | 'muted' | 'success';

type StatusBadgeProps = {
  children: ReactNode;
  tone?: StatusTone;
};

export function StatusBadge({ children, tone = 'muted' }: StatusBadgeProps) {
  return <Badge variant={tone}>{children}</Badge>;
}
