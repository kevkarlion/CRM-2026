'use client';

import type { ChatLead } from '../types/chat';

interface LeadDataPanelProps {
  lead: ChatLead | null;
  loading?: boolean;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatCurrency(value?: number): string {
  if (value == null) return '-';
  return `$${value.toLocaleString('es-AR')}`;
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Nuevo',
  contacted: 'Contactado',
  quote_sent: 'Presupuesto enviado',
  technical_visit: 'Visita técnica',
  negotiation: 'Negociación',
  won: 'Ganado',
  lost: 'Perdido',
  disqualified: 'Descalificado',
};

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-info-50 text-info-700',
  contacted: 'bg-brand-50 text-brand-700',
  quote_sent: 'bg-warning-50 text-warning-700',
  technical_visit: 'bg-warning-50 text-warning-700',
  negotiation: 'bg-brand-50 text-brand-700',
  won: 'bg-success-50 text-success-700',
  lost: 'bg-danger-50 text-danger-700',
  disqualified: 'bg-gray-100 text-gray-700',
};

const TEMP_COLORS: Record<string, string> = {
  hot: 'bg-danger-50 text-danger-700',
  warm: 'bg-warning-50 text-warning-700',
  cold: 'bg-info-50 text-info-700',
};

export function LeadDataPanel({ lead, loading }: LeadDataPanelProps) {
  if (loading) {
    return (
      <div className="p-4 space-y-4 border-l border-gray-200 bg-white">
        <div className="h-6 w-32 bg-gray-100 rounded animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex flex-col items-center justify-center h-full border-l border-gray-200 bg-white px-4">
        <svg
          className="w-10 h-10 text-gray-300 mb-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
        <p className="text-sm font-medium text-gray-900">Sin datos del lead</p>
        <p className="text-xs text-gray-500 mt-1">
          Esta conversación no está vinculada a un lead
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full border-l border-gray-200 bg-white overflow-y-auto">
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900 truncate">{lead.name}</h3>
        {lead.companyName && (
          <p className="text-xs text-gray-500 mt-0.5">{lead.companyName}</p>
        )}
      </div>

      <div className="p-4 space-y-4">
        <div>
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">
            Estado
          </p>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              STATUS_COLORS[lead.status] || 'bg-gray-100 text-gray-700'
            }`}
          >
            {STATUS_LABELS[lead.status] || lead.status}
          </span>
        </div>

        {lead.temperature && (
          <div>
            <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">
              Temperatura
            </p>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                TEMP_COLORS[lead.temperature] || 'bg-gray-100 text-gray-700'
              }`}
            >
              {lead.temperature}
            </span>
          </div>
        )}

        {lead.phone && (
          <div>
            <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">
              Teléfono
            </p>
            <a href={`tel:${lead.phone}`} className="text-sm text-brand-600 hover:underline">
              {lead.phone}
            </a>
          </div>
        )}

        {lead.email && (
          <div>
            <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">
              Email
            </p>
            <p className="text-sm text-gray-700">{lead.email}</p>
          </div>
        )}

        <div>
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">
            Valor estimado
          </p>
          <p className="text-sm font-medium text-gray-900">
            {formatCurrency(lead.estimatedValue)}
          </p>
        </div>

        <div>
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">
            Asignado a
          </p>
          <p className="text-sm text-gray-700">
            {lead.assignedTo
              ? typeof lead.assignedTo === 'object'
                ? lead.assignedTo.name
                : String(lead.assignedTo)
              : 'Sin asignar'}
          </p>
        </div>

        <div>
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">
            Creado
          </p>
          <p className="text-sm text-gray-700">{formatDate(lead.createdAt)}</p>
        </div>
      </div>
    </div>
  );
}
