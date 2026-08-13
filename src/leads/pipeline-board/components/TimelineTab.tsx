'use client';

import { useMemo } from 'react';
import type { ConversationStatus } from '../hooks/useConversationStatus';

interface TimelineTabProps {
  messages: Array<{
    content: string;
    direction: string;
    createdAt: string;
    type?: string;
  }>;
  conversationStatus: ConversationStatus;
}

const STATE_LABELS: Record<string, string> = {
  greeting: 'Saludo',
  need_type_asked: 'Tipo de necesidad',
  need_type_captured: 'Tipo de necesidad registrado',
  detail_asked: 'Detalles solicitados',
  detail_captured: 'Detalles registrados',
  customer_type_asked: 'Tipo de cliente',
  customer_type_captured: 'Tipo de cliente registrado',
  summary_confirmed: 'Resumen confirmado',
  schedule_visit: 'Programar visita',
  visit_scheduled: 'Visita programada',
  sending_quote: 'Enviando presupuesto',
  quote_sent: 'Presupuesto enviado',
  waiting_response: 'Esperando respuesta',
  IN_PROGRESS: 'En progreso',
  ACTIVE_LEAD: 'Lead activo',
  ACTIVE_CLIENT: 'Cliente activo',
  WAITING_CLIENT: 'Esperando cliente',
  WAITING_OPERATOR: 'Esperando operador',
  human_assigned: 'Humano asignado',
  handoff_pending: 'Transferencia pendiente',
  fallback: 'Fallback',
};

export function TimelineTab({ messages, conversationStatus }: TimelineTabProps) {
  const events = useMemo(() => {
    const timeline: Array<{
      type: 'message_received' | 'bot_response' | 'state_change';
      content: string;
      timestamp: string;
      direction: string;
    }> = [];

    for (const msg of messages) {
      timeline.push({
        type: msg.direction === 'inbound' ? 'message_received' : 'bot_response',
        content: msg.content,
        timestamp: msg.createdAt,
        direction: msg.direction,
      });
    }

    if (conversationStatus.conversationState) {
      timeline.push({
        type: 'state_change',
        content: `Estado: ${STATE_LABELS[conversationStatus.conversationState] || conversationStatus.conversationState}`,
        timestamp: new Date().toISOString(),
        direction: 'system',
      });
    }

    return timeline.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [messages, conversationStatus.conversationState]);

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12">
        <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm font-medium text-gray-900">Sin eventos</p>
        <p className="text-xs text-gray-500 mt-1">No hay actividad registrada aún</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3 overflow-y-auto h-[calc(100vh-280px)]">
      {events.map((event, i) => (
        <div key={i} className="flex items-start gap-3 text-sm">
          <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
            event.type === 'message_received' ? 'bg-gray-400' :
            event.type === 'bot_response' ? 'bg-blue-500' :
            'bg-amber-500'
          }`} />
          <div className="min-w-0 flex-1">
            <p className={`text-gray-700 ${event.type === 'bot_response' ? 'text-blue-700' : ''}`}>
              {event.type === 'bot_response' && <span className="text-xs font-medium mr-1">BOT</span>}
              {event.content}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date(event.timestamp).toLocaleString('es-AR')}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}