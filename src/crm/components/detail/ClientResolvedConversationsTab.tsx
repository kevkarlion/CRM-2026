'use client';

import { useState, useEffect } from 'react';

interface ResolvedConversation {
  _id: string;
  phoneNumber: string;
  lifecycleState: string;
  resolvedAt: string;
  createdAt: string;
  lastMessageAt: string;
  waitingEvents?: Array<{
    event: string;
    timestamp: string;
    priority?: string;
  }>;
}

interface ClientResolvedConversationsTabProps {
  clientId: string;
}

export function ClientResolvedConversationsTab({ clientId }: ClientResolvedConversationsTabProps) {
  const [conversations, setConversations] = useState<ResolvedConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadConversations() {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const tenantId = localStorage.getItem('tenantId');
        
        const res = await fetch(`/api/crm/clients/${clientId}/conversations`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-tenant-id': tenantId || '',
          },
        });
        
        if (!res.ok) {
          throw new Error('Error al cargar conversaciones');
        }
        
        const json = await res.json();
        setConversations(json.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    }
    
    loadConversations();
  }, [clientId]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded-lg">
        {error}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.189 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <p>No hay conversaciones resueltas</p>
        <p className="text-sm text-gray-400 mt-1">Las conversaciones resueltas aparecerán aquí</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500 mb-4">
        {conversations.length} conversación{conversations.length !== 1 ? 'es' : ''} resuelta{conversations.length !== 1 ? 's' : ''}
      </p>
      
      {conversations.map((conv) => (
        <div
          key={conv._id}
          className="p-4 bg-white border border-gray-200 rounded-lg"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">
                Conversación de WhatsApp
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Teléfono: {conv.phoneNumber}
              </p>
            </div>
            <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded">
              Resuelta
            </span>
          </div>
          
          <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-4 text-xs text-gray-500">
            <div>
              <p className="font-medium">Creada</p>
              <p>{new Date(conv.createdAt).toLocaleString('es-AR')}</p>
            </div>
            <div>
              <p className="font-medium">Resuelta</p>
              <p>{conv.resolvedAt ? new Date(conv.resolvedAt).toLocaleString('es-AR') : '—'}</p>
            </div>
          </div>
          
          {conv.waitingEvents && conv.waitingEvents.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 mb-2">Actividad</p>
              <div className="space-y-1">
                {conv.waitingEvents.slice(-3).map((event, idx) => (
                  <p key={idx} className="text-xs text-gray-400">
                    • {event.event} — {new Date(event.timestamp).toLocaleString('es-AR')}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
