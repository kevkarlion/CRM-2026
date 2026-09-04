'use client';

import { useState } from 'react';

const QUICK_MESSAGES = [
  {
    id: 'payment-info',
    label: 'Datos para pagos',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
    color: 'bg-indigo-600 hover:bg-indigo-700',
    message: `BBVA (cta cte ROLOCLIMATIZACION SRL)
CUIT: 30-71725452-6
ALIAS: ROLOCLIMA.SRL
CBU: 0170292920000001169171

Alias MP: roloclimatizacionsrl
CVU: 0000003100091139840009`,
  },
  {
    id: 'close-chat',
    label: 'Cierre charla',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    color: 'bg-emerald-600 hover:bg-emerald-700',
    message: 'Gracias por elegirnos, esperamos poder ayudarte nuevamente',
  },
  {
    id: 'ot-data',
    label: 'Datos para OT',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    color: 'bg-orange-500 hover:bg-orange-600',
    message: `Para generar una orden de visita, necesito por favor algunos datos:
- Nombre y apellido
- dni o cuit
- dirección y zona
- disponibilidad de horarios (días y horas o rangos de horas)

⚠️ Recordar que nuestro horario de atención es de 9 a 18hs, y dado que el tiempo promedio de trabajo es 2hs, nuestro último turno disponible del día es hasta las 16hs`,
  },
];

interface QuickMessagesCardProps {
  onSend: (content: string) => Promise<void>;
  phone: string | null;
}

export function QuickMessagesCard({ onSend, phone }: QuickMessagesCardProps) {
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentId, setSentId] = useState<string | null>(null);

  const handleSend = async (msg: (typeof QUICK_MESSAGES)[number]) => {
    if (sendingId || !phone) return;

    setSendingId(msg.id);
    try {
      await onSend(msg.message);
      setSentId(msg.id);
      setTimeout(() => setSentId(null), 2000);
    } catch (err) {
      console.error('Error sending quick message:', err);
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
      <h3 className="text-sm font-semibold text-gray-900 mb-2">Mensajes Rápidos</h3>

      {!phone && (
        <div className="rounded-lg bg-warning-50 px-3 py-2 text-sm text-warning-700">
          Sin número de teléfono
        </div>
      )}

      {QUICK_MESSAGES.map((msg) => {
        const isSending = sendingId === msg.id;
        const wasSent = sentId === msg.id;

        return (
          <button
            key={msg.id}
            onClick={() => handleSend(msg)}
            disabled={!phone || isSending}
            className={`w-full rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${msg.color}`}
          >
            {isSending ? (
              <>
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Enviando...
              </>
            ) : wasSent ? (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Enviado
              </>
            ) : (
              <>
                {msg.icon}
                {msg.label}
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
