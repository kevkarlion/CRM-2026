'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { AuditLogEntry } from './audit-log-types';
import { ACTION_LABELS, ACTION_BADGE_VARIANT, ENTITY_TYPE_LABELS, getOrigin } from './audit-log-types';

interface AuditLogTableProps {
  entries: AuditLogEntry[];
  loading: boolean;
}

const FIELD_LABELS: Record<string, string> = {
  fullName: 'Nombre completo',
  name: 'Nombre',
  profileName: 'Perfil',
  status: 'Estado',
  phone: 'Teléfono',
  email: 'Email',
  companyName: 'Empresa',
  address: 'Dirección',
  locality: 'Localidad',
  province: 'Provincia',
  source: 'Fuente',
  notes: 'Notas',
  customerType: 'Tipo de cliente',
  entityType: 'Entidad',
  entityId: 'ID de entidad',
  action: 'Acción',
  timestamp: 'Fecha',
  actorId: 'Usuario',
  tenantId: 'Tenant',
  number: 'N°',
  version: 'Versión',
  newVersion: 'Nueva versión',
  title: 'Título',
  total: 'Total',
  amount: 'Monto',
  saleMode: 'Modo de venta',
  quotesCount: 'Cant. presupuestos',
  documentId: 'Doc ID',
  documentTitle: 'Documento',
  validUntil: 'Válido hasta',
  sentAt: 'Enviado el',
  sentBy: 'Enviado por',
  approvedAt: 'Aprobado el',
  approvedBy: 'Aprobado por',
  rejectedAt: 'Rechazado el',
  wonAt: 'Ganado el',
  convertedAt: 'Convertido el',
  saleType: 'Tipo de venta',
  workOrderNumber: 'N° OT',
  workOrderTitle: 'OT',
  clientName: 'Cliente',
  leadName: 'Lead',
  technicianName: 'Técnico',
  category: 'Categoría',
  priority: 'Prioridad',
  reason: 'Motivo',
  inquiryReason: 'Motivo de consulta',
  from: 'Estado anterior',
  to: 'Estado nuevo',
  clientCreated: 'Lead convertido a cliente',
  clientId: 'Cliente',
  leadId: 'Lead ID',
  gestionId: 'Gestión ID',
  fromStatus: 'Estado anterior',
  toStatus: 'Estado nuevo',
  previousStatus: 'Estado previo',
  newStatus: 'Estado nuevo',
  fieldsChanged: 'Campos modificados',
  deletedBy: 'Eliminado por',
  blockedBy: 'Bloqueado por',
  versioned: 'Versionado',
};

/**
 * Known enum values rendered in Spanish. Anything not listed falls back to the
 * raw value (ids, numbers, free text) — safe to extend without side effects.
 */
const VALUE_LABELS: Record<string, string> = {
  // Estados de leads / gestiones / quotes / OTs
  contacted: 'Contactado',
  qualified: 'Calificado',
  converted: 'Convertido',
  disqualified: 'Descartado',
  resolved: 'Resuelto',
  won: 'Ganado',
  lost: 'Perdido',
  closed: 'Cerrado',
  active: 'Activo',
  activeGestion: 'Gestión activa',
  pending: 'Pendiente',
  draft: 'Borrador',
  sent: 'Enviado',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  // Modos / tipos de venta
  direct: 'Venta directa',
  product: 'Producto',
  service: 'Servicio',
  // Motivos de consulta (inquiryReason)
  repair: 'Reparación',
  installation: 'Instalación',
  quote: 'Presupuesto',
  maintenance: 'Mantenimiento',
  emergency: 'Emergencia',
  // Tipos de cliente
  residential: 'Residencial',
  enterprise: 'Empresa',
  business: 'Comercio',
  // Prioridades
  normal: 'Normal',
  high: 'Alta',
  low: 'Baja',
  urgent: 'Urgente',
  // Fuentes
  whatsapp: 'WhatsApp',
  manual: 'Manual',
  web: 'Web',
  referral: 'Referido',
};

