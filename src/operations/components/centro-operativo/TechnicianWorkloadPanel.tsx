'use client';

import { Users } from 'lucide-react';
import type { TechnicianWorkload } from '@/operations/types/centro-operativo';
import { getUtilizationLevel, TECHNICIAN_UTILIZATION_COLOR } from '@/operations/constants/status-colors';

interface TechnicianWorkloadPanelProps {
  technicians: TechnicianWorkload[];
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function UtilizationBar({ utilization }: { utilization: number }) {
  const level = getUtilizationLevel(utilization);
  const barColor = TECHNICIAN_UTILIZATION_COLOR[level];
  const cap = Math.min(utilization, 100);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-medium text-gray-500 dark:text-slate-400">Utilización</span>
        <span className={`text-[10px] font-bold tabular-nums ${
          level === 'low' ? 'text-green-700 dark:text-green-400' : level === 'medium' ? 'text-yellow-700 dark:text-yellow-400' : 'text-red-700 dark:text-red-400'
        }`}>
          {utilization}%
        </span>
      </div>
      <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${cap}%` }}
        />
      </div>
    </div>
  );
}

function StatItem({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="text-center">
      <p className={`text-lg font-bold tabular-nums ${color || 'text-gray-900 dark:text-slate-100'}`}>{value}</p>
      <p className="text-[10px] text-gray-500 dark:text-slate-400 leading-tight">{label}</p>
    </div>
  );
}

function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function computeTenure(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  let years = now.getFullYear() - d.getFullYear();
  let months = now.getMonth() - d.getMonth();
  if (months < 0) { years--; months += 12; }
  if (years < 1) return `${months} meses`;
  return `${years} ${years === 1 ? 'año' : 'años'}${months > 0 ? ` ${months} meses` : ''}`;
}

function TechnicianCard({ tech }: { tech: TechnicianWorkload }) {
  const level = getUtilizationLevel(tech.utilization);
  const avatarColor =
    level === 'low' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
    : level === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300'
    : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300';

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 min-w-[220px] sm:min-w-0 hover:shadow-sm dark:hover:shadow-slate-900/50 transition-shadow">
      <div className="flex items-center gap-3 mb-3">
        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${avatarColor}`}>
          {getInitials(tech.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">{tech.name}</p>
          <p className="text-[10px] text-gray-400 dark:text-slate-500 capitalize">{tech.status || tech.availability}</p>
        </div>
      </div>

      {/* Extra info: hire date + specialties */}
      <div className="mb-3 space-y-1.5">
        {tech.hireDate && (
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-gray-400 dark:text-slate-500">Ingreso</span>
            <span className="text-gray-700 dark:text-slate-300 font-medium tabular-nums">
              {formatDate(tech.hireDate)} · {computeTenure(tech.hireDate)}
            </span>
          </div>
        )}
        {tech.specialties && tech.specialties.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {tech.specialties.map((s, i) => (
              <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-medium">
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="text-center flex-1">
          <p className="text-[10px] text-gray-500 dark:text-slate-400 leading-tight mb-1">Activas</p>
          <div className="flex items-center justify-center gap-1.5">
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold tabular-nums">
              OT {tech.activeAssignments}
            </span>
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-xs font-bold tabular-nums">
              VT {tech.activeVisits}
            </span>
          </div>
        </div>
        <StatItem label="Hoy" value={tech.todayAssignments} color="text-indigo-700 dark:text-indigo-400" />
        <StatItem label="Completadas" value={tech.completedToday} color="text-green-700 dark:text-green-400" />
      </div>

      <UtilizationBar utilization={tech.utilization} />
    </div>
  );
}

export function TechnicianWorkloadPanel({ technicians }: TechnicianWorkloadPanelProps) {
  if (!technicians.length) {
    return (
      <div className="text-center py-12 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl">
        <Users className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-900 dark:text-slate-100">No hay técnicos disponibles</p>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">No se encontraron técnicos en este momento</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
        Carga de Trabajo — Técnicos ({technicians.length})
      </h2>

      <div className="flex gap-3 overflow-x-auto pb-2 sm:pb-0 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:overflow-x-visible">
        {technicians.map((tech) => (
          <TechnicianCard key={tech._id} tech={tech} />
        ))}
      </div>
    </div>
  );
}
