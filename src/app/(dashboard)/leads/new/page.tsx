'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { LeadStatus, type ILead } from '@/leads/types/lead';
import { CreateQuoteModal } from '@/quotes/components/CreateQuoteModal';
import { ScheduleVisitModal } from '@/operations/components/ScheduleVisitModal';

const SOURCE_OPTIONS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'call', label: 'Llamada' },
  { value: 'form', label: 'Formulario' },
  { value: 'referral', label: 'Referido' },
  { value: 'walk_in', label: 'Presencial' },
  { value: 'other', label: 'Otro' },
];

export default function NewLeadPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    companyName: '',
    email: '',
    phone: '',
    source: 'whatsapp',
    notes: '',
    assignedTo: '',
  });
  const [status, setStatus] = useState<LeadStatus>('new');
  const [lostReason, setLostReason] = useState('');
  const [lostDescription, setLostDescription] = useState('');
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [createdLead, setCreatedLead] = useState<ILead | null>(null);

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
    if (status !== 'lost') {
      if (!form.companyName.trim()) { setError('La empresa es obligatoria'); return; }
      if (!form.email.trim()) { setError('El email es obligatorio'); return; }
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('Email inválido'); return;
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        companyName: form.companyName.trim(),
        email: form.email.trim(),
        source: form.source,
        status,
      };
      if (form.phone) body.phone = form.phone;
      if (form.notes) body.notes = form.notes;
      if (form.assignedTo) body.assignedTo = form.assignedTo;
      if (status === 'lost') {
        body.lostReason = lostReason;
        if (lostDescription) body.lostDescription = lostDescription;
      }

      const result = await api.post<{ lead: ILead; nextAction: string; warnings?: unknown[] }>('/api/crm/leads', body);

      switch (result.nextAction) {
        case 'create_quote':
          setCreatedLead(result.lead);
          setShowQuoteModal(true);
          break;
        case 'schedule_visit':
          setCreatedLead(result.lead);
          setShowVisitModal(true);
          break;
        case 'none':
        default:
          router.push(`/leads/${result.lead._id}`);
          break;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear lead');
    } finally {
      setLoading(false);
    }
  }

  const inputClass = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Nuevo Lead</h1>
        <p className="text-sm text-gray-500 mt-1">Ingresa los datos del prospecto</p>
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
              className={inputClass} placeholder="Juan Pérez" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Empresa <span className="text-danger-500">*</span>
            </label>
            <input type="text" value={form.companyName} onChange={(e) => handleChange('companyName', e)}
              className={inputClass} placeholder="TechSolutions SpA" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-danger-500">*</span>
            </label>
            <input type="email" value={form.email} onChange={(e) => handleChange('email', e)}
              className={inputClass} placeholder="juan@techsolutions.cl" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input type="tel" value={form.phone} onChange={(e) => handleChange('phone', e)}
              className={inputClass} placeholder="+56 9 1234 5678" />
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Estado inicial</label>
          <select value={status} onChange={(e) => {
            const val = e.target.value as LeadStatus;
            setStatus(val);
            if (val !== 'lost') {
              setLostReason('');
              setLostDescription('');
            }
          }} className={inputClass}>
            <option value="new">Nuevo Lead</option>
            <option value="contacted">Contactado</option>
            <option value="quote_sent">Presupuesto enviado</option>
            <option value="technical_visit">Visita técnica</option>
            <option value="won">Lead ganado</option>
            <option value="lost">Lead perdido</option>
          </select>
        </div>
        {status === 'lost' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Motivo de pérdida <span className="text-danger-500">*</span>
              </label>
              <select value={lostReason} onChange={(e) => setLostReason(e.target.value)} className={inputClass}>
                <option value="">Seleccionar motivo</option>
                <option value="price">Precio</option>
                <option value="competitor">Competencia</option>
                <option value="budget">Presupuesto</option>
                <option value="not_interested">No interesado</option>
                <option value="timing">Tiempo</option>
                <option value="no_response">Sin respuesta</option>
                <option value="other">Otro</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Comentarios</label>
              <textarea value={lostDescription} onChange={(e) => setLostDescription(e.target.value)}
                className={`${inputClass} min-h-[80px] resize-y`} placeholder="Detalles adicionales..." />
            </div>
          </>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
          <textarea value={form.notes} onChange={(e) => handleChange('notes', e)}
            className={`${inputClass} min-h-[100px] resize-y`} placeholder="Comentarios adicionales..." />
        </div>
        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={loading}
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors">
            {loading ? 'Creando...' : 'Crear Lead'}
          </button>
          <button type="button" onClick={() => router.push('/leads')}
            className="rounded-lg border border-gray-200 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
        </div>
      </form>
      {createdLead && (
        <>
          <CreateQuoteModal
            lead={createdLead}
            isOpen={showQuoteModal}
            onClose={() => { setShowQuoteModal(false); router.push(`/leads/${createdLead._id}`); }}
            onSuccess={() => router.push(`/leads/${createdLead._id}`)}
          />
          <ScheduleVisitModal
            lead={createdLead}
            isOpen={showVisitModal}
            onClose={() => { setShowVisitModal(false); router.push(`/leads/${createdLead._id}`); }}
            onSuccess={() => router.push(`/leads/${createdLead._id}`)}
          />
        </>
      )}
    </div>
  );
}
