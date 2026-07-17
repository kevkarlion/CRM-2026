'use client';

interface IndicatorCardProps {
  label: string;
  value: string | number;
  loading?: boolean;
}

export function IndicatorCard({ label, value, loading }: IndicatorCardProps) {
  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="h-3 w-24 animate-pulse rounded bg-gray-200" />
        <div className="mt-2 h-8 w-20 animate-pulse rounded bg-gray-200" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}
