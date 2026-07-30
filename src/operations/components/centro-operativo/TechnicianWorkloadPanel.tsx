'use client';

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
        <span className="text-[10px] font-medium text-gray-500">Utilización</span>
        <span className={`text-[10px] font-bold tabular-nums ${
          level === 'low' ? 'text-green-700' : level === 'medium' ? 'text-yellow-700' : 'text-red-700'
        }`}>
          {utilization}%
        </span>
      </div>
      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
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
      <p className={`text-lg font-bold tabular-nums ${color || 'text-gray-900'}`}>{value}</p>
      <p className="text-[10px] text-gray-500 leading-tight">{label}</p>
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
    level === 'low' ? 'bg-green-100 text-green-700'
    : level === 'medium' ? 'bg-yellow-100 text-yellow-700'
    : 'bg-red-100 text-red-700';

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 min-w-[220px] sm:min-w-0 hover:shadow-sm transition-shadow">
      <div className="flex items-center gap-3 mb-3">
        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${avatarColor}`}>
          {getInitials(tech.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 truncate">{tech.name}</p>
          <p className="text-[10px] text-gray-400 capitalize">{tech.status || tech.availability}</p>
        </div>
      </div>

      {/* Extra info: hire date + specialties */}
      <div className="mb-3 space-y-1.5">
        {tech.hireDate && (
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-gray-400">Ingreso</span>
            <span className="text-gray-700 font-medium tabular-nums">
              {formatDate(tech.hireDate)} · {computeTenure(tech.hireDate)}
            </span>
          </div>
        )}
        {tech.specialties && tech.specialties.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {tech.specialties.map((s, i) => (
              <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-medium">
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="text-center flex-1">
          <p className="text-[10px] text-gray-500 leading-tight mb-1">Activas</p>
          <div className="flex items-center justify-center gap-1.5">
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-bold tabular-nums">
              OT {tech.activeAssignments}
            </span>
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 text-xs font-bold tabular-nums">
              VT {tech.activeVisits}
            </span>
          </div>
        </div>
        <StatItem label="Hoy" value={tech.todayAssignments} color="text-indigo-700" />
        <StatItem label="Completadas" value={tech.completedToday} color="text-green-700" />
      </div>

      <UtilizationBar utilization={tech.utilization} />
    </div>
  );
}

export function TechnicianWorkloadPanel({ technicians }: TechnicianWorkloadPanelProps) {
  if (!technicians.length) {
    return (
      <div className="text-center py-12 bg-white border border-gray-200 rounded-xl">
        <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
        </svg>
        <p className="text-sm font-medium text-gray-900">No hay técnicos disponibles</p>
        <p className="text-xs text-gray-500 mt-1">No se encontraron técnicos en este momento</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-900">
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
