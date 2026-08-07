'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api-client';

const CUSTOMER_TYPE_OPTIONS = [
  { value: 'residential', label: 'Residencial' },
  { value: 'commercial', label: 'Comercial' },
  { value: 'industrial', label: 'Industrial' },
];

const SOURCE_OPTIONS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'call', label: 'Llamada' },
  { value: 'form', label: 'Formulario' },
  { value: 'referral', label: 'Referido' },
  { value: 'walk_in', label: 'Presencial' },
  { value: 'other', label: 'Otro' },
];

interface ClientData {
  _id: string;
  customerType: string;
  fullName?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  locality?: string;
  source?: string;
}

export default function EditClientPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    companyName: '',
    email: '',
    phone: '',
    customerType: 'residential',
    locality: '',
    source: 'other',
  });

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const client = await api.get<ClientData>(`/api/crm/clients/${id}`);
        setForm({
          fullName: client.fullName || '',
          companyName: client.companyName || '',
          email: client.email || '',
          phone: client.phone || '',
          customerType: client.customerType || 'residential',
          locality: client.locality || '',
          source: client.source || 'other',
        });
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  function handleChange(field: string, e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [field]: (e.target as any).value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.fullName.trim()) { setError('El nombre de contacto es obligatorio'); return; }
    if (!form.locality.trim()) { setError('La localidad es obligatoria'); return; }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('Email inválido'); return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        fullName: form.fullName.trim(),
        customerType: form.customerType,
        locality: form.locality.trim(),
        source: form.source,
      };
      if (form.companyName) body.companyName = form.companyName.trim();
      if (form.email) body.email = form.email.trim();
      if (form.phone) body.phone = form.phone.trim();

      await api.patch(`/api/crm/clients/${id}`, body);
      router.push(`/clients/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar');
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
        <p className="text-gray-500">Cliente no encontrado</p>
        <button onClick={() => router.push('/clients')} className="mt-4 text-sm text-brand-600 font-medium">
          Volver a clientes
        </button>
      </div>
    );
  }

  const inputClass = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Editar Cliente</h1>
        <p className="text-sm text-gray-500 mt-1">Actualiza los datos del cliente</p>
      </div>

      {error && (
        <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de contacto <span className="text-danger-500">*</span>
            </label>
            <input type="text" value={form.fullName} onChange={(e) => handleChange('fullName', e)}
              className={inputClass} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Empresa</label>
            <input type="text" value={form.companyName} onChange={(e) => handleChange('companyName', e)}
              className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={form.email} onChange={(e) => handleChange('email', e)}
              className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input type="tel" value={form.phone} onChange={(e) => handleChange('phone', e)}
              className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select value={form.customerType} onChange={(e) => handleChange('customerType', e)}
              className={inputClass}>
              {CUSTOMER_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Localidad <span className="text-danger-500">*</span>
            </label>
            <input type="text" value={form.locality} onChange={(e) => handleChange('locality', e)}
              className={inputClass} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Origen</label>
            <select value={form.source} onChange={(e) => handleChange('source', e)}
              className={inputClass}>
              {SOURCE_OPTIONS.map((opt) => (
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
          <button type="button" onClick={() => router.push(`/clients/${id}`)}
            className="rounded-lg border border-gray-200 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
