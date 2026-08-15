'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { LeadStatus, type ILead } from '@/leads/types/lead';
import { LEAD_STATUS_LABELS } from '@/leads/constants/lead-status.constants';
import { CreateQuoteModal } from '@/quotes/components/CreateQuoteModal';
import { ScheduleVisitModal } from '@/operations/components/ScheduleVisitModal';

type PhoneCollisionWarning = {
  type: 'lead' | 'client';
  id: string;
  name: string;
  status: string;
};

const STATUS_OPTIONS = Object.entries(LEAD_STATUS_LABELS)
  .filter(([value]) => value !== 'disqualified')
  .map(([value, label]) => ({ value, label }));

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

export default function NewLeadPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  const [status, setStatus] = useState<LeadStatus>('new');
  const [lostReason, setLostReason] = useState('');
  const [lostDescription, setLostDescription] = useState('');
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [createdLead, setCreatedLead] = useState<ILead | null>(null);
  const [phoneWarnings, setPhoneWarnings] = useState<PhoneCollisionWarning[]>([]);
  const [checkingPhone, setCheckingPhone] = useState(false);

  // Verificar teléfono para detectar duplicados (datos canónicos en backend)
  const checkPhoneForDuplicates = useCallback(async (phone: string) => {
    if (!phone || phone.length < 8) {
      setPhoneWarnings([]);
      return;
    }

    setCheckingPhone(true);
    try {
      const result = await api.get<{ collisions: PhoneCollisionWarning[] }>(
        `/api/crm/phone/check?phone=${encodeURIComponent(phone)}`
      );
      setPhoneWarnings(result.collisions || []);
    } catch (err) {
      console.error('[phone/check] Error:', err);
      setPhoneWarnings([]);
    } finally {
      setCheckingPhone(false);
    }
  }, []);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleChange(field: string, e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    update(field, (e.target as any).value);
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

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        source: form.source,
        status,
      };
      
      if (form.companyName) body.companyName = form.companyName.trim();
      if (form.email) body.email = form.email.trim();
      if (form.address) body.address = form.address.trim();
      if (form.locality) body.locality = form.locality.trim();
      if (form.province) body.province = form.province.trim();
      if (form.priority) body.priority = form.priority;
      if (form.customerType) body.customerType = form.customerType;
      if (form.notes) body.notes = form.notes.trim();

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
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Nuevo Lead</h1>
        <p className="text-sm text-gray-500 mt-1">Ingresa los datos del prospecto</p>
      </div>

      {error && (
        <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
        {/* Sección: Datos básicos */}
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
              <input 
                type="tel" 
                value={form.phone} 
                onChange={(e) => {
                  handleChange('phone', e);
                  // Debounce para verificar duplicados
                  const phone = e.target.value;
                  if (phone.length >= 8) {
                    checkPhoneForDuplicates(phone);
                  }
                }}
                onBlur={() => checkPhoneForDuplicates(form.phone)}
                className={inputClass} 
                placeholder="+54 9 299 1234567" 
                required 
              />
              {checkingPhone && <p className="text-xs text-gray-400 mt-1">Verificando...</p>}
              {phoneWarnings.length > 0 && (
                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-xs font-medium text-yellow-800">⚠️ Teléfono ya existe</p>
                  {phoneWarnings.map((w, i) => (
                    <p key={i} className="text-xs text-yellow-700 mt-1">
                      • {w.type === 'lead' ? 'Lead' : 'Cliente'}: <strong>{w.name}</strong> ({w.status})
                    </p>
                  ))}
                </div>
              )}
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

        {/* Sección: Estado inicial */}
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Estado</h2>
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
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          {status === 'lost' && (
            <>
              <div className="mt-4">
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
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Comentarios</label>
                <textarea value={lostDescription} onChange={(e) => setLostDescription(e.target.value)}
                  className={`${inputClass} min-h-[80px] resize-y`} placeholder="Detalles adicionales..." />
              </div>
            </>
          )}
        </div>

        {/* Sección: Notas */}
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Notas</h2>
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