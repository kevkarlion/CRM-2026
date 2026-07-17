'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { Drawer } from '@/lib/components/Drawer';

interface ApprovedQuote {
  _id: string;
  number: string;
  title: string;
  total: number;
  status: string;
}

interface ConfirmSaleDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: string;
  leadName: string;
  onSuccess: () => void;
}

export function ConfirmSaleDrawer({ isOpen, onClose, leadId, leadName, onSuccess }: ConfirmSaleDrawerProps) {
  const [saleMode, setSaleMode] = useState<'quotes' | 'direct'>('quotes');
  const [quotes, setQuotes] = useState<ApprovedQuote[]>([]);
  const [selectedQuoteIds, setSelectedQuoteIds] = useState<string[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [directAmount, setDirectAmount] = useState('');
  const [directDescription, setDirectDescription] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadQuotes();
      resetForm();
    }
  }, [isOpen]);

  async function loadQuotes() {
    try {
      setLoadingQuotes(true);
      const data = await api.get<ApprovedQuote[]>(`/api/crm/leads/${leadId}/quotes`);
      const approved = data.filter(q => q.status === 'approved');
      setQuotes(approved);
    } catch (err) {
      console.error('Error loading quotes:', err);
      setError('No se pudieron cargar los presupuestos');
    } finally {
      setLoadingQuotes(false);
    }
  }

  function toggleQuote(quoteId: string) {
    setSelectedQuoteIds(prev =>
      prev.includes(quoteId) ? prev.filter(id => id !== quoteId) : [...prev, quoteId],
    );
  }

  function selectAllQuotes() {
    setSelectedQuoteIds(quotes.map(q => q._id));
  }

  function resetForm() {
    setSaleMode('quotes');
    setSelectedQuoteIds([]);
    setDirectAmount('');
    setDirectDescription('');
    setNotes('');
    setError(null);
  }

  const selectedTotal = quotes
    .filter(q => selectedQuoteIds.includes(q._id))
    .reduce((sum, q) => sum + q.total, 0);

  const directTotal = parseFloat(directAmount) || 0;

  async function handleSubmit() {
    setError(null);

    if (saleMode === 'quotes') {
      if (selectedQuoteIds.length === 0) {
        setError('Selecciona al menos un presupuesto');
        return;
      }
    } else {
      if (directTotal <= 0) {
        setError('Ingresa un monto válido para la venta directa');
        return;
      }
    }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        saleMode,
        notes: notes || undefined,
      };

      if (saleMode === 'quotes') {
        body.quoteIds = selectedQuoteIds;
      } else {
        body.directSale = {
          amount: directTotal,
          description: directDescription || undefined,
        };
      }

      await api.post(`/api/crm/leads/${leadId}/confirm-sale`, body);
      onSuccess();
      onClose();
      resetForm();
    } catch (err) {
      console.error('Error confirming sale:', err);
      setError(err instanceof Error ? err.message : 'Error al confirmar la venta');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`Confirmar Venta - ${leadName}`}
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 disabled:opacity-50 transition-colors font-medium"
          >
            {submitting ? 'Confirmando...' : 'Confirmar Venta'}
          </button>
        </div>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-5">
        {error && (
          <div className="p-3 bg-danger-50 text-danger-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Modo de venta
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setSaleMode('quotes')}
              className={`flex-1 px-4 py-3 border rounded-lg text-sm font-medium transition-colors ${
                saleMode === 'quotes'
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Por presupuestos
            </button>
            <button
              type="button"
              onClick={() => setSaleMode('direct')}
              className={`flex-1 px-4 py-3 border rounded-lg text-sm font-medium transition-colors ${
                saleMode === 'direct'
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Venta directa
            </button>
          </div>
        </div>

        {saleMode === 'quotes' ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Presupuestos aprobados
              </label>
              {quotes.length > 0 && (
                <button
                  type="button"
                  onClick={selectAllQuotes}
                  className="text-sm text-brand-600 hover:text-brand-700 font-medium"
                >
                  Seleccionar todos
                </button>
              )}
            </div>

            {loadingQuotes ? (
              <div className="p-4 text-center text-gray-400 text-sm">Cargando presupuestos...</div>
            ) : quotes.length === 0 ? (
              <div className="p-4 text-center bg-gray-50 rounded-lg">
                <p className="text-gray-500 text-sm">No hay presupuestos aprobados para este lead.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {quotes.map(quote => (
                  <label
                    key={quote._id}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedQuoteIds.includes(quote._id)
                        ? 'border-brand-500 bg-brand-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedQuoteIds.includes(quote._id)}
                      onChange={() => toggleQuote(quote._id)}
                      className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        #{quote.number} — {quote.title}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-gray-900 whitespace-nowrap">
                      ${quote.total.toLocaleString('es-CL')}
                    </span>
                  </label>
                ))}
              </div>
            )}

            {selectedQuoteIds.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between text-sm">
                <span className="text-gray-600">
                  Total ({selectedQuoteIds.length} presupuesto{selectedQuoteIds.length > 1 ? 's' : ''})
                </span>
                <span className="font-medium text-gray-900">${selectedTotal.toLocaleString('es-CL')}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Monto de la venta *
              </label>
              <input
                type="number"
                value={directAmount}
                onChange={(e) => setDirectAmount(e.target.value)}
                min={0}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripción
              </label>
              <textarea
                value={directDescription}
                onChange={(e) => setDirectDescription(e.target.value)}
                rows={3}
                placeholder="Detalles de la venta directa..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none resize-none"
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notas
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Notas adicionales sobre la venta..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none resize-none"
          />
        </div>
      </form>
    </Drawer>
  );
}
