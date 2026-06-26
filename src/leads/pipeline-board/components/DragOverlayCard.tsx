import React from 'react';
import type { ILead } from '../../types/lead';

function formatCurrency(value?: number): string {
  if (value == null) return '-';
  return `$${value.toLocaleString('es-AR')}`;
}

interface DragOverlayCardProps {
  lead: ILead;
}

export function DragOverlayCard({ lead }: DragOverlayCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-300 p-3 w-[280px] shadow-xl rotate-2 opacity-80">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 truncate">{lead.name}</p>
          {lead.companyName && (
            <p className="text-xs text-gray-500 truncate mt-0.5">{lead.companyName}</p>
          )}
        </div>
        <span className="badge badge-neutral shrink-0">{lead.status}</span>
      </div>

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
        <span className="text-gray-400">-</span>
        <span className="font-medium text-gray-700">
          {formatCurrency(lead.estimatedValue)}
        </span>
      </div>
    </div>
  );
}
