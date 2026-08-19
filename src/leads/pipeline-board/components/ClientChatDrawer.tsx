'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChatPanel } from '@/whatsapp/components/ChatPanel';
import { useChatMessages } from '@/whatsapp/hooks/useChatMessages';
import { useWhatsAppSend } from '@/whatsapp/hooks/useWhatsAppSend';
import { useChatPolling } from '@/whatsapp/hooks/useChatPolling';
import type { ConversationStatus } from '../hooks/useConversationStatus';
import { TimelineTab } from './TimelineTab';
import type { Temperature } from '@/leads/types/lead';

interface ClientChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  client: { id: string; name: string; phone: string } | null;
  conversationStatus?: ConversationStatus | null;
}

const TEMPERATURE_CONFIG: Record<string, { icon: string; className: string }> = {
  hot: { icon: '🔥', className: 'bg-red-100 text-red-700 border-red-200' },
  warm: { icon: '🌡️', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  cold: { icon: '❄️', className: 'bg-blue-100 text-blue-700 border-blue-200' },
};

const STATE_LABELS: Record<string, string> = {
  idle: 'Inactivo',
  greeting: 'Saludo',
  need_type_asked: 'Tipo preguntado',
  need_type_captured: 'Tipo capturado',
  detail_asked: 'Detalle preguntaddo',
  detail_captured: 'Detalle capturado',
  customer_type_asked: 'Cliente preguntaddo',
  customer_type_captured: 'Cliente capturado',
  urgency_asked: 'Urgencia preguntada',
  urgency_captured: 'Urgencia capturada',
  location_asked: 'Ubicacion preguntada',
  location_captured: 'Ubicacion capturada',
  equipment_asked: 'Equipo preguntaddo',
  equipment_captured: 'Equipo capturado',
  evaluate: 'Evaluando',
  scored: 'Calificado',
  handoff_pending: 'Requiere humano',
  human_assigned: 'Humano asignado',
  closed: 'Cerrado',
  timeout: 'Timeout',
  fallback: 'Fallback',
  greeting_personalized: 'Saludo personalizado',
  service_selected: 'Servicio seleccionado',
  service_confirmed: 'Servicio confirmado',
  waiting_operator: 'Esperando operador',
  in_progress: 'En progreso',
  resolved: 'Resuelto',
};

type TabType = 'chat' | 'timeline' | 'info';

function ClientInfoTab({ client, conversationStatus }: { 
  client: { id: string; name: string; phone: string };
  conversationStatus?: ConversationStatus | null;
}) {
  const router = useRouter();
  const displayScore = conversationStatus?.score ?? 0;
  const displayTemperature = (conversationStatus?.temperature as Temperature) || 'cold';

  const handleTakeCase = useCallback(async () => {
    if (!conversationStatus?.conversationId) return;
    const token = localStorage.getItem('token');
    const tenantId = localStorage.getItem('tenantId');
    
    try {
      const res = await fetch(`/api/crm/conversations/${conversationStatus.conversationId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
        },
      });
      
      if (res.ok) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Error taking case:', error);
    }
  }, [conversationStatus?.conversationId]);

  const handleClose = useCallback(async () => {
    if (!conversationStatus?.conversationId) return;
    const token = localStorage.getItem('token');
    const tenantId = localStorage.getItem('tenantId');
    
    try {
      const res = await fetch(`/api/crm/conversations/${conversationStatus.conversationId}/close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
        },
      });
      
      if (res.ok) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Error closing conversation:', error);
    }
  }, [conversationStatus?.conversationId]);

  return (
    <div className="p-4 space-y-6 overflow-y-auto">
      {/* Client Info Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Datos del Cliente</h4>
        
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Nombre:</span>
            <span className="font-medium">{client.name}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-500">Teléfono:</span>
            <a href={`tel:${client.phone}`} className="font-medium text-brand-600 hover:underline">
              {client.phone}
            </a>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-500">ID:</span>
            <span className="font-mono text-xs">{client.id}</span>
          </div>
        </div>

        <button
          onClick={() => router.push(`/clients/${client.id}`)}
          className="mt-4 w-full px-4 py-2 text-sm font-medium bg-brand-50 text-brand-700 rounded-lg hover:bg-brand-100 transition-colors"
        >
          Ver detalle completo
        </button>
      </div>

      {/* Score Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Puntuación</h4>
        
        <div className="flex items-center gap-3 mb-4">
          {displayTemperature && TEMPERATURE_CONFIG[displayTemperature] && (
            <span className={`px-3 py-1.5 rounded-full text-sm font-bold border ${TEMPERATURE_CONFIG[displayTemperature].className}`}>
              {displayTemperature.toUpperCase()}
            </span>
          )}
          <span className="text-2xl font-bold text-gray-900">
            {displayScore} <span className="text-sm font-normal text-gray-500">pts</span>
          </span>
        </div>
      </div>

      {/* Conversation Summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Resumen de conversación</h4>
        <p className="text-sm text-gray-700">
          Estado: {STATE_LABELS[conversationStatus?.conversationState || ''] || conversationStatus?.conversationState || '-'}
        </p>
        
        {conversationStatus?.lastMessagePreview && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-1">Último mensaje:</p>
            <p className="text-sm text-gray-700 line-clamp-2">{conversationStatus.lastMessagePreview}</p>
          </div>
        )}
        
        {conversationStatus?.unreadCount !== undefined && conversationStatus.unreadCount > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
              🔔 {conversationStatus.unreadCount} mensaje(s) sin leer
            </span>
          </div>
        )}
      </div>

      {/* Bot Status */}
      {(conversationStatus?.isBotActive || conversationStatus?.isHandoffPending || conversationStatus?.isHumanAssigned) && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Estado del bot</h4>
          <div className="space-y-2 text-sm">
            {conversationStatus.isBotActive && (
              <div className="flex items-center gap-2 text-green-700">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                Bot activo
              </div>
            )}
            {conversationStatus.isHandoffPending && (
              <div className="flex items-center gap-2 text-orange-700">
                <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                Esperando operador humano
              </div>
            )}
            {conversationStatus.isHumanAssigned && (
              <div className="flex items-center gap-2 text-blue-700">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                En atención humana
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {conversationStatus?.isBotActive && !conversationStatus?.isHumanAssigned && (
          <button
            onClick={handleTakeCase}
            className="flex-1 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Tomar caso
          </button>
        )}
        {conversationStatus?.isHumanAssigned && (
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Cerrar caso
          </button>
        )}
        {!conversationStatus?.isBotActive && !conversationStatus?.isHumanAssigned && (
          <div className="text-sm text-gray-500 text-center w-full py-2">
            Conversación cerrada
          </div>
        )}
      </div>
    </div>
  );
}

export function ClientChatDrawer({ isOpen, onClose, client, conversationStatus }: ClientChatDrawerProps) {
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

  const phone = client?.phone || '';

  // Score del cliente desde conversationStatus o valor por defecto
  const displayScore = conversationStatus?.score ?? 0;
  const displayTemperature = (conversationStatus?.temperature as Temperature) || 'cold';

  const {
    messages,
    loading,
    error,
    hasMore,
    loadMore,
    refetch,
  } = useChatMessages(phone);

  const { sendMessage, sendMedia, downloadMedia, sending } = useWhatsAppSend();

  // Polling para nuevos mensajes
  useChatPolling({
    interval: 5000,
    enabled: isOpen,
    onPoll: refetch,
  });

  if (!isOpen || !client) return null;

  const handleSend = async (content: string) => {
    if (!phone) return;
    const result = await sendMessage({
      phone,
      content,
      leadId: client.id,
    });
    if (result) {
      refetch();
    }
  };

  const handleAttach = async (file: File) => {
    if (!phone) return;
    const result = await sendMedia({
      file,
      to: phone,
      leadId: client.id,
    });
    if (result) {
      refetch();
    }
  };

  const handleDownload = async (messageId: string, filename: string) => {
    if (!phone) return;
    await downloadMedia({
      messageId,
      filename,
      leadId: client.id,
    });
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      
      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white shrink-0 mt-16">
          <div className="flex items-start justify-between p-4 pb-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-semibold text-lg">
                {client.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-gray-900 truncate">{client.name}</h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {displayTemperature && TEMPERATURE_CONFIG[displayTemperature] && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${TEMPERATURE_CONFIG[displayTemperature].className}`}>
                      {TEMPERATURE_CONFIG[displayTemperature].icon} {displayScore} pts
                    </span>
                  )}
                  {conversationStatus?.isHandoffPending && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                      ⚠️ Sin atender
                    </span>
                  )}
                  {conversationStatus?.isHumanAssigned && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      👤 En atención
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => router.push(`/clients/${client.id}`)} 
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                title="Ver detalle del cliente"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </button>
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
            <button
              onClick={() => setActiveTab('info')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'info'
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Info
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
              leadId={client.id}
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
                leadId: client.id,
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
          ) : activeTab === 'info' ? (
            <ClientInfoTab client={client} conversationStatus={conversationStatus || null} />
          ) : null}
        </div>
      </div>
    </>
  );
}