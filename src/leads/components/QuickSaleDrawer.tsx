'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { Drawer } from '@/lib/components/Drawer';

interface ServiceType {
  _id: string;
  name: string;
  description?: string;
}

interface QuoteItem {
  description: string;
  type: 'product' | 'service' | 'labor' | 'material' | 'part';
  quantity: number;
  unitPrice: number;
}

interface QuickSaleDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: string;
  leadName: string;
  leadEmail?: string;
  leadPhone?: string;
  leadCompany?: string;
  onSuccess: () => void;
}

export function QuickSaleDrawer({ 
  isOpen, 
  onClose, 
  leadId, 
  leadName,
  leadEmail,
  leadPhone,
  leadCompany,
  onSuccess 
}: QuickSaleDrawerProps) {
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [serviceTypeId, setServiceTypeId] = useState('');
  const [description, setDescription] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [items, setItems] = useState<QuoteItem[]>([
    { description: '', type: 'service', quantity: 1, unitPrice: 0 }
  ]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadServiceTypes();
      // Reset form
      setTitle(`Venta directa - ${leadName}`);
      setItems([{ description: '', type: 'service', quantity: 1, unitPrice: 0 }]);
    }
  }, [isOpen, leadName]);

  async function loadServiceTypes() {
    try {
      setLoadingServices(true);
      const data = await api.get<ServiceType[]>('/api/crm/service-types');
      setServiceTypes(data);
    } catch (err) {
      setError('No se pudieron cargar los tipos de servicio');
    } finally {
      setLoadingServices(false);
    }
  }

  function addItem() {
    setItems([...items, { description: '', type: 'service', quantity: 1, unitPrice: 0 }]);
  }

  function removeItem(index: number) {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof QuoteItem, value: string | number) {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    setItems(newItems);
  }

  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const tax = subtotal * 0.21;
  const total = subtotal + tax;

  async function handleSubmit() {
    // Validate
    if (!title.trim()) { setError('El título es obligatorio'); return; }
    if (!items.some(i => i.description.trim() && i.unitPrice > 0)) {
      setError('Agregá al menos un ítem con precio');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // 1. Create the quote
      const quote = await api.post<{ _id: string }>('/api/crm/quotes', {
        leadId,
        title: title.trim(),
        description: description.trim() || undefined,
        serviceTypeId: serviceTypeId || undefined,
        validUntil: validUntil || undefined,
        status: 'approved',
        approvedAt: new Date().toISOString(),
        items: items.filter(i => i.description.trim()),
        subtotal,
        tax,
        total,
        notes: notes.trim() || undefined,
      });

      // 2. Create WorkOrder
      await api.post('/api/operations/work-orders', {
        leadId,
        title: `Servicio para ${leadName}`,
        source: 'lead_conversion',
        priority: 'normal',
        category: 'maintenance',
        clientSnapshot: {
          name: leadName,
          email: leadEmail || '',
          phone: leadPhone || '',
          companyName: leadCompany || '',
        },
      });

      // 3. Change lead status to won
      await api.patch(`/api/crm/leads/${leadId}/status`, { status: 'won' });

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al confirmar venta');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Confirmar Venta">
      <div className="space-y-6">
        <div className="bg-success-50 border border-success-200 rounded-lg p-4">
          <p className="text-sm text-success-800">
            Esta acción creará un presupuesto aprobado y convertirá el lead en cliente ganado.
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Título del presupuesto <span className="text-danger-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
            placeholder="Ej: Instalación de equipo"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de servicio</label>
          <select
            value={serviceTypeId}
            onChange={(e) => setServiceTypeId(e.target.value)}
            disabled={loadingServices}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
          >
            <option value="">Seleccionar...</option>
            {serviceTypes.map((st) => (
              <option key={st._id} value={st._id}>{st.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
            rows={2}
            placeholder="Detalles del servicio..."
          />
        </div>

        {/* Items */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Items <span className="text-danger-500">*</span>
            </label>
            <button
              type="button"
              onClick={addItem}
              className="text-xs text-brand-600 hover:text-brand-700 font-medium"
            >
              + Agregar ítem
            </button>
          </div>
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="flex gap-2 items-start">
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => updateItem(index, 'description', e.target.value)}
                  placeholder="Descripción del ítem"
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                />
                <select
                  value={item.type}
                  onChange={(e) => updateItem(index, 'type', e.target.value)}
                  className="w-24 px-2 py-2 rounded-lg border border-gray-200 text-sm"
                >
                  <option value="service">Servicio</option>
                  <option value="product">Producto</option>
                  <option value="labor">Mano de obra</option>
                  <option value="material">Material</option>
                  <option value="part">Repuesto</option>
                </select>
                <input
                  type="number"
                  value={item.unitPrice}
                  onChange={(e) => updateItem(index, 'unitPrice', Number(e.target.value))}
                  placeholder="Precio"
                  className="w-24 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                />
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="text-gray-400 hover:text-danger-500 p-2"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Subtotal</span>
            <span className="font-medium">${subtotal.toLocaleString('es-CL')}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">IVA (21%)</span>
            <span className="font-medium">${tax.toLocaleString('es-CL')}</span>
          </div>
          <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
            <span>Total</span>
            <span className="text-success-600">${total.toLocaleString('es-CL')}</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
            rows={2}
            placeholder="Notas adicionales..."
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-2 bg-success-500 text-white rounded-lg text-sm font-medium hover:bg-success-600 disabled:opacity-50"
          >
            {submitting ? 'Confirmando...' : 'Confirmar Venta'}
          </button>
        </div>
      </div>
    </Drawer>
  );
}