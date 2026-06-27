'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';

interface QuoteItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

function emptyItem(): QuoteItem {
  return { description: '', quantity: 1, unitPrice: 0 };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);
}

export default function NewQuotePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientId] = useState('');
  const [items, setItems] = useState<QuoteItem[]>([emptyItem()]);
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [validUntil, setValidUntil] = useState('');

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const tax = Math.round(subtotal * 0.19);
  const total = subtotal + tax;

  function updateItem(index: number, field: keyof QuoteItem, value: string) {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[index] };
      if (field === 'description') item.description = value;
      else if (field === 'quantity') item.quantity = Math.max(1, parseInt(value) || 0);
      else if (field === 'unitPrice') item.unitPrice = Math.max(0, parseInt(value) || 0);
      next[index] = item;
      return next;
    });
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!clientId.trim()) { setError('El cliente es obligatorio'); return; }
    if (!validUntil) { setError('La fecha de validez es obligatoria'); return; }
    if (items.length === 0 || items.every((i) => !i.description.trim())) {
      setError('Debes agregar al menos un item con descripción');
      return;
    }
    if (items.some((i) => !i.description.trim())) {
      setError('Todos los items deben tener una descripción');
      return;
    }

    setLoading(true);
    try {
      const result = await api.post<{ quote: { _id: string } }>('/api/crm/quotes', {
        clientId: clientId.trim(),
        items: items.map((i) => ({ description: i.description.trim(), quantity: i.quantity, unitPrice: i.unitPrice })),
        validUntil: new Date(validUntil).toISOString(),
        notes: notes.trim() || undefined,
        terms: terms.trim() || undefined,
      });
      router.push(`/quotes/${result.quote._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear cotización');
    } finally {
      setLoading(false);
    }
  }

  const inputClass = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Nueva Cotización</h1>
        <p className="text-sm text-gray-500 mt-1">Ingresa los datos de la cotización</p>
      </div>

      {error && (
        <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-900">Cliente</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ID o nombre del cliente <span className="text-danger-500">*</span>
            </label>
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId((e.target as any).value)}
              className={inputClass}
              placeholder="ID del cliente"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Válido hasta <span className="text-danger-500">*</span>
            </label>
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil((e.target as any).value)}
              className={inputClass}
              required
            />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Items</h2>
            <button type="button" onClick={addItem}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Agregar Item
            </button>
          </div>

          {items.map((item, index) => (
            <div key={index} className="flex flex-col sm:flex-row gap-3 items-start sm:items-end p-4 bg-gray-50 rounded-lg">
              <div className="flex-1 w-full">
                <label className="block text-xs font-medium text-gray-500 mb-1">Descripción</label>
                <input type="text" value={item.description}
                  onChange={(e) => updateItem(index, 'description', (e.target as any).value)}
                  className={inputClass} placeholder="Descripción del item" />
              </div>
              <div className="w-full sm:w-24">
                <label className="block text-xs font-medium text-gray-500 mb-1">Cantidad</label>
                <input type="number" min="1" value={item.quantity}
                  onChange={(e) => updateItem(index, 'quantity', (e.target as any).value)}
                  className={inputClass} />
              </div>
              <div className="w-full sm:w-32">
                <label className="block text-xs font-medium text-gray-500 mb-1">Precio Unitario</label>
                <input type="number" min="0" value={item.unitPrice}
                  onChange={(e) => updateItem(index, 'unitPrice', (e.target as any).value)}
                  className={inputClass} placeholder="$" />
              </div>
              <div className="w-full sm:w-28 text-right">
                <label className="block text-xs font-medium text-gray-500 mb-1 sm:invisible">Total</label>
                <p className="text-sm font-medium text-gray-900 py-2">{formatCurrency(item.quantity * item.unitPrice)}</p>
              </div>
              {items.length > 1 && (
                <button type="button" onClick={() => removeItem(index)}
                  className="rounded-lg p-2 text-gray-400 hover:text-danger-600 hover:bg-danger-50 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          ))}

          <div className="border-t border-gray-200 pt-4 space-y-1 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>IVA (19%)</span>
              <span>{formatCurrency(tax)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-gray-900">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <textarea value={notes} onChange={(e) => setNotes((e.target as any).value)}
              className={`${inputClass} min-h-[80px] resize-y`} placeholder="Notas adicionales..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Términos y condiciones</label>
            <textarea value={terms} onChange={(e) => setTerms((e.target as any).value)}
              className={`${inputClass} min-h-[80px] resize-y`} placeholder="Términos de la cotización..." />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={loading}
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors">
            {loading ? 'Creando...' : 'Crear Cotización'}
          </button>
          <button type="button" onClick={() => router.push('/quotes')}
            className="rounded-lg border border-gray-200 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
