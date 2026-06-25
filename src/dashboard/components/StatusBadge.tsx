// ── Status badge component ─────────────────────────────────

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface StatusBadgeProps {
  label: string;
  variant?: BadgeVariant;
}

const variantClass: Record<BadgeVariant, string> = {
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-danger',
  info: 'badge-info',
  neutral: 'badge-neutral',
};

export function StatusBadge({ label, variant = 'neutral' }: StatusBadgeProps) {
  return (
    <span className={`badge ${variantClass[variant]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${variant === 'success' ? 'bg-success-500' : variant === 'warning' ? 'bg-warning-500' : variant === 'danger' ? 'bg-danger-500' : variant === 'info' ? 'bg-info-500' : 'bg-gray-400'}`} />
      {label}
    </span>
  );
}
