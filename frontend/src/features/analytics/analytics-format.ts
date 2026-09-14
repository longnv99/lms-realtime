export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en').format(value);
}

export function formatDateTime(value: string | null): string {
  if (!value) {
    return 'No activity';
  }

  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
