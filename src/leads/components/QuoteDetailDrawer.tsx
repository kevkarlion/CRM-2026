'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { formatDateSafe, getDaysUntilExpiry } from '@/lib/format-date';
import { Drawer } from '@/lib/components/Drawer';

interface QuoteItem {
  description: string;
  type: 'product' | 'service' | 'labor' | 'material' | 'part';
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface QuoteVersion {
  _id: string;
  version: number;
  title: string;
  description?: string;
  items: QuoteItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  notes?: string;
  createdAt: string;
}

interface Quote {
  _id: string;
  number: string;
  title: string;
  description?: string;
  status: 'draft' | 'sent' | 'approved' | 'rejected' | 'expired' | 'cancelled';
  currentVersion: number;
  validUntil: string | null;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  notes?: string;
  sentAt: string | null;
  createdAt: string;
}

interface QuoteDetail {
  quote: Quote;
  currentVersion: QuoteVersion | null;
}

interface QuoteDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  quoteId: string;
}

const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  sent: 'Enviado',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  expired: 'Expirado',
  cancelled: 'Cancelado',
};

const QUOTE_STATUS_VARIANT: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-50 text-blue-700',
  approved: 'bg-success-50 text-success-700',
  rejected: 'bg-danger-50 text-danger-700',
  expired: 'bg-warning-50 text-warning-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

const ITEM_TYPE_LABELS: Record<string, string> = {
  product: 'Producto',
  service: 'Servicio',
  labor: 'Mano de obra',
  material: 'Material',
  part: 'Repuesto',
};

function ExpiryAlert({ validUntil }: { validUntil: string | null }) {
  const daysLeft = getDaysUntilExpiry(validUntil);
  
  if (daysLeft === null) return null;
  
  if (daysLeft < 0) {
    return (
      <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg">
        <p className="text-sm text-danger-700 font-medium">
          ⚠️ Presupuesto vencido hace {Math.abs(daysLeft)} días
        </p>
      </div>
    );
  }
  
  if (daysLeft === 0) {
    return (
      <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg">
        <p className="text-sm text-danger-700 font-medium">
          ⚠️ Vence hoy
        </p>
      </div>
    );
  }
  
  if (daysLeft <= 3) {
    return (
      <div className="p-3 bg-warning-50 border border-warning-200 rounded-lg">
        <p className="text-sm text-warning-700 font-medium">
          ⏰ Vence en {daysLeft} día{daysLeft !== 1 ? 's' : ''}
        </p>
      </div>
    );
  }
  
  if (daysLeft <= 7) {
    return (
      <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
        <p className="text-sm text-orange-700 font-medium">
          ⏰ Vence en {daysLeft} días
        </p>
      </div>
    );
  }
  
  return null;
}

export function QuoteDetailDrawer({ isOpen, onClose, quoteId }: QuoteDetailDrawerProps) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && quoteId) {
      loadQuote();
    }
  }, [isOpen, quoteId]);

  async function loadQuote() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<QuoteDetail>(`/api/crm/quotes/${quoteId}`);
      setQuote(data.quote);
      setCurrentVersion(data.currentVersion);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar presupuesto');
    } finally {
      setLoading(false);
    }
  }

  const [currentVersion, setCurrentVersion] = useState<QuoteVersion | null>(null);

  if (!isOpen) return null;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`Presupuesto #${quote?.number || ''}`}
    >
      {loading ? (
        <div className="space-y-4">
          <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
          <div className="h-20 bg-gray-100 rounded animate-pulse" />
        </div>
      ) : error ? (
        <div className="p-3 bg-danger-50 text-danger-700 text-sm rounded-lg">
          {error}
        </div>
      ) : quote ? (
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{quote.title}</h3>
              <p className="text-sm text-gray-500">#{quote.number}</p>
            </div>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${QUOTE_STATUS_VARIANT[quote.status]}`}>
              {QUOTE_STATUS_LABELS[quote.status]}
            </span>
          </div>

          {/* Alerta de caducidad */}
          {quote.status === 'sent' && (
            <ExpiryAlert validUntil={quote.validUntil} />
          )}

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Creado</p>
              <p className="font-medium">
                {new Date(quote.createdAt).toLocaleDateString('es-CL', { 
                  day: '2-digit', month: 'long', year: 'numeric' 
                })}
              </p>
            </div>
            {quote.validUntil && (
              <div>
                <p className="text-gray-500">Válido hasta</p>
                <p className="font-medium">
                  {formatDateSafe(quote.validUntil)}
                </p>
              </div>
            )}
            {quote.sentAt && (
              <div>
                <p className="text-gray-500">Enviado</p>
                <p className="font-medium">
                  {new Date(quote.sentAt).toLocaleDateString('es-CL', { 
                    day: '2-digit', month: 'long', year: 'numeric' 
                  })}
                </p>
              </div>
            )}
          </div>

          {/* Descripción */}
          {quote.description && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Descripción</p>
              <p className="text-sm text-gray-600">{quote.description}</p>
            </div>
          )}

          {/* Items */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Ítems</p>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-500">Tipo</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500">Descripción</th>
                    <th className="text-center px-3 py-2 font-medium text-gray-500">Cant.</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-500">Unitario</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-500">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {currentVersion?.items.map((item, index) => (
                    <tr key={index}>
                      <td className="px-3 py-2 text-gray-600">
                        <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                          {ITEM_TYPE_LABELS[item.type] || item.type}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-900">{item.description}</td>
                      <td className="px-3 py-2 text-center text-gray-600">{item.quantity}</td>
                      <td className="px-3 py-2 text-right text-gray-600">${item.unitPrice.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right font-medium text-gray-900">${item.subtotal.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totales */}
          <div className="border-t border-gray-200 pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium">${quote.subtotal.toLocaleString()}</span>
            </div>
            {quote.discountAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Descuento</span>
                <span className="font-medium text-danger-600">-${quote.discountAmount.toLocaleString()}</span>
              </div>
            )}
            {quote.taxAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Impuesto</span>
                <span className="font-medium">${quote.taxAmount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-semibold pt-2 border-t border-gray-200">
              <span>Total</span>
              <span>${quote.total.toLocaleString()}</span>
            </div>
          </div>

          {/* Notas */}
          {quote.notes && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Notas internas</p>
              <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{quote.notes}</p>
            </div>
          )}
        </div>
      ) : null}
    </Drawer>
  );
}