function formatFieldLabel(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'string' && isDateLike(value)) {
    return formatDateTime(value);
  }
  if (typeof value === 'string' && VALUE_LABELS[value]) {
    return VALUE_LABELS[value];
  }
  return String(value);
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** True for ISO timestamps or plain ISO dates — values that should render as friendly local dates. */
function isDateLike(value: string): boolean {
  if (ISO_DATE_PATTERN.test(value) || DATE_ONLY_PATTERN.test(value)) {
    const d = new Date(value);
    return !Number.isNaN(d.getTime());
  }
  return false;
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.toLocaleDateString('es-CL', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  })} ${d.toLocaleTimeString('es-CL', {
    hour: '2-digit', minute: '2-digit',
  })}`;
}

function entityLabel(entityType: string): string {
  return ENTITY_TYPE_LABELS[entityType.toLowerCase()] || entityType;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-CL', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('es-CL', {
    hour: '2-digit', minute: '2-digit',
  });
}

const METADATA_HIDDEN_KEYS = new Set(['eventType', 'leadId', 'clientId', 'entityId', 'id', 'timestamp', 'source']);

function OriginBadge({ channel }: { channel: string | null }) {
  if (!channel) return null;
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-gray-100 text-gray-600">
      {channel}
    </span>
  );
}

function BotBadge() {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-purple-50 text-purple-700">
      🤖 Bot
    </span>
  );
}

function ActorName({ entry }: { entry: AuditLogEntry }) {
  if (entry.actorName || entry.actorEmail) return entry.actorName || entry.actorEmail;
  if (getOrigin(entry).isBot) return <BotBadge />;
  return '—';
}

function ChangesDiffView({ entry }: { entry: AuditLogEntry }) {
  const before = entry.changes?.before || {};
  const after = entry.changes?.after || {};
  const allKeys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));

  const metadataPairs = entry.metadata
    ? Object.entries(entry.metadata).filter(([key, value]) => {
        if (METADATA_HIDDEN_KEYS.has(key)) return false;
        if (value === null || value === undefined || value === '') return false;
        return true;
      })
    : [];

  return (
    <div className="px-3 py-2 space-y-1">
      {metadataPairs.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-2 pt-1">
            Contexto
          </div>
          {metadataPairs.map(([key, value]) => (
            <div key={key} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 py-1 px-2 rounded">
              <span className="sm:w-36 text-xs font-semibold text-gray-600 shrink-0">
                {formatFieldLabel(key)}
              </span>
              <span className="font-mono text-xs text-gray-700 break-all">
                {formatValue(value)}
              </span>
            </div>
          ))}
        </div>
      )}

      {allKeys.length > 0 && (
        <div>
          {metadataPairs.length > 0 && (
            <div className="flex items-center gap-2 px-2 pt-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Cambios</span>
              <span className="flex-1 h-px bg-gray-200" />
            </div>
          )}
          {allKeys.map((key) => {
            const bVal = before[key];
            const aVal = after[key];
            const changed = formatValue(bVal) !== formatValue(aVal);
            return (
              <div
                key={key}
                className={`flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 py-1 px-2 rounded ${changed ? 'bg-amber-50/60' : ''}`}
              >
                <span className="sm:w-36 text-xs font-semibold text-gray-600 shrink-0">
                  {formatFieldLabel(key)}
                </span>
                <span className={`font-mono text-xs ${changed ? 'text-danger-700 line-through' : 'text-gray-500'}`}>
                  {formatValue(bVal)}
                </span>
                <span className="hidden sm:inline text-gray-400 text-xs">&rarr;</span>
                <span className={`font-mono text-xs ${changed ? 'text-success-700 font-medium' : 'text-gray-500'}`}>
                  {formatValue(aVal)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {metadataPairs.length === 0 && allKeys.length === 0 && (
        <div className="text-xs text-gray-500 italic">
          Sin detalles de cambios disponibles
        </div>
      )}
    </div>
  );
}

function MobileCard({ entry, isExpanded, onToggle }: { entry: AuditLogEntry; isExpanded: boolean; onToggle: () => void }) {
  const badgeClass = ACTION_BADGE_VARIANT[entry.action] || 'bg-gray-100 text-gray-700';

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left flex items-start justify-between gap-2"
      >
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            {formatDate(entry.timestamp)} &middot; {formatTime(entry.timestamp)}
          </p>
          <p className="text-sm font-medium text-gray-900 mt-1 truncate">
            <ActorName entry={entry} />
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${badgeClass}`}>
            {ACTION_LABELS[entry.action] || entry.action}
          </span>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gray-50 rounded-lg px-3 py-2 min-w-0">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Entidad</span>
          <span className="block text-sm font-medium text-gray-900 truncate">
            {entityLabel(entry.entityType)}
          </span>
          <OriginBadge channel={getOrigin(entry).channel} />
        </div>
        <div className="bg-gray-50 rounded-lg px-3 py-2 min-w-0">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">ID</span>
          <span className="block text-xs font-mono text-gray-500 truncate">{entry.entityId}</span>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-gray-100 pt-3">
          <ChangesDiffView entry={entry} />
        </div>
      )}
    </div>
  );
}

export function AuditLogTable({ entries, loading }: AuditLogTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  function toggleRow(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  if (loading) return null;

  if (entries.length === 0) {
    return (
      <div className="text-center py-16">
        <svg className="mx-auto w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 className="text-sm font-medium text-gray-900 mb-1">Sin registros</h3>
        <p className="text-sm text-gray-500">No hay registros de auditoría que coincidan con tu búsqueda</p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden sm:block bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/80">
              <th className="w-14 px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
              <th className="min-w-[100px] px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Usuario</th>
              <th className="min-w-[80px] px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Entidad</th>
              <th className="w-20 px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Acción</th>
              <th className="w-20 px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => {
              const isExpanded = expandedRows.has(entry._id);
              const badgeClass = ACTION_BADGE_VARIANT[entry.action] || 'bg-gray-100 text-gray-700';
              const origin = getOrigin(entry);
              return [
                <tr
                  key={entry._id}
                  className={`border-b border-gray-100 cursor-pointer transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-brand-50/40`}
                  onClick={() => toggleRow(entry._id)}
                >
                  <td className="px-2 py-1.5 text-gray-500 whitespace-nowrap align-middle">
                    <span>{formatDate(entry.timestamp)}</span>
                    <span className="block text-gray-400">{formatTime(entry.timestamp)}</span>
                  </td>
                  <td className="px-2 py-1.5 font-medium text-gray-900 align-middle">
                    <ActorName entry={entry} />
                  </td>
                  <td className="px-2 py-1.5 text-gray-600 align-middle">
                    <div>{entityLabel(entry.entityType)}</div>
                    <OriginBadge channel={origin.channel} />
                  </td>
                  <td className="px-2 py-1.5 align-middle">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-medium ${badgeClass}`}>
                      {ACTION_LABELS[entry.action] || entry.action}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 align-middle">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                  </td>
                </tr>,
                isExpanded && (
                  <tr key={`${entry._id}-detail`}>
                    <td colSpan={5} className="bg-gray-50/30 border-b border-gray-100">
                      <ChangesDiffView entry={entry} />
                    </td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {entries.map((entry) => (
          <MobileCard
            key={entry._id}
            entry={entry}
            isExpanded={expandedRows.has(entry._id)}
            onToggle={() => toggleRow(entry._id)}
          />
        ))}
      </div>
    </>
  );
}
