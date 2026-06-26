import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ILead } from '../../types/lead';

function relativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `hace ${days} días`;
  const months = Math.floor(days / 30);
  return `hace ${months} meses`;
}

function formatCurrency(value?: number): string {
  if (value == null) return '-';
  return `$${value.toLocaleString('es-AR')}`;
}

const STATUS_VARIANTS: Record<string, string> = {
  new: 'badge-info',
  contacted: 'badge-warning',
  qualified: 'badge-success',
  won: 'badge-success',
  lost: 'badge-danger',
  disqualified: 'badge-neutral',
};

interface LeadCardProps {
  lead: ILead;
  onClick?: (leadId: string) => void;
}

export const LeadCard = React.memo(function LeadCard({ lead, onClick }: LeadCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: String(lead._id) });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick?.(String(lead._id))}
      className="bg-white rounded-lg border border-gray-200 p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow w-[280px] shrink-0"
      role="button"
      tabIndex={0}
      aria-label={`Lead: ${lead.name}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 truncate">{lead.name}</p>
          {lead.companyName && (
            <p className="text-xs text-gray-500 truncate mt-0.5">{lead.companyName}</p>
          )}
        </div>
        <span className={`badge ${STATUS_VARIANTS[lead.status] || 'badge-neutral'} shrink-0`}>
          {lead.status}
        </span>
      </div>

      {lead.phone && (
        <a
          href={`tel:${lead.phone}`}
          onClick={(e) => e.stopPropagation()}
          className="text-xs text-brand-600 hover:underline mt-2 block"
        >
          {lead.phone}
        </a>
      )}

      <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
        <span className="truncate">
          {lead.assignedTo
            ? typeof lead.assignedTo === 'object' && 'name' in lead.assignedTo
              ? (lead.assignedTo as { name: string }).name
              : String(lead.assignedTo)
            : 'Sin asignar'}
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-gray-400">
          {lead.createdAt ? relativeTime(lead.createdAt as unknown as Date) : '-'}
        </span>
        <span className="font-medium text-gray-700">
          {formatCurrency(lead.estimatedValue)}
        </span>
      </div>

      {/* Placeholder fields */}
      <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-gray-300">
          <span className="w-1 h-1 rounded-full bg-gray-200" />
          Prioridad —
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-300">
          <span className="w-1 h-1 rounded-full bg-gray-200" />
          Sin actividad
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-300">
          <span className="w-1 h-1 rounded-full bg-gray-200" />
          —
        </div>
      </div>
    </div>
  );
});
