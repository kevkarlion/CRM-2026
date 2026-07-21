'use client';

import type { DashboardSummary } from '@/operations/types/centro-operativo';

interface MetricsCardsProps {
  summary: DashboardSummary;
  byPriority: Record<string, number>;
  technicianCount?: number;
}

interface MetricCardConfig {
  key: string;
  label: string;
  getValue: (summary: DashboardSummary, byPriority: Record<string, number>, technicianCount?: number) => number;
  color: string;
  bgColor: string;
}

const CARDS: MetricCardConfig[] = [
  {
    key: 'withoutTechnician',
    label: 'OTs sin asignar',
    getValue: (s) => s.withoutTechnician,
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
  },
  {
    key: 'overdue',
    label: 'OTs atrasadas',
    getValue: (s) => s.overdue,
    color: 'text-red-700',
    bgColor: 'bg-red-50',
  },
  {
    key: 'todayStarts',
    label: 'OTs de hoy',
    getValue: (s, _bp, _tc) => s.pending + s.inExecution,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
  },
  {
    key: 'urgent',
    label: 'OTs urgentes',
    getValue: (s) => s.urgent,
    color: 'text-red-800',
    bgColor: 'bg-red-100',
  },
  {
    key: 'technicians',
    label: 'Téc. disponibles',
    getValue: (_s, _bp, tc) => tc ?? 0,
    color: 'text-green-700',
    bgColor: 'bg-green-50',
  },
  {
    key: 'inExecution',
    label: 'OTs en ejecución',
    getValue: (s) => s.inExecution,
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
  },
];

function MetricIcon({ cardKey }: { cardKey: string }) {
  const icons: Record<string, React.ReactNode> = {
    withoutTechnician: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
      </svg>
    ),
    overdue: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
    todayStarts: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
      </svg>
    ),
    urgent: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      </svg>
    ),
    technicians: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
      </svg>
    ),
    inExecution: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
      </svg>
    ),
  };

  return icons[cardKey] || null;
}

function StatusDot({ cardKey }: { cardKey: string }) {
  const dotColors: Record<string, string> = {
    withoutTechnician: 'bg-orange-500',
    overdue: 'bg-red-500',
    todayStarts: 'bg-blue-500',
    urgent: 'bg-red-600',
    technicians: 'bg-green-500',
    inExecution: 'bg-purple-500',
  };

  return <span className={`w-2 h-2 rounded-full ${dotColors[cardKey] || 'bg-gray-400'}`} />;
}

export function MetricsCards({ summary, byPriority, technicianCount }: MetricsCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {CARDS.map((card) => {
        const value = card.getValue(summary, byPriority, technicianCount);

        return (
          <div
            key={card.key}
            className={`rounded-xl border border-gray-200 p-4 ${card.bgColor} transition-shadow hover:shadow-sm`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-lg ${card.bgColor} ${card.color}`}>
                <MetricIcon cardKey={card.key} />
              </div>
              <StatusDot cardKey={card.key} />
            </div>
            <p className={`text-2xl font-bold ${card.color} tabular-nums`}>{value}</p>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">{card.label}</p>
          </div>
        );
      })}
    </div>
  );
}
