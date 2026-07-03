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

interface CreateQuoteDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: string;
  leadName: string;
  onSuccess: () => void;
}

export function CreateQuoteDrawer({ isOpen, onClose, leadId, leadName, onSuccess }: CreateQuoteDrawerProps) {
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [serviceTypeId, setServiceTypeId] = useState('');
  const [description, setDescription] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [items, setItems] = useState<QuoteItem[]>([{ description: '', type: 'service', quantity: 1, unitPrice: 0 }]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadServiceTypes();
    }
  }, [isOpen]);

  async function loadServiceTypes() {
    try {
      setLoadingServices(true);
      const data = await api.get<ServiceType[]>('/api/crm/service-types');
      console.log('Service types loaded:', data);
      setServiceTypes(data);
    } catch (err) {
      console.error('Error loading service types:', err);
      setError('No se pudieron cargar los tipos de servicio');
    } finally {
      setLoadingServices(false);
    }
  }

  function addItem() {
    setItems([...items, { description: '', type: 'service', quantity: 1, unitPrice: 0 }]);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof QuoteItem, value: string | number) {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  }

  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    console.log('Submit clicked', { title, serviceTypeId, items });
    setError(null);

    if (!title.trim() || !serviceTypeId) {
      setError('El título y tipo de servicio son requeridos');
      return;
    }

    const validItems = items.filter(i => i.description.trim());
    if (validItems.length === 0) {
      setError('Agrega al menos un ítem');
      return;
    }

    setSubmitting(true);
    try {
      console.log('Creating quote with:', { leadId, title, items: validItems });
      await api.post('/api/crm/quotes', {
        leadId,
        title,
        description,
        validUntil: validUntil || undefined,
        items: validItems,
        notes,
      });
      onSuccess();
      onClose();
      resetForm();
    } catch (err) {
      console.error('Error creating quote:', err);
      setError(err instanceof Error ? err.message : 'Error al crear presupuesto');
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setTitle('');
    setServiceTypeId('');
    setDescription('');
    setValidUntil('');
    setItems([{ description: '', type: 'service', quantity: 1, unitPrice: 0 }]);
    setNotes('');
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`Enviar Presupuesto - ${leadName}`}
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
            onClick={(e) => {
              e.preventDefault();
              handleSubmit(e as any);
            }}
            disabled={submitting}
            className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors font-medium"
          >
            {submitting ? 'Guardando...' : 'Crear Borrador'}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 bg-danger-50 text-danger-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Título del presupuesto *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Instalación de sistema de frío"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tipo de servicio *
          </label>
          {loadingServices ? (
            <div className="w-full px-3 py-2 text-gray-400 bg-gray-50 rounded-lg text-sm">Cargando...</div>
          ) : serviceTypes.length === 0 ? (
            <div className="w-full px-3 py-2 text-danger-600 bg-danger-50 rounded-lg text-sm">
              No hay servicios disponibles. Configura los tipos de servicio en el sistema.
            </div>
          ) : (
            <select
              value={serviceTypeId}
              onChange={(e) => setServiceTypeId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none bg-white"
            >
              <option value="">Seleccionar servicio...</option>
              {serviceTypes.map((st) => (
                <option key={st._id} value={st._id}>
                  {st.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descripción general
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Detalles adicionales del trabajo solicitado..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Válido hasta
          </label>
          <input
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Items del presupuesto
            </label>
            <button
              type="button"
              onClick={addItem}
              className="text-sm text-brand-600 hover:text-brand-700 font-medium"
            >
              + Agregar ítem
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="p-3 bg-gray-50 rounded-lg space-y-2">
                <div className="flex gap-2">
                  <select
                    value={item.type}
                    onChange={(e) => updateItem(index, 'type', e.target.value)}
                    className="w-28 px-2 py-2 border border-gray-200 rounded-lg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-sm bg-white"
                  >
                    <option value="service">Servicio</option>
                    <option value="product">Producto</option>
                    <option value="labor">Mano obra</option>
                    <option value="material">Material</option>
                    <option value="part">Repuesto</option>
                  </select>
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                    placeholder="Descripción del ítem"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                      min={1}
                      placeholder="Cantidad"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <input
                      type="number"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(index, 'unitPrice', parseInt(e.target.value) || 0)}
                      min={0}
                      placeholder="Precio unitario"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-sm"
                    />
                  </div>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="p-2 text-danger-500 hover:text-danger-700"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between text-sm">
            <span className="text-gray-600">Subtotal</span>
            <span className="font-medium text-gray-900">${subtotal.toLocaleString()}</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notas internas
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Notas que no se incluirán en el presupuesto..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none resize-none"
          />
        </div>
      </form>
    </Drawer>
  );
}
