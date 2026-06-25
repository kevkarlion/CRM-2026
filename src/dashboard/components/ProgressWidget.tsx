// ── Progress widget — bar con label y porcentaje ──────────

type ProgressVariant = 'success' | 'warning' | 'danger' | 'info';

interface ProgressWidgetProps {
  label: string;
  value: number; // 0–100
  variant?: ProgressVariant;
  showLabel?: boolean;
}

const fillClass: Record<ProgressVariant, string> = {
  success: 'progress-bar-fill-success',
  warning: 'progress-bar-fill-warning',
  danger: 'progress-bar-fill-danger',
  info: 'progress-bar-fill-info',
};

export function ProgressWidget({ label, value, variant = 'info', showLabel = true }: ProgressWidgetProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className="metric-card">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        {showLabel && <span className="text-sm text-gray-500">{clamped}%</span>}
      </div>
      <div className="progress-bar">
        <div
          className={`progress-bar-fill ${fillClass[variant]}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
