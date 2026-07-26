import React from 'react';
import { useDraggable } from '@dnd-kit/core';
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
    isDragging,
  } = useDraggable({ id: String(lead._id) });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
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
        <div className="flex items-center gap-2 mt-2">
          <a
            href={`tel:${lead.phone}`}
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-brand-600 hover:underline"
          >
            {lead.phone}
          </a>
          <a
            href={`/whatsapp?phone=${encodeURIComponent(lead.phone)}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center justify-center w-5 h-5 rounded bg-success-50 text-success-700 hover:bg-success-100 transition-colors"
            title="Abrir en WhatsApp"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
          </a>
        </div>
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
