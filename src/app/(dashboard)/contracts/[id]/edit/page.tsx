'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api-client';

const FREQ_UNITS = [
  { value: 'days', label: 'Días' },
  { value: 'months', label: 'Meses' },
  { value: 'years', label: 'Años' },
];

interface ContractData {
  _id: string;
  name: string;
  client: { _id: string; name: string } | string;
  description?: string;
  status: string;
  startDate: string;
  endDate: string;
  frequency: { interval: number; unit: string };
}

export default function EditContractPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [form, setForm] = useState({
    name: '',
    clientId: '',
    description: '',
    startDate: '',
    endDate: '',
    freqInterval: '1',
    freqUnit: 'months',
  });

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const contract = await api.get<ContractData>(`/api/crm/contracts/${id}`);
        setForm({
          name: contract.name || '',
          clientId: typeof contract.client === 'object' ? contract.client._id : (contract.client || ''),
          description: contract.description || '',
          startDate: contract.startDate ? contract.startDate.slice(0, 10) : '',
          endDate: contract.endDate ? contract.endDate.slice(0, 10) : '',
          freqInterval: String(contract.frequency?.interval || 1),
          freqUnit: contract.frequency?.unit || 'months',
        });
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleChange(field: string, e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    update(field, (e.target as any).value);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) { setError('El nombre del contrato es obligatorio'); return; }
    if (!form.clientId.trim()) { setError('El cliente es obligatorio'); return; }
    if (!form.startDate) { setError('La fecha de inicio es obligatoria'); return; }
    if (!form.endDate) { setError('La fecha de término es obligatoria'); return; }
    if (new Date(form.endDate) <= new Date(form.startDate)) {
      setError('La fecha de término debe ser posterior a la de inicio');
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        clientId: form.clientId.trim(),
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
        frequency: {
          interval: parseInt(form.freqInterval) || 1,
          unit: form.freqUnit,
        },
      };
      if (form.description.trim()) body.description = form.description.trim();

      await api.put(`/api/crm/contracts/${id}`, body);
      router.push(`/contracts/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar contrato');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="h-96 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Contrato no encontrado</p>
        <button onClick={() => router.push('/contracts')} className="mt-4 text-sm text-brand-600 font-medium">
          Volver a contratos
        </button>
      </div>
    );
  }

  const inputClass = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Editar Contrato</h1>
        <p className="text-sm text-gray-500 mt-1">Actualiza los datos del contrato de mantención</p>
      </div>

      {error && (
        <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del contrato <span className="text-danger-500">*</span>
            </label>
            <input type="text" value={form.name} onChange={(e) => handleChange('name', e)}
              className={inputClass} required />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cliente <span className="text-danger-500">*</span>
            </label>
            <input type="text" value={form.clientId} onChange={(e) => handleChange('clientId', e)}
              className={inputClass} placeholder="ID del cliente" required />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea value={form.description} onChange={(e) => handleChange('description', e)}
              className={`${inputClass} min-h-[100px] resize-y`} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de inicio <span className="text-danger-500">*</span>
            </label>
            <input type="date" value={form.startDate} onChange={(e) => handleChange('startDate', e)}
              className={inputClass} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de término <span className="text-danger-500">*</span>
            </label>
            <input type="date" value={form.endDate} onChange={(e) => handleChange('endDate', e)}
              className={inputClass} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Intervalo</label>
            <input type="number" min="1" value={form.freqInterval} onChange={(e) => handleChange('freqInterval', e)}
              className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unidad</label>
            <select value={form.freqUnit} onChange={(e) => handleChange('freqUnit', e)}
              className={inputClass}>
              {FREQ_UNITS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={saving}
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors">
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
          <button type="button" onClick={() => router.push(`/contracts/${id}`)}
            className="rounded-lg border border-gray-200 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
