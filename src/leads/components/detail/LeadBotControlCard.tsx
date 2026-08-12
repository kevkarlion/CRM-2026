'use client';

import { useState } from 'react';
import type { ConversationDetail } from './lead-detail.types';

interface LeadBotControlCardProps {
  conversation: ConversationDetail | null;
  loading: boolean;
  actionLoading?: boolean;
  onTakeControl?: () => void;
  onCedeControl?: () => void;
}

/** Bot ↔ operator control card */
export function LeadBotControlCard({
  conversation,
  loading,
  actionLoading: externalLoading,
  onTakeControl,
  onCedeControl,
}: LeadBotControlCardProps) {
  const [localLoading, setLocalLoading] = useState(false);
  const [localOwner, setLocalOwner] = useState<string | null>(null);
  
  // Usar estado local si existe, sino usar conversation
  const isOperatorControl = localOwner === 'OPERATOR' || 
    (localOwner === null && conversation?.owner === 'OPERATOR' && conversation?.lifecycleState === 'IN_PROGRESS');
  
  const isLoading = externalLoading || localLoading;

  // Función interna para ceder control
  const handleCedeToBot = async () => {
    if (!conversation?._id) return;
    
    setLocalLoading(true);
    
    try {
      const tenantId = localStorage.getItem('tenantId');
      const token = localStorage.getItem('token');
      
      const res = await fetch(`/api/crm/conversations/${conversation._id}/cede-control`, {
        method: 'POST',
        headers: {
          'x-tenant-id': tenantId || '',
          'Authorization': `Bearer ${token || ''}`,
        },
      });
      
      if (res.ok) {
        // Actualizar estado local sin recargar página
        setLocalOwner('BOT');
        // También llamar al callback del padre si existe
        onCedeControl?.();
      }
    } catch (err) {
      console.error('[LeadBotControlCard] Error:', err);
    } finally {
      setLocalLoading(false);
    }
  };

  const handleClick = () => {
    if (isOperatorControl) {
      handleCedeToBot();
    } else if (onTakeControl) {
      onTakeControl();
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse">
        <div className="h-4 w-16 bg-gray-200 rounded" />
      </div>
    );
  }

  if (!conversation) {
    return null;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      {/* Estado actual */}
      <div className={`flex items-center justify-center gap-2 p-3 rounded-lg mb-3 ${
        isOperatorControl 
          ? 'bg-green-50 border border-green-200' 
          : 'bg-blue-50 border border-blue-200'
      }`}>
        <span className="text-xl">
          {isOperatorControl ? '👤' : '🤖'}
        </span>
        <span className={`font-semibold ${
          isOperatorControl ? 'text-green-700' : 'text-blue-700'
        }`}>
          {isOperatorControl ? 'Operador' : 'Bot'}
        </span>
      </div>

      {/* Botón toggle */}
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all cursor-pointer ${
          isOperatorControl
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : 'bg-green-600 hover:bg-green-700 text-white'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Procesando...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            {isOperatorControl ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Ceder al Bot
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Tomar Control
              </>
            )}
          </span>
        )}
      </button>
    </div>
  );
}