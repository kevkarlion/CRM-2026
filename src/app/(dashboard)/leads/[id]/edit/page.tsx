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

interface LeadData {
  _id: string;
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  source: string;
  assignedTo?: { _id: string; name: string; email: string } | string;
  estimatedValue?: number;
  notes?: string;
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
    companyName: '',
    email: '',
    phone: '',
    source: 'whatsapp',
    notes: '',
    assignedTo: '',
  });

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const lead = await api.get<LeadData>(`/api/crm/leads/${id}`);
        setForm({
          name: lead.name || '',
          companyName: lead.companyName || '',
          email: lead.email || '',
          phone: lead.phone || '',
          source: lead.source || 'whatsapp',
          notes: lead.notes || '',
          assignedTo: typeof lead.assignedTo === 'object' ? lead.assignedTo._id : (lead.assignedTo || ''),
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

    if (!form.name.trim()) { setError('El nombre es obligatorio'); return; }
    if (!form.companyName.trim()) { setError('La empresa es obligatoria'); return; }
    if (!form.email.trim()) { setError('El email es obligatorio'); return; }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('Email inválido'); return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        companyName: form.companyName.trim(),
        email: form.email.trim(),
        source: form.source,
      };
      if (form.phone) body.phone = form.phone;
      if (form.notes) body.notes = form.notes;
      if (form.assignedTo) body.assignedTo = form.assignedTo;

      await api.put(`/api/crm/leads/${id}`, body);
      router.push(`/leads/${id}`);
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
        <p className="text-gray-500">Lead no encontrado</p>
        <button onClick={() => router.push('/leads')} className="mt-4 text-sm text-brand-600 font-medium">
          Volver a leads
        </button>
      </div>
    );
  }

  const inputClass = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Editar Lead</h1>
        <p className="text-sm text-gray-500 mt-1">Actualiza los datos del prospecto</p>
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
            <input type="text" value={form.name} onChange={(e) => handleChange('name', e)}
              className={inputClass} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Empresa <span className="text-danger-500">*</span>
            </label>
            <input type="text" value={form.companyName} onChange={(e) => handleChange('companyName', e)}
              className={inputClass} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-danger-500">*</span>
            </label>
            <input type="email" value={form.email} onChange={(e) => handleChange('email', e)}
              className={inputClass} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input type="tel" value={form.phone} onChange={(e) => handleChange('phone', e)}
              className={inputClass} />
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Asignado a</label>
            <input type="text" value={form.assignedTo} onChange={(e) => handleChange('assignedTo', e)}
              className={inputClass} placeholder="ID del usuario" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
          <textarea value={form.notes} onChange={(e) => handleChange('notes', e)}
            className={`${inputClass} min-h-[100px] resize-y`} />
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
