'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api-client';

interface Quote {
  _id: string;
  number: string;
  title: string;
  total: number;
  status: string;
  validUntil: string | null;
}

interface Lead {
  _id: string;
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  status: string;
}

export default function ConfirmSalePage() {
  const router = useRouter();
  const params = useParams();
  const [lead, setLead] = useState<Lead | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuotes, setSelectedQuotes] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [customerType, setCustomerType] = useState('commercial');

  const id = params.id as string;

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    try {
      setLoading(true);
      const [leadData, quotesData] = await Promise.all([
        api.get<Lead>(`/api/crm/leads/${id}`),
        api.get<{ data: Quote[] }>(`/api/crm/quotes?leadId=${id}`),
      ]);
      setLead(leadData);
      // Only show approved quotes
      setQuotes(quotesData.data.filter((q: Quote) => q.status === 'approved'));
      // Pre-select all approved quotes
      setSelectedQuotes(quotesData.data.filter((q: Quote) => q.status === 'approved').map((q: Quote) => q._id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmSale() {
    if (selectedQuotes.length === 0) {
      setError('Seleccioná al menos un presupuesto aprobado');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await api.post(`/api/crm/leads/${id}/confirm-sale`, {
        saleMode: 'quotes',
        quoteIds: selectedQuotes,
        notes,
        customerType,
      });
      router.push(`/leads/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al confirmar venta');
    } finally {
      setSaving(false);
    }
  }

  function toggleQuote(quoteId: string) {
    setSelectedQuotes(prev => 
      prev.includes(quoteId) 
        ? prev.filter(id => id !== quoteId)
        : [...prev, quoteId]
    );
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <button onClick={() => router.push(`/leads/${id}`)} className="text-gray-400 hover:text-gray-600">
          ← Volver al lead
        </button>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mt-2">Confirmar Venta</h1>
        <p className="text-sm text-gray-500 mt-1">
          {lead?.name} {lead?.companyName && `(${lead.companyName})`}
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
      )}

      {quotes.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <p className="text-yellow-800">No hay presupuestos aprobados para este lead.</p>
          <p className="text-yellow-600 text-sm mt-1">Aprobá un presupuesto primero para poder confirmar la venta.</p>
          <button 
            onClick={() => router.push(`/leads/${id}`)}
            className="mt-4 text-sm text-brand-600 hover:text-brand-700"
          >
            Volver al lead
          </button>
        </div>
      ) : (
        <>
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              Seleccioná los presupuestos
            </h2>
            <div className="space-y-2">
              {quotes.map((quote) => (
                <label 
                  key={quote._id} 
                  className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors ${
                    selectedQuotes.includes(quote._id) 
                      ? 'border-success-300 bg-success-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedQuotes.includes(quote._id)}
                      onChange={() => toggleQuote(quote._id)}
                      className="w-5 h-5 text-success-600 rounded border-gray-300 focus:ring-success-500"
                    />
                    <div>
                      <p className="font-medium text-gray-900">{quote.title}</p>
                      <p className="text-sm text-gray-500">#{quote.number}</p>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-success-600">
                    ${quote.total.toLocaleString('es-CL')}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              Información adicional
            </h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de cliente</label>
              <select 
                value={customerType}
                onChange={(e) => setCustomerType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
              >
                <option value="commercial">Comercial</option>
                <option value="individual">Particular</option>
                <option value="government">Gobierno</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
              <textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas sobre la venta..."
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                rows={3}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button 
              onClick={() => router.push(`/leads/${id}`)}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button 
              onClick={handleConfirmSale}
              disabled={saving || selectedQuotes.length === 0}
              className="flex-1 px-4 py-2 bg-success-500 text-white rounded-lg text-sm font-medium hover:bg-success-600 disabled:opacity-50"
            >
              {saving ? 'Confirmando...' : 'Confirmar Venta'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}