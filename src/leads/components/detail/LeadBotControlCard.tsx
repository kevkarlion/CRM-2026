'use client';

import type { ConversationDetail } from './lead-detail.types';

interface LeadBotControlCardProps {
  conversation: ConversationDetail | null;
  loading: boolean;
  actionLoading: boolean;
  onTakeControl: () => void;
  onMarkResolved: () => void;
}

/** Bot ↔ operator handoff control card (always visible). */
export function LeadBotControlCard({
  conversation,
  loading,
  actionLoading,
  onTakeControl,
  onMarkResolved,
}: LeadBotControlCardProps) {
  if (loading && !conversation) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="mb-2 h-4 w-28 rounded bg-gray-200 animate-pulse" />
        <div className="h-3 w-40 rounded bg-gray-100 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-900">Control del Bot</h3>
        {conversation ? (
          <span
            className={`px-2 py-1 text-xs font-medium rounded-full ${
              conversation.owner === 'BOT' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
            }`}
          >
            {conversation.owner === 'BOT' ? '🤖 Bot activo' : '👤 Operador'}
          </span>
        ) : (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-500">
            Sin conversación
          </span>
        )}
      </div>

      {conversation ? (
        <>
          <div className="text-sm text-gray-600 space-y-1">
            <p>
              Estado: <span className="font-medium">{conversation.lifecycleState}</span>
            </p>
            {conversation.waitingMessageCount > 0 && (
              <p>
                Mensajes sin atender:{' '}
                <span className="font-medium">{conversation.waitingMessageCount}</span>
              </p>
            )}
            {conversation.resolvedAt && (
              <p>
                Resuelto:{' '}
                <span className="font-medium">
                  {new Date(conversation.resolvedAt).toLocaleString()}
                </span>
              </p>
            )}
          </div>

          <div className="space-y-2 pt-2">
            <button
              onClick={onTakeControl}
              disabled={actionLoading || conversation.owner === 'OPERATOR'}
              className={`w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                conversation.owner === 'OPERATOR'
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-800 text-white hover:bg-gray-900'
              }`}
            >
              {actionLoading ? 'Tomando...' : '👤 Tomar control'}
            </button>

            <button
              onClick={onMarkResolved}
              disabled={actionLoading || conversation.lifecycleState === 'RESOLVED'}
              className={`w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                conversation.lifecycleState === 'RESOLVED'
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-success-500 text-white hover:bg-success-600'
              }`}
            >
              {actionLoading ? 'Marcando...' : '✅ Marcar como resuelto'}
            </button>

            {conversation.lifecycleState === 'RESOLVED' && (
              <div className="p-3 bg-green-50 rounded-lg text-center">
                <p className="text-sm text-success-700">
                  ✅ Conversación resuelta
                  {conversation.resolvedAt && (
                    <span className="block text-xs mt-1">
                      (hace{' '}
                      {Math.round(
                        (Date.now() - new Date(conversation.resolvedAt).getTime()) /
                          (1000 * 60 * 60),
                      )}{' '}
                      horas)
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="text-sm text-gray-500 text-center py-4">
          <p>No hay conversación activa con este lead.</p>
          <p className="text-xs mt-1">El lead no ha escrito por WhatsApp.</p>
        </div>
      )}
    </div>
  );
}
