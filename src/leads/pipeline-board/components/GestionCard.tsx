import React, { useMemo } from 'react';
import type { IGestion, GestionStatus, InquiryReason, CustomerType, Temperature } from '@/gestion/types/gestion';
import type { ConversationStatus } from '../hooks/useConversationStatus';

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

const STATUS_LABELS: Record<string, string> = {
  new: 'Nueva',
  contacted: 'Contactada',
  quote_sent: 'Presupuesto enviado',
  technical_visit: 'Visita técnica',
  negotiation: 'Negociación',
  won: 'Ganada',
  lost: 'Perdida',
  disqualified: 'Descalificada',
};

const STATUS_VARIANTS: Record<string, string> = {
  new: 'bg-green-50 text-green-700',
  contacted: 'bg-green-100 text-green-700',
  quote_sent: 'bg-purple-50 text-purple-700',
  technical_visit: 'bg-orange-50 text-orange-700',
  negotiation: 'bg-yellow-50 text-yellow-700',
  won: 'bg-emerald-50 text-emerald-700',
  lost: 'bg-red-50 text-red-700',
  disqualified: 'bg-gray-100 text-gray-700',
};

const TEMPERATURE_CONFIG: Record<string, { label: string; icon: string; className: string }> = {
  hot: { label: 'Caliente', icon: '🔥', className: 'bg-red-100 text-red-700 border-red-200' },
  warm: { label: 'Tibio', icon: '🟡', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  cold: { label: 'Frío', icon: '❄️', className: 'bg-blue-100 text-blue-700 border-blue-200' },
};

const INQUIRY_LABELS: Record<string, string> = {
  repair: 'Reparación',
  installation: 'Instalación',
  maintenance: 'Mantenimiento',
  budget: 'Presupuesto',
  spare_parts: 'Repuestos',
  other: 'Otro',
};

interface GestionCardProps {
  gestion: IGestion;
  onClick?: (gestionId: string) => void;
  onWhatsAppClick?: (gestion: IGestion) => void;
  conversationStatus?: ConversationStatus | null;
  onTakeCase?: (gestion: IGestion) => void;
  onQuickReply?: (gestion: IGestion) => void;
  onOpenChat?: (gestion: IGestion) => void;
  onResolve?: (gestion: IGestion) => void;
}

export const GestionCard = React.memo(function GestionCard({
  gestion,
  onClick,
  onWhatsAppClick,
  conversationStatus,
  onTakeCase,
  onQuickReply,
  onOpenChat,
  onResolve,
}: GestionCardProps) {
  const displayName = gestion.companyName || gestion.name || 'Gestión';
  const displayName2 = gestion.name && gestion.name !== gestion.companyName ? gestion.name : undefined;

  const handleWhatsAppClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onWhatsAppClick?.(gestion);
  };

  return (
    <div
      onClick={() => onClick?.(String(gestion._id))}
      className={`bg-white rounded-lg border-2 border-l-4 border-l-green-500 p-2.5 md:p-2 cursor-pointer shadow-sm hover:shadow-md transition-shadow w-[280px] shrink-0 ${
        conversationStatus?.isHandoffPending
          ? 'border-red-300'
          : conversationStatus?.isBotActive
            ? 'border-gray-200 border-l-2 border-l-blue-400'
            : conversationStatus?.isHumanAssigned
              ? 'border-gray-200 border-l-2 border-l-amber-400'
              : 'border-gray-200'
      }`}
      role="button"
      tabIndex={0}
      aria-label={`Gestión: ${displayName}`}
    >
      <div>
        <div className="flex items-center gap-1 mb-1">
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-green-100 text-green-700 border border-green-200">
            🟢 Gestión
          </span>
        </div>
        <p className="text-xs md:text-[13px] font-semibold text-gray-900 leading-tight">
          {gestion.profileName || displayName}
        </p>
        {displayName2 && (
          <p className="text-[10px] md:text-[11px] text-gray-500 truncate mt-0.5">{displayName2}</p>
        )}
        <div className="flex items-center gap-1 mt-1">
          {(gestion.temperature) && TEMPERATURE_CONFIG[gestion.temperature] && (
            <span className={`inline-flex items-center px-1 py-px rounded text-[9px] font-medium border ${TEMPERATURE_CONFIG[gestion.temperature].className}`}>
              {TEMPERATURE_CONFIG[gestion.temperature].icon} {gestion.score || 0}
            </span>
          )}
          {!gestion.temperature && gestion.score && gestion.score > 0 && (
            <span className="inline-flex items-center px-1 py-px rounded text-[9px] font-medium bg-gray-100 text-gray-700 border border-gray-200">
              {gestion.score}
            </span>
          )}
          <span className={`inline-flex items-center px-1.5 py-px rounded text-[9px] font-medium ${STATUS_VARIANTS[gestion.status] || 'bg-gray-100 text-gray-700'}`}>
            {STATUS_LABELS[gestion.status] || gestion.status}
          </span>
        </div>
      </div>

      {gestion.phone && (
        <div className="flex items-center gap-2 mt-2">
          <a
            href={`tel:${gestion.phone}`}
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-brand-600 hover:underline"
          >
            {gestion.phone}
          </a>
          <button
            onClick={handleWhatsAppClick}
            className="inline-flex items-center justify-center w-5 h-5 rounded bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
            title="Abrir chat de WhatsApp"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
          </button>
        </div>
      )}

      <div className="mt-1.5 flex items-center justify-between text-[11px] md:text-[10px]">
        <span className="text-gray-400">
          {gestion.createdAt ? relativeTime(gestion.createdAt as unknown as Date) : '-'}
        </span>
        <span className="font-medium text-gray-700">
          {formatCurrency(gestion.estimatedValue)}
        </span>
      </div>

      {/* Conversation Status */}
      {conversationStatus && (
        <div className="mt-1.5 pt-1.5 border-t border-gray-100 space-y-0.5">
          {conversationStatus.isBotActive && (
            <div className="flex items-center gap-1.5 text-xs text-blue-600">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span>Bot activo</span>
            </div>
          )}

          {conversationStatus.isHandoffPending && (
            <div className="flex items-center gap-1.5 text-xs text-red-600 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span>Requiere humano</span>
            </div>
          )}

          {conversationStatus.isHumanAssigned && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>En atención</span>
            </div>
          )}

          {conversationStatus.lastMessagePreview && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="truncate max-w-[200px]">{conversationStatus.lastMessagePreview}</span>
              {conversationStatus.lastMessageAt && (
                <span className="shrink-0">{relativeTime(conversationStatus.lastMessageAt)}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Quick Actions */}
      {conversationStatus?.hasActiveConversation && (
        <div className="mt-1.5 flex gap-1">
          {conversationStatus?.isHandoffPending && (
            <button
              onClick={(e) => { e.stopPropagation(); onTakeCase?.(gestion); }}
              className="flex-1 px-2 py-0.5 text-[10px] font-medium bg-red-50 text-red-700 rounded hover:bg-red-100 transition-colors"
            >
              Tomar caso
            </button>
          )}
          {conversationStatus?.isBotActive && !conversationStatus?.isHandoffPending && (
            <button
              onClick={(e) => { e.stopPropagation(); onQuickReply?.(gestion); }}
              className="flex-1 px-2 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
            >
              Responder
            </button>
          )}
        </div>
      )}

      {/* Sin conversación */}
      {!conversationStatus && (
        <div className="mt-1.5 flex gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onOpenChat?.(gestion); }}
            className="flex-1 px-2 py-0.5 text-[10px] text-gray-600 rounded hover:bg-gray-100 transition-colors"
          >
            Ver
          </button>
        </div>
      )}

      {/* Placeholder fields */}
      {!conversationStatus && (
        <div className="mt-1.5 pt-1.5 border-t border-gray-100 space-y-0.5">
          {gestion.score !== undefined && gestion.score > 0 && (
            <div className="flex items-center gap-1.5 text-[10px] text-gray-600">
              <span className="w-1 h-1 rounded-full bg-gray-400" />
              <span>Score: {gestion.score} pts</span>
            </div>
          )}
          {gestion.inquiryReason && (
            <div className="flex items-center gap-1.5 text-[10px] text-gray-600">
              <span className="w-1 h-1 rounded-full bg-gray-400" />
              <span>{INQUIRY_LABELS[gestion.inquiryReason] || gestion.inquiryReason}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-[10px] text-gray-300">
            <span className="w-1 h-1 rounded-full bg-gray-200" />
            Sin actividad
          </div>
        </div>
      )}
    </div>
  );
});