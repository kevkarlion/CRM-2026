// ── KPI metric card ────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: string | number;
  /** Optional trend indicator */
  trend?: { direction: 'up' | 'down'; label: string };
  /** Optional loading state */
  loading?: boolean;
}

export function MetricCard({ label, value, trend, loading }: MetricCardProps) {
  if (loading) {
    return (
      <div className="kpi-card">
        <div className="skeleton-text mb-2" />
        <div className="skeleton h-8 w-20" />
      </div>
    );
  }

  return (
    <div className="kpi-card">
      <p className="kpi-label">{label}</p>
      <p className="kpi-value">{value}</p>
      {trend && (
        <p className={`mt-1 text-xs font-medium inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${trend.direction === 'up' ? 'kpi-trend-up' : 'kpi-trend-down'}`}>
          {trend.direction === 'up' ? '↑' : '↓'} {trend.label}
        </p>
      )}
    </div>
  );
}
