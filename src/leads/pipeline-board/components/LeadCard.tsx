import React, { useMemo } from 'react';
import type { ILead, InquiryReason, CustomerType, Temperature } from '../../types/lead';
import type { ConversationStatus } from '../hooks/useConversationStatus';
import { calculateLeadScore } from '../../services/lead-score.service';

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
  new: 'Nuevo',
  contacted: 'Contactado',
  quote_sent: 'Presupuesto enviado',
  technical_visit: 'Visita técnica',
  negotiation: 'Negociación',
  qualified: 'Calificado',
  won: 'Ganado',
  lost: 'Perdido',
  disqualified: 'Descalificado',
};

const STATUS_VARIANTS: Record<string, string> = {
  new: 'bg-info-50 text-info-700',
  contacted: 'bg-brand-50 text-brand-700',
  quote_sent: 'bg-purple-50 text-purple-700',
  technical_visit: 'bg-orange-50 text-orange-700',
  negotiation: 'bg-yellow-50 text-yellow-700',
  qualified: 'bg-warning-50 text-warning-700',
  won: 'bg-success-50 text-success-700',
  lost: 'bg-danger-50 text-danger-700',
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
  other: 'Otro',
};

interface LeadCardProps {
  lead: ILead;
  onClick?: (leadId: string) => void;
  onWhatsAppClick?: (lead: ILead) => void;
  conversationStatus?: ConversationStatus | null;
  onTakeCase?: (lead: ILead) => void;
  onQuickReply?: (lead: ILead) => void;
  onOpenChat?: (lead: ILead) => void;
}

export const LeadCard = React.memo(function LeadCard({
  lead,
  onClick,
  onWhatsAppClick,
  conversationStatus,
  onTakeCase,
  onQuickReply,
  onOpenChat,
}: LeadCardProps) {
  // Calcular score si no está guardado
  const calculatedScore = useMemo(() => {
    if (!lead) return null;
    if (lead.score && lead.score > 0) return { score: lead.score, temperature: lead.temperature as Temperature };
    
    const notesService = lead.notes?.match(/Servicio: (.*?)( \| |$)/)?.[1];
    const notesPriority = lead.notes?.match(/Necesidad: (.*?)( \| |$)/)?.[1];
    
    if (lead.inquiryReason || lead.priority || notesService || notesPriority) {
      const inquiryReasonMap: Record<string, InquiryReason> = {
        'reparación': 'repair', 'repair': 'repair',
        'instalación': 'installation', 'installation': 'installation',
        'mantenimiento': 'maintenance', 'maintenance': 'maintenance',
        'presupuesto': 'budget', 'budget': 'budget',
      };
      const reason = lead.inquiryReason || (notesService ? inquiryReasonMap[notesService.toLowerCase()] : undefined);
      const priority = lead.priority || (notesPriority?.toLowerCase().includes('urgente') ? 'high' : notesPriority?.toLowerCase().includes('semana') ? 'medium' : 'low');
      
      if (reason || priority) {
        return calculateLeadScore({
          inquiryReason: reason,
          priority: priority as 'high' | 'medium' | 'low',
          customerType: lead.customerType as CustomerType || 'residential',
          isB2B: lead.isB2B,
        });
      }
    }
    return null;
  }, [lead]);

  const handleWhatsAppClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onWhatsAppClick?.(lead);
  };

  return (
    <div
      onClick={() => onClick?.(String(lead._id))}
      className={`bg-white rounded-lg border p-2.5 md:p-2 cursor-pointer shadow-sm hover:shadow-md transition-shadow w-[280px] shrink-0 ${
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
      aria-label={`Lead: ${lead.name}`}
    >
      <div>
        <p className="text-xs md:text-[13px] font-semibold text-gray-900 leading-tight">
          {lead.profileName || lead.companyName || lead.name}
        </p>
        {lead.profileName && lead.name && lead.name !== lead.profileName && (
          <p className="text-[10px] md:text-[11px] text-gray-500 truncate mt-0.5">{lead.name}</p>
        )}
        <div className="flex items-center gap-1 mt-1">
          {(calculatedScore?.temperature || lead.temperature) && TEMPERATURE_CONFIG[calculatedScore?.temperature || lead.temperature] && (
            <span className={`inline-flex items-center px-1 py-px rounded text-[9px] font-medium border ${TEMPERATURE_CONFIG[calculatedScore?.temperature || lead.temperature].className}`}>
              {TEMPERATURE_CONFIG[calculatedScore?.temperature || lead.temperature].icon} {calculatedScore?.score || lead.score || 0}
            </span>
          )}
          {!calculatedScore?.temperature && !lead.temperature && (calculatedScore?.score || lead.score) && (calculatedScore?.score || lead.score) > 0 && (
            <span className="inline-flex items-center px-1 py-px rounded text-[9px] font-medium bg-gray-100 text-gray-700 border border-gray-200">
              {calculatedScore?.score || lead.score}
            </span>
          )}
          <span className={`inline-flex items-center px-1.5 py-px rounded text-[9px] font-medium ${STATUS_VARIANTS[lead.status] || 'bg-gray-100 text-gray-700'}`}>
            {STATUS_LABELS[lead.status] || lead.status}
          </span>
          {lead.convertedToClient && (
            <span className="inline-flex items-center px-1.5 py-px rounded text-[9px] font-medium bg-success-100 text-success-700 border border-success-200">
              Convertido
            </span>
          )}
        </div>
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
          <button
            onClick={handleWhatsAppClick}
            className="inline-flex items-center justify-center w-5 h-5 rounded bg-success-50 text-success-700 hover:bg-success-100 transition-colors"
            title="Abrir chat de WhatsApp"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
          </button>
        </div>
      )}

      <div className="mt-1.5 flex items-center gap-2 text-[11px] md:text-[10px] text-gray-500">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
        <span className="truncate">
          {lead.assignedTo
            ? typeof lead.assignedTo === 'object' && 'name' in lead.assignedTo
              ? (lead.assignedTo as { name: string }).name
              : String(lead.assignedTo)
            : 'Sin asignar'}
        </span>
      </div>

      <div className="mt-1.5 flex items-center justify-between text-[11px] md:text-[10px]">
        <span className="text-gray-400">
          {lead.createdAt ? relativeTime(lead.createdAt as unknown as Date) : '-'}
        </span>
        <span className="font-medium text-gray-700">
          {formatCurrency(lead.estimatedValue)}
        </span>
      </div>

      {/* Conversation Status */}
      {conversationStatus && (
        <div className="mt-1.5 pt-1.5 border-t border-gray-100 space-y-0.5">
          {conversationStatus.isBotActive && (
            <div className="flex items-center gap-1.5 text-[10px] md:text-[10px] text-blue-600">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span>Bot activo</span>
            </div>
          )}

          {conversationStatus.isHandoffPending && (
            <div className="flex items-center gap-1.5 text-[10px] md:text-[10px] text-red-600 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span>Requiere humano</span>
            </div>
          )}

          {conversationStatus.isHumanAssigned && (
            <div className="flex items-center gap-1.5 text-[10px] md:text-[10px] text-amber-600">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>En atención</span>
            </div>
          )}

          {/* New message indicator - when lead wrote within last 2 min (even if last msg is from bot) */}
          {conversationStatus.lastMessageAt && conversationStatus.lastMessageDirection === 'inbound' && (
            (() => {
              const lastMsgTime = new Date(conversationStatus.lastMessageAt).getTime();
              const twoMinAgo = Date.now() - (2 * 60 * 1000);
              const hasRecentInbound = lastMsgTime > twoMinAgo;
              
              return hasRecentInbound ? (
                <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-blue-200 bg-blue-50 rounded">
                  <span className="w-3 h-3 rounded-full bg-blue-600 animate-pulse" />
                  <span className="text-sm font-bold text-blue-700">Nueva actividad!</span>
                </div>
              ) : null;
            })()
          )}

          {/* Waiting for client response - BOT sent message +15min no reply (not operator) */}
          {conversationStatus.lastMessageDirection === 'outbound' && conversationStatus.lastMessageAt && conversationStatus.isBotActive && (
            (() => {
              const lastMsgTime = new Date(conversationStatus.lastMessageAt).getTime();
              const fifteenMinAgo = Date.now() - (15 * 60 * 1000);
              const waitingForReply = lastMsgTime < fifteenMinAgo;
              
              return waitingForReply ? (
                <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-amber-200 bg-amber-50 rounded">
                  <span className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-sm font-bold text-amber-700">Sin respuesta</span>
                </div>
              ) : null;
            })()
          )}

          {conversationStatus.lastMessagePreview && (
            <div className="flex items-center gap-1.5 text-[10px] md:text-[10px] text-gray-400">
              <span className="truncate max-w-[200px]">{conversationStatus.lastMessagePreview}</span>
              {conversationStatus.lastMessageAt && (
                <span className="shrink-0">{relativeTime(conversationStatus.lastMessageAt)}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Quick Actions */}
      {conversationStatus?.isHandoffPending && (
        <div className="mt-1.5 flex gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onTakeCase?.(lead); }}
            className="flex-1 px-2 py-0.5 text-[10px] font-medium bg-red-50 text-red-700 rounded hover:bg-red-100 transition-colors"
          >
            Tomar caso
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onOpenChat?.(lead); }}
            className="px-2 py-0.5 text-[10px] text-gray-600 rounded hover:bg-gray-100 transition-colors"
          >
            Ver
          </button>
        </div>
      )}

      {conversationStatus?.isBotActive && !conversationStatus?.isHandoffPending && (
        <div className="mt-1.5 flex gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onQuickReply?.(lead); }}
            className="flex-1 px-2 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
          >
            Responder
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onOpenChat?.(lead); }}
            className="px-2 py-0.5 text-[10px] text-gray-600 rounded hover:bg-gray-100 transition-colors"
          >
            Ver
          </button>
        </div>
      )}

      {/* Placeholder fields (when no conversation) */}
      {!conversationStatus && (
        <div className="mt-1.5 pt-1.5 border-t border-gray-100 space-y-0.5">
          {lead.score !== undefined && lead.score > 0 && (
            <div className="flex items-center gap-1.5 text-[10px] text-gray-600">
              <span className="w-1 h-1 rounded-full bg-gray-400" />
              <span>Score: {lead.score} pts</span>
            </div>
          )}
          {lead.inquiryReason && (
            <div className="flex items-center gap-1.5 text-[10px] text-gray-600">
              <span className="w-1 h-1 rounded-full bg-gray-400" />
              <span>{INQUIRY_LABELS[lead.inquiryReason] || lead.inquiryReason}</span>
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
