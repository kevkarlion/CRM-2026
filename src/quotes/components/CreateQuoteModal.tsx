'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';
import type { ILead } from '@/leads/types/lead';

interface CreateQuoteModalProps {
  lead: ILead;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateQuoteModal({ lead, isOpen, onClose, onSuccess }: CreateQuoteModalProps) {
  const [title, setTitle] = useState(`Cotización para ${lead.name}`);
  const [description, setDescription] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [items, setItems] = useState<{ description: string; unitPrice: number; quantity: number }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  function addItem() {
    if (!itemDesc.trim() || !itemPrice) return;
    setItems([...items, { description: itemDesc.trim(), unitPrice: parseFloat(itemPrice), quantity: 1 }]);
    setItemDesc('');
    setItemPrice('');
  }

  function removeItem(idx: number) {
    setItems(items.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError('El título es obligatorio'); return; }
    if (items.length === 0) { setError('Agrega al menos un ítem'); return; }
    setSubmitting(true);
    setError(null);

    try {
      await api.post('/api/crm/quotes', {
        clientId: lead._id,
        title: title.trim(),
        description: description.trim() || undefined,
        items: items.map((it) => ({
          description: it.description,
          unitPrice: it.unitPrice,
          quantity: it.quantity,
        })),
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear cotización');
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Nueva Cotización</h2>
        <p className="text-sm text-gray-500 mb-5">Para: {lead.name}</p>

        {error && (
          <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700 mb-4">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título <span className="text-danger-500">*</span></label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputClass} min-h-[60px] resize-y`} />
          </div>

          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Ítems <span className="text-danger-500">*</span></label>
            {items.length > 0 && (
              <div className="space-y-2 mb-3">
                {items.map((it, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm bg-gray-50 px-3 py-2 rounded-lg">
                    <span className="flex-1 truncate">{it.description}</span>
                    <span className="text-gray-500">${it.unitPrice.toLocaleString()}</span>
                    <button type="button" onClick={() => removeItem(idx)} className="text-danger-500 hover:text-danger-700">&times;</button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input type="text" value={itemDesc} onChange={(e) => setItemDesc(e.target.value)}
                className={`${inputClass} flex-1`} placeholder="Descripción del ítem" />
              <input type="number" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)}
                className={`${inputClass} w-28`} placeholder="Precio" min="0" step="0.01" />
              <button type="button" onClick={addItem}
                className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors">
                +
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={submitting}
              className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors">
              {submitting ? 'Creando...' : 'Crear Cotización'}
            </button>
            <button type="button" onClick={onClose} disabled={submitting}
              className="rounded-lg border border-gray-200 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
