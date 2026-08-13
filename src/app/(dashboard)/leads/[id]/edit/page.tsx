'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api-client';

const SOURCE_OPTIONS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'call', label: 'Llamada' },
  { value: 'form', label: 'Formulario' },
  { value: 'referral', label: 'Referido' },
  { value: 'walk_in', label: 'Presencial' },
  { value: 'other', label: 'Otro' },
];

const PRIORITY_OPTIONS = [
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Media' },
  { value: 'low', label: 'Baja' },
];

const CUSTOMER_TYPE_OPTIONS = [
  { value: 'residential', label: 'Residencial' },
  { value: 'commercial', label: 'Comercial' },
];

interface LeadData {
  _id: string;
  name: string;
  phone?: string;
  companyName?: string;
  email?: string;
  address?: string;
  locality?: string;
  province?: string;
  source: string;
  priority?: string;
  customerType?: string;
  notes?: string;
  assignedTo?: { _id: string; name: string; email: string } | string;
}

export default function EditLeadPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    companyName: '',
    email: '',
    address: '',
    locality: '',
    province: '',
    source: 'whatsapp',
    priority: '',
    customerType: 'residential',
    notes: '',
  });

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const lead = await api.get<LeadData>(`/api/crm/leads/${id}`);
        setForm({
          name: lead.name || '',
          phone: lead.phone || '',
          companyName: lead.companyName || '',
          email: lead.email || '',
          address: lead.address || '',
          locality: lead.locality || '',
          province: lead.province || '',
          source: lead.source || 'whatsapp',
          priority: lead.priority || '',
          customerType: lead.customerType || 'residential',
          notes: lead.notes || '',
        });
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  function handleChange(field: string, e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [field]: (e.target as any).value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Solo nombre y teléfono son obligatorios
    if (!form.name.trim()) { setError('El nombre es obligatorio'); return; }
    if (!form.phone.trim()) { setError('El teléfono es obligatorio'); return; }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('Email inválido'); return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        source: form.source,
      };
      
      if (form.companyName) body.companyName = form.companyName.trim();
      if (form.email) body.email = form.email.trim();
      if (form.address) body.address = form.address.trim();
      if (form.locality) body.locality = form.locality.trim();
      if (form.province) body.province = form.province.trim();
      if (form.priority) body.priority = form.priority;
      if (form.customerType) body.customerType = form.customerType;
      if (form.notes) body.notes = form.notes.trim();

      await api.patch(`/api/crm/leads/${id}`, body);
      router.push(`/leads/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="h-96 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Lead no encontrado</p>
        <button onClick={() => router.push('/leads')} className="mt-4 text-sm text-brand-600 font-medium">
          Volver a leads
        </button>
      </div>
    );
  }

  const inputClass = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Editar Lead</h1>
        <p className="text-sm text-gray-500 mt-1">Actualiza los datos del prospecto</p>
      </div>

      {error && (
        <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
        {/* Sección: Datos de contacto */}
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Datos de contacto</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre de contacto <span className="text-danger-500">*</span>
              </label>
              <input type="text" value={form.name} onChange={(e) => handleChange('name', e)}
                className={inputClass} placeholder="Juan Pérez" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono <span className="text-danger-500">*</span>
              </label>
              <input type="tel" value={form.phone} onChange={(e) => handleChange('phone', e)}
                className={inputClass} placeholder="+54 9 299 1234567" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={form.email} onChange={(e) => handleChange('email', e)}
                className={inputClass} placeholder="juan@ejemplo.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Empresa</label>
              <input type="text" value={form.companyName} onChange={(e) => handleChange('companyName', e)}
                className={inputClass} placeholder="TechSolutions SpA" />
            </div>
          </div>
        </div>

        {/* Sección: Ubicación */}
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Ubicación</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
              <input type="text" value={form.address} onChange={(e) => handleChange('address', e)}
                className={inputClass} placeholder="Av. San Martín 1234" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Localidad</label>
              <input type="text" value={form.locality} onChange={(e) => handleChange('locality', e)}
                className={inputClass} placeholder="Neuquén" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Provincia</label>
              <input type="text" value={form.province} onChange={(e) => handleChange('province', e)}
                className={inputClass} placeholder="Neuquén" />
            </div>
          </div>
        </div>

        {/* Sección: Clasificación */}
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Clasificación</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Origen</label>
              <select value={form.source} onChange={(e) => handleChange('source', e)}
                className={inputClass}>
                {SOURCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de cliente</label>
              <select value={form.customerType} onChange={(e) => handleChange('customerType', e)}
                className={inputClass}>
                {CUSTOMER_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
              <select value={form.priority} onChange={(e) => handleChange('priority', e)}
                className={inputClass}>
                <option value="">Seleccionar...</option>
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Sección: Notas */}
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Notas</h2>
          <textarea value={form.notes} onChange={(e) => handleChange('notes', e)}
            className={`${inputClass} min-h-[100px] resize-y`} placeholder="Comentarios adicionales..." />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={saving}
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors">
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
          <button type="button" onClick={() => router.push(`/leads/${id}`)}
            className="rounded-lg border border-gray-200 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}