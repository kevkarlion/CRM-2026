'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChatPanel } from '@/whatsapp/components/ChatPanel';
import { useChatMessages } from '@/whatsapp/hooks/useChatMessages';
import { useWhatsAppSend } from '@/whatsapp/hooks/useWhatsAppSend';
import { useChatPolling } from '@/whatsapp/hooks/useChatPolling';
import { TimelineTab } from './TimelineTab';
import type { ILead } from '../../types/lead';
import type { ConversationStatus } from '../hooks/useConversationStatus';
import { calculateLeadScore } from '../../services/lead-score.service';
import type { InquiryReason, CustomerType, Temperature } from '../../types/lead';

interface LeadChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  lead?: ILead | null;
  client?: { id: string; name: string; phone: string } | null;
  conversationStatus?: ConversationStatus | null;
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

const TEMPERATURE_COLORS = {
  hot: 'bg-red-100 text-red-700 border-red-200',
  warm: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  cold: 'bg-blue-100 text-blue-700 border-blue-200',
};

const INQUIRY_REASON_LABELS: Record<string, string> = {
  repair: 'Reparacion',
  installation: 'Instalacion',
  maintenance: 'Mantenimiento',
  budget: 'Presupuesto',
  other: 'Otro',
};

const CUSTOMER_TYPE_LABELS: Record<string, string> = {
  residential: 'Residencial',
  commercial: 'Comercial/Empresa',
};

const STATE_LABELS: Record<string, string> = {
  idle: 'Inactivo',
  greeting: 'Saludo',
  need_type_asked: 'Tipo preguntado',
  need_type_captured: 'Tipo capturado',
  detail_asked: 'Detalle preguntado',
  detail_captured: 'Detalle capturado',
  customer_type_asked: 'Cliente preguntado',
  customer_type_captured: 'Cliente capturado',
  urgency_asked: 'Urgencia preguntada',
  urgency_captured: 'Urgencia capturada',
  location_asked: 'Ubicacion preguntada',
  location_captured: 'Ubicacion capturada',
  equipment_asked: 'Equipo preguntado',
  equipment_captured: 'Equipo capturado',
  evaluate: 'Evaluando',
  scored: 'Calificado',
  handoff_pending: 'Requiere humano',
  human_assigned: 'Humano asignado',
  closed: 'Cerrado',
  timeout: 'Timeout',
  fallback: 'Fallback',
};

type TabType = 'chat' | 'timeline';

function LeadInfoTab({ lead }: { lead: ILead }) {
  const assignedTo = lead.assignedTo 
    ? (typeof lead.assignedTo === 'object' && 'name' in lead.assignedTo 
        ? (lead.assignedTo as { name: string }).name 
        : String(lead.assignedTo))
    : 'Sin asignar';

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="p-4 space-y-6 overflow-y-auto">
      {/* Score Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Clasificacion del Lead</h4>
        
        <div className="flex items-center gap-3 mb-4">
          {(calculatedScore?.temperature || lead.temperature) && (
            <span className={`px-3 py-1.5 rounded-full text-sm font-bold border ${TEMPERATURE_COLORS[calculatedScore?.temperature || lead.temperature]}`}>
              {(calculatedScore?.temperature || lead.temperature).toUpperCase()}
            </span>
          )}
          {(calculatedScore?.score || lead.score) && (
            <span className="text-2xl font-bold text-gray-900">
              {calculatedScore?.score || lead.score} <span className="text-sm font-normal text-gray-500">pts</span>
            </span>
          )}
        </div>

        {lead.scoringBreakdown && (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Tipo de consulta:</span>
              <span className="font-medium">{lead.scoringBreakdown.buttons} pts</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Tipo de propiedad:</span>
              <span className="font-medium">{lead.scoringBreakdown.property} pts</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Palabras clave:</span>
              <span className="font-medium">{lead.scoringBreakdown.keywords} pts</span>
            </div>
            {lead.scoringBreakdown.b2b > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">B2B:</span>
                <span className="font-medium">{lead.scoringBreakdown.b2b} pts</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Datos del Lead</h4>
        
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Estado:</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_VARIANTS[lead.status] || 'bg-gray-100 text-gray-700'}`}>
              {STATUS_LABELS[lead.status] || lead.status}
            </span>
          </div>
          
          {lead.inquiryReason && (
            <div className="flex justify-between">
              <span className="text-gray-500">Necesita:</span>
              <span className="font-medium">{INQUIRY_REASON_LABELS[lead.inquiryReason] || lead.inquiryReason}</span>
            </div>
          )}
          
          {lead.customerType && (
            <div className="flex justify-between">
              <span className="text-gray-500">Tipo:</span>
              <span className="font-medium">{CUSTOMER_TYPE_LABELS[lead.customerType] || lead.customerType}</span>
            </div>
          )}
          
          <div className="flex justify-between">
            <span className="text-gray-500">Origen:</span>
            <span className="font-medium capitalize">{lead.source}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-500">Asignado a:</span>
            <span className="font-medium">{assignedTo}</span>
          </div>
          
          {lead.estimatedValue && (
            <div className="flex justify-between">
              <span className="text-gray-500">Valor estimado:</span>
              <span className="font-medium">${lead.estimatedValue.toLocaleString('es-AR')}</span>
            </div>
          )}

          <div className="flex justify-between">
            <span className="text-gray-500">Creado:</span>
            <span className="font-medium">{formatDate(lead.createdAt)}</span>
          </div>
          
          {lead.isB2B && (
            <div className="flex justify-between">
              <span className="text-gray-500">B2B:</span>
              <span className="font-medium text-green-600">Si</span>
            </div>
          )}
        </div>
      </div>

      {/* Notes Section */}
      {lead.notes && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Notas</h4>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{lead.notes}</p>
        </div>
      )}
    </div>
  );
}

interface HandoffTabProps {
  conversationId: string;
  lead: ILead;
  conversationStatus: ConversationStatus;
  onTakeCase: () => void;
}

function HandoffTab({ conversationId, lead, conversationStatus, onTakeCase }: HandoffTabProps) {
  const handleReassign = useCallback(async () => {
    // Placeholder — TODO: open reassign modal
  }, []);

  const handleClose = useCallback(async () => {
    // Placeholder — TODO: close handoff
  }, []);

  return (
    <div className="p-4 space-y-4 overflow-y-auto">
      {/* Handoff Info */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Requiere humano</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Estado:</span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
              {conversationStatus.isHandoffPending ? 'Pendiente' : conversationStatus.isHumanAssigned ? 'Asignado' : conversationStatus.conversationState || '-'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Motivo:</span>
            <span className="font-medium">{conversationStatus.handoffReason || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Score:</span>
            <span className="font-medium">{lead.score || 0} pts</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Temperatura:</span>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              lead.temperature === 'hot' ? 'bg-red-100 text-red-700' :
              lead.temperature === 'warm' ? 'bg-yellow-100 text-yellow-700' :
              'bg-blue-100 text-blue-700'
            }`}>
              {lead.temperature?.toUpperCase() || '-'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Conversation ID:</span>
            <span className="font-mono text-xs text-gray-400">{conversationId.slice(0, 12)}...</span>
          </div>
        </div>
      </div>
      
      {/* Conversation Summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Resumen automatico</h4>
        <p className="text-sm text-gray-700">
          Estado: {STATE_LABELS[conversationStatus.conversationState || ''] || conversationStatus.conversationState || '-'}
        </p>
      </div>
      
      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onTakeCase}
          className="flex-1 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Tomar caso
        </button>
        <button
          onClick={handleReassign}
          className="px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Reasignar
        </button>
        <button
          onClick={handleClose}
          className="px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}

export function LeadChatDrawer({ isOpen, onClose, lead, client, conversationStatus }: LeadChatDrawerProps) {
  // Support both lead and client modes
  const isLeadMode = !!lead;
  const entity = lead || client;
  
  const [activeTab, setActiveTab] = useState<TabType>('chat');
  const router = useRouter();

  // Mark conversation as read when drawer opens
  useEffect(() => {
    if (isOpen && conversationStatus?.conversationId) {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null;
      fetch(`/api/crm/conversations/${conversationStatus.conversationId}/read`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
        },
      }).catch(() => {
        // Silent fail - not critical
      });
    }
  }, [isOpen, conversationStatus?.conversationId]);

  const phone = isLeadMode ? (lead?.phone || '') : (client?.phone || '');
  
  // Calcular score si no está guardado
  const calculatedScore = useMemo(() => {
    if (!lead) return null;
    // Si ya tiene score guardado y es > 0, usarlo
    if (lead.score && lead.score > 0) return { score: lead.score, temperature: lead.temperature as Temperature };
    
    // Si tiene inquiryReason o priority, calcular el score
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
        const result = calculateLeadScore({
          inquiryReason: reason,
          priority: priority as 'high' | 'medium' | 'low',
          customerType: lead.customerType as CustomerType || 'residential',
          isB2B: lead.isB2B,
        });
        return result;
      }
    }
    return null;
  }, [lead]);
  
  const {
    messages,
    loading,
    error,
    hasMore,
    loadMore,
    refetch,
  } = useChatMessages(phone);

  const { sendMessage, sendMedia, downloadMedia, sending } = useWhatsAppSend();

  const handleSend = async (content: string) => {
    if (!phone) return;
    const entityId = isLeadMode 
      ? (lead?._id ? String(lead._id) : undefined)
      : (client?.id || undefined);
    const result = await sendMessage({
      phone,
      content,
      leadId: entityId,
    });
    if (result) {
      refetch();
    }
  };

  const handleAttach = async (file: File) => {
    if (!phone) return;
    const entityId = isLeadMode 
      ? (lead?._id ? String(lead._id) : undefined)
      : (client?.id || undefined);
    const result = await sendMedia({
      file,
      to: phone,
      leadId: entityId,
    });
    if (result) {
      // Delay refetch to ensure DB write completes
      setTimeout(() => refetch(), 300);
    }
  };

  const handleDownload = async (messageId: string, filename: string): Promise<string | void> => {
    if (!phone) return;
    const entityId = isLeadMode 
      ? (lead?._id ? String(lead._id) : undefined)
      : (client?.id || undefined);
    const result = await downloadMedia({
      messageId,
      filename,
      leadId: entityId,
    });
    // NOTA: NO hacemos refetch() aquí. Para el audio, AudioMessage ya recibe
    // la cloudinaryUrl via el retorno y la muestra al instante (setSrc). El
    // refetch inmediato re-montaba cada AudioMessage y cancelaba la descarga
    // en vuelo (cleanup pone cancelled=true), dejando las "3 pelotitas"
    // colgadas hasta salir/entrar. El polling de 5s ya refresca la lista.
    return result.cloudinaryUrl;
  };

  const handleTakeControl = useCallback(async () => {
    if (!conversationStatus?.conversationId || !lead) return;
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null;
      let userId = '';
      try {
        if (token) userId = JSON.parse(atob(token.split('.')[1])).userId;
      } catch { /* noop */ }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (tenantId) headers['x-tenant-id'] = tenantId;
      if (userId) headers['x-user-id'] = userId;

      await fetch(`/api/crm/conversations/${conversationStatus.conversationId}/assign`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ userId }),
      });
      // Polling will refresh data
    } catch {
      // Silent — polling retries
    }
  }, [conversationStatus, lead]);

  const handleCedeControl = useCallback(async () => {
    if (!conversationStatus?.conversationId) return;
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null;

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (tenantId) headers['x-tenant-id'] = tenantId;

      await fetch(`/api/crm/conversations/${conversationStatus.conversationId}/cede-control`, {
        method: 'POST',
        headers,
      });
      // Polling will refresh data
    } catch {
      // Silent — polling retries
    }
  }, [conversationStatus]);

  const handleTakeCase = useCallback(async () => {
    await handleTakeControl();
  }, [handleTakeControl]);

  useChatPolling({
    interval: 5000,
    enabled: isOpen,
    onPoll: refetch,
  });

  if (!isOpen || (!lead && !client)) return null;

  const displayName = isLeadMode 
    ? (lead!.profileName || lead!.companyName || lead!.name)
    : client?.name || 'Cliente';
  const entityName = typeof displayName === 'string' ? displayName : (isLeadMode ? 'Lead sin nombre' : 'Cliente sin nombre');
  const hasConversation = !!conversationStatus?.hasActiveConversation;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      
      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header - Entity Info */}
        <div className="border-b border-gray-200 bg-white shrink-0 mt-16">
          <div className="flex items-start justify-between p-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-white font-semibold text-lg">
                {entityName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-gray-900 truncate">{entityName}</h3>
                {isLeadMode && lead!.profileName && lead!.name && lead!.name !== lead!.profileName && (
                  <p className="text-sm text-gray-500 truncate">{lead!.name}</p>
                )}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {isLeadMode && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_VARIANTS[lead!.status] || 'bg-gray-100 text-gray-700'}`}>
                      {STATUS_LABELS[lead!.status] || lead!.status}
                    </span>
                  )}
                  {isLeadMode && lead!.temperature && (
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${TEMPERATURE_COLORS[calculatedScore?.temperature || lead!.temperature]}`}>
                      {calculatedScore?.temperature === 'hot' ? '🔥' : calculatedScore?.temperature === 'warm' ? '🟡' : calculatedScore?.temperature === 'cold' ? '❄️' : lead.temperature === 'hot' ? '🔥' : lead.temperature === 'warm' ? '🟡' : '❄️'} {(calculatedScore?.temperature || lead.temperature)?.toUpperCase() || 'COLD'}
                    </span>
                  )}
                  {isLeadMode && (calculatedScore?.score || lead!.score) && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                      {calculatedScore?.score || lead!.score} pts
                    </span>
                  )}
                </div>
                {/* Segunda línea: servicio, necesidad y msgs - solo para leads */}
                {/* Parse notes para fallback si no hay inquiryReason/priority */}
                {isLeadMode && (() => {
                  const notesService = lead.notes?.match(/Servicio: (.*?)( \| |$)/)?.[1];
                  const notesPriority = lead.notes?.match(/Necesidad: (.*?)( \| |$)/)?.[1];
                  const hasInquiryReason = lead.inquiryReason || notesService;
                  const hasPriority = lead.priority || notesPriority;
                  return (
                    <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-gray-500">
                      {hasInquiryReason && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {INQUIRY_REASON_LABELS[lead.inquiryReason as keyof typeof INQUIRY_REASON_LABELS] || notesService || lead.inquiryReason}
                        </span>
                      )}
                      {hasPriority && (
                        <span className={`flex items-center gap-1 ${(lead.priority || notesPriority?.toLowerCase()) === 'high' || notesPriority?.toLowerCase().includes('urgente') ? 'text-red-600 font-medium' : ''}`}>
                          {(lead.priority || notesPriority?.toLowerCase()) === 'high' || notesPriority?.toLowerCase().includes('urgente') ? '🚨' : (lead.priority || notesPriority?.toLowerCase()) === 'medium' || notesPriority?.toLowerCase().includes('semana') ? '⏳' : '✅'}
                          {lead.priority === 'high' || notesPriority?.toLowerCase().includes('urgente') ? 'Urgente' : lead.priority === 'medium' || notesPriority?.toLowerCase().includes('semana') ? 'Esta semana' : lead.priority === 'low' ? 'No urgente' : notesPriority || lead.priority}
                        </span>
                      )}
                      {messages.length > 0 && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          {messages.length} msgs
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {isLeadMode && lead._id && (
                <button
                  onClick={() => router.push(`/leads/${String(lead._id)}`)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-brand-600 transition-colors"
                  title="Ver detalle del lead"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </button>
              )}
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-4 pb-0 flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'chat'
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => setActiveTab('timeline')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'timeline'
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Actividad
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden bg-gray-50">
          {activeTab === 'chat' ? (
            <ChatPanel
              messages={messages}
              loading={loading}
              error={error}
              hasMore={hasMore}
              onLoadMore={loadMore}
              onSend={handleSend}
              onAttach={handleAttach}
              onDownload={handleDownload}
              sending={sending}
              selectedPhone={phone}
              leadId={lead?._id ? String(lead._id) : undefined}
            />
          ) : activeTab === 'handoff' && conversationStatus && isLeadMode ? (
            <HandoffTab
              conversationId={conversationStatus.conversationId}
              lead={lead}
              conversationStatus={conversationStatus}
              onTakeCase={handleTakeCase}
            />
          ) : activeTab === 'timeline' ? (
            <TimelineTab
              messages={messages.map((m) => ({
                content: m.content,
                direction: m.direction,
                createdAt: m.createdAt,
                type: m.type,
              }))}
              conversationStatus={conversationStatus || {
                conversationId: '',
                leadId: isLeadMode ? String(lead._id) : (client?.id || ''),
                hasActiveConversation: false,
                conversationState: null,
                isBotActive: false,
                isHandoffPending: false,
                isHumanAssigned: false,
                lastMessageAt: null,
                lastMessagePreview: null,
                unreadCount: 0,
              }}
            />
          ) : isLeadMode ? (
            <LeadInfoTab lead={lead} />
          ) : (
            <div className="p-4 text-center text-gray-500">
              <p>Información del cliente no disponible en esta vista</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
