import type { ReactNode } from 'react';

type AnalyticsMetricCardProps = {
  icon: ReactNode;
  label: string;
  value: string;
  detail?: string;
};

export function AnalyticsMetricCard({ detail, icon, label, value }: AnalyticsMetricCardProps) {
  return (
    <article className="analytics-metric-card">
      <span className="analytics-metric-icon" aria-hidden="true">
        {icon}
      </span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {detail && <small>{detail}</small>}
      </div>
    </article>
  );
}
