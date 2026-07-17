'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';

interface MetricsCardProps {
  title: string;
  value: number;
  variant?: 'default' | 'warning' | 'danger' | 'success';
  icon?: string;
}

const variantStyles = {
  default: 'bg-white border-gray-200',
  warning: 'bg-yellow-50 border-yellow-200',
  danger: 'bg-red-50 border-red-200',
  success: 'bg-green-50 border-green-200',
};

const variantText = {
  default: 'text-gray-900',
  warning: 'text-yellow-800',
  danger: 'text-red-800',
  success: 'text-green-800',
};

export function MetricsCard({ title, value, variant = 'default', icon }: MetricsCardProps) {
  return (
    <div className={`p-4 rounded-xl border-2 ${variantStyles[variant]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
          <p className={`text-2xl font-bold mt-1 ${variantText[variant]}`}>{value}</p>
        </div>
        {icon && <span className="text-2xl">{icon}</span>}
      </div>
    </div>
  );
}

export function NextActionsPanel({ actions }: { actions: { label: string; count: number; variant: 'default' | 'warning' | 'danger' }[] }) {
  if (actions.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Próximas Acciones</h3>
        <p className="text-sm text-gray-500">Todo al día 🎉</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Próximas Acciones</h3>
      <div className="space-y-2">
        {actions.map((action, i) => (
          <div
            key={i}
            className={`flex items-center justify-between p-2 rounded-lg ${
              action.variant === 'danger' ? 'bg-red-50' : action.variant === 'warning' ? 'bg-yellow-50' : 'bg-gray-50'
            }`}
          >
            <span className="text-sm text-gray-700">{action.label}</span>
            <span className={`text-sm font-bold ${
              action.variant === 'danger' ? 'text-red-700' : action.variant === 'warning' ? 'text-yellow-700' : 'text-gray-700'
            }`}>{action.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TechnicianCard({
  name,
  availability,
  activeAssignments,
  todayAssignments,
  completedToday,
  utilization,
}: {
  name: string;
  availability: 'available' | 'busy' | 'unavailable';
  activeAssignments: number;
  todayAssignments: number;
  completedToday: number;
  utilization: number;
}) {
  const availabilityColors = {
    available: 'bg-green-100 text-green-700',
    busy: 'bg-yellow-100 text-yellow-700',
    unavailable: 'bg-red-100 text-red-700',
  };

  const availabilityLabels = {
    available: 'Disponible',
    busy: 'Ocupado',
    unavailable: 'No disponible',
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-gray-900">{name}</h4>
        <span className={`text-xs px-2 py-1 rounded-full ${availabilityColors[availability]}`}>
          {availabilityLabels[availability]}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-xs text-gray-500">Hoy</p>
          <p className="text-lg font-bold text-gray-900">{todayAssignments}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Activos</p>
          <p className="text-lg font-bold text-gray-900">{activeAssignments}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Completados</p>
          <p className="text-lg font-bold text-green-600">{completedToday}</p>
        </div>
      </div>
      <div className="mt-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Utilización</span>
          <span>{utilization}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${
              utilization > 80 ? 'bg-red-500' : utilization > 50 ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(utilization, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function OperativeDashboard() {
  const [metrics, setMetrics] = useState<any>(null);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [metricsData, techData] = await Promise.all([
        api.get<any>('/api/operations/dashboard'),
        api.get<any[]>('/api/operations/dashboard?view=technicians'),
      ]);
      setMetrics(metricsData);
      setTechnicians(techData);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-gray-200 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const nextActions = [];
  if (metrics?.nextActions?.unassigned > 0) {
    nextActions.push({ label: 'Sin técnico asignado', count: metrics.nextActions.unassigned, variant: 'danger' as const });
  }
  if (metrics?.nextActions?.unscheduled > 0) {
    nextActions.push({ label: 'Sin programar', count: metrics.nextActions.unscheduled, variant: 'warning' as const });
  }
  if (metrics?.nextActions?.pendingReport > 0) {
    nextActions.push({ label: 'Informes pendientes', count: metrics.nextActions.pendingReport, variant: 'danger' as const });
  }
  if (metrics?.summary?.overdue > 0) {
    nextActions.push({ label: 'Ordenes atrasadas', count: metrics.summary.overdue, variant: 'danger' as const });
  }

  return (
    <div className="space-y-6">
      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricsCard
          title="Total OTs"
          value={metrics?.summary?.totalWorkOrders || 0}
          icon="📋"
        />
        <MetricsCard
          title="En Ejecución"
          value={metrics?.summary?.inExecution || 0}
          variant={metrics?.summary?.inExecution > 0 ? 'success' : 'default'}
          icon="⚡"
        />
        <MetricsCard
          title="Urgentes"
          value={metrics?.summary?.urgent || 0}
          variant={metrics?.summary?.urgent > 0 ? 'danger' : 'default'}
          icon="🚨"
        />
        <MetricsCard
          title="Sin Técnico"
          value={metrics?.summary?.withoutTechnician || 0}
          variant={metrics?.summary?.withoutTechnician > 0 ? 'warning' : 'default'}
          icon="👤"
        />
      </div>

      {/* Next Actions */}
      <NextActionsPanel actions={nextActions} />

      {/* Today's Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <MetricsCard
          title="Comienzan Hoy"
          value={metrics?.todayStarts || 0}
          icon="📅"
        />
        <MetricsCard
          title="Pendientes de Informe"
          value={metrics?.summary?.pendingReport || 0}
          variant={metrics?.summary?.pendingReport > 0 ? 'warning' : 'default'}
          icon="📝"
        />
        <MetricsCard
          title="Técnicos Disponibles"
          value={metrics?.technicians?.available || 0}
          variant={metrics?.technicians?.available > 0 ? 'success' : 'default'}
          icon="✅"
        />
      </div>

      {/* Technicians */}
      {technicians.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Técnicos</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {technicians.map((tech) => (
              <TechnicianCard
                key={tech._id}
                name={tech.name}
                availability={tech.availability}
                activeAssignments={tech.activeAssignments}
                todayAssignments={tech.todayAssignments}
                completedToday={tech.completedToday}
                utilization={tech.utilization}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}