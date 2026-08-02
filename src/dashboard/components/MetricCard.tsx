// ── KPI metric card ────────────────────────────────────────

import Link from 'next/link';

interface MetricCardProps {
  label: string;
  value: string | number;
  /** Optional trend indicator */
  trend?: { direction: 'up' | 'down'; label: string };
  /** Optional extra detail shown under the value */
  detail?: string;
  /** Optional loading state */
  loading?: boolean;
  /** Optional link to another page */
  href?: string;
  /** Optional accent color class */
  accentColor?: string;
}

export function MetricCard({ label, value, trend, detail, loading, href, accentColor }: MetricCardProps) {
  if (loading) {
    return (
      <div className="kpi-card">
        <div className="skeleton-text mb-2" />
        <div className="skeleton h-8 w-20" />
      </div>
    );
  }

  const content = (
    <>
      <p className="kpi-label">{label}</p>
      <p className={`kpi-value ${accentColor || ''}`}>{value}</p>
      {detail && (
        <p className="mt-1 text-xs text-gray-500">{detail}</p>
      )}
      {trend && (
        <p className={`mt-1 text-xs font-medium inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${trend.direction === 'up' ? 'kpi-trend-up' : 'kpi-trend-down'}`}>
          {trend.direction === 'up' ? '↑' : '↓'} {trend.label}
        </p>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="kpi-card hover:border-brand-300 hover:shadow-md transition-all cursor-pointer">
        {content}
      </Link>
    );
  }

  return (
    <div className="kpi-card">
      {content}
    </div>
  );
}
