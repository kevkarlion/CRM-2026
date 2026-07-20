'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { Drawer } from '@/lib/components/Drawer';

interface ServiceType {
  _id: string;
  name: string;
  description?: string;
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
  onSuccess,
}: QuickSaleDrawerProps) {
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);

  const [title, setTitle] = useState('');
  const [serviceTypeId, setServiceTypeId] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      resetForm();
      loadServiceTypes();
    }
  }, [isOpen]);

  async function loadServiceTypes() {
    try {
      setLoadingServices(true);
      const data = await api.get<ServiceType[]>('/api/crm/service-types');
      setServiceTypes(data);
    } catch (err) {
      console.error('Error loading service types:', err);
      setError('No se pudieron cargar los tipos de servicio');
    } finally {
      setLoadingServices(false);
    }
  }

  function resetForm() {
    setTitle('');
    setServiceTypeId('');
    setAmount(0);
    setDescription('');
    setNotes('');
    setError(null);
  }

  function formatCurrency(value: number): string {
    return value.toLocaleString('es-AR');
  }

  function parseCurrency(value: string): number {
    const cleaned = value.replace(/\./g, '').replace(/,/g, '.');
    return Number(cleaned) || 0;
  }

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setAmount(Number(raw) || 0);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('El título es requerido');
      return;
    }

    if (!serviceTypeId) {
      setError('Selecciona un tipo de servicio');
      return;
    }

    if (!amount || amount <= 0) {
      setError('Ingresa un monto válido');
      return;
    }

    setSubmitting(true);

    try {
      await api.post(`/api/crm/leads/${leadId}/confirm-sale`, {
        saleMode: 'direct',
        directSale: {
          amount,
          description: title.trim(),
          serviceTypeId,
        },
        notes: notes.trim() || undefined,
      });

      onSuccess();
      onClose();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al confirmar venta');
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
            type="submit"
            form="quick-sale-form"
            disabled={submitting}
            className="flex-1 px-4 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 disabled:opacity-50 transition-colors font-medium"
          >
            {submitting ? 'Confirmando...' : 'Confirmar Venta'}
          </button>
        </div>
      }
    >
      <form id="quick-sale-form" onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-success-50 border border-success-200 rounded-lg p-4">
          <p className="text-sm text-success-800">
            Esta acción convertirá el lead en cliente ganado y creará una orden de trabajo.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-danger-50 text-danger-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Título de la venta *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Venta de sistema de seguridad"
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
            Monto total *
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
              $
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={amount ? formatCurrency(amount) : ''}
              onChange={handleAmountChange}
              placeholder="0"
              className="w-full pl-7 pr-3 py-2.5 border border-gray-200 rounded-lg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-lg font-semibold"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descripción
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Detalles de la venta..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notas internas
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Notas que no se incluirán en la venta..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none resize-none"
          />
        </div>
      </form>
    </Drawer>
  );
}
