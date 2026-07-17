'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';
import type { ILead } from '@/leads/types/lead';

interface ScheduleVisitModalProps {
  lead: ILead;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CATEGORY_OPTIONS = [
  { value: 'installation', label: 'Instalación' },
  { value: 'maintenance', label: 'Mantención' },
  { value: 'repair', label: 'Reparación' },
  { value: 'inspection', label: 'Inspección' },
  { value: 'warranty', label: 'Garantía' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Baja' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
];

function toISOStringWithLocalTime(dateStr: string, timeStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = timeStr.split(':').map(Number);
  const dt = new Date(y, mo - 1, d, h, mi);
  return dt.toISOString();
}

export function ScheduleVisitModal({ lead, isOpen, onClose, onSuccess }: ScheduleVisitModalProps) {
  const [title, setTitle] = useState(`Visita técnica - ${lead.name}`);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('inspection');
  const [priority, setPriority] = useState('normal');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledStart, setScheduledStart] = useState('');
  const [scheduledEnd, setScheduledEnd] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError('El título es obligatorio'); return; }
    if (!scheduledDate) { setError('La fecha es obligatoria'); return; }

    setSubmitting(true);
    setError(null);

    try {
      await api.post('/api/operations/work-orders', {
        clientId: lead._id,
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        priority,
        source: 'manual',
        clientSnapshot: { name: lead.name, email: lead.email, phone: lead.phone },
        locationSnapshot: {},
        equipmentSnapshot: null,
        scheduledDate: scheduledDate || undefined,
        scheduledStart: scheduledStart ? toISOStringWithLocalTime(scheduledDate, scheduledStart) : undefined,
        scheduledEnd: scheduledEnd ? toISOStringWithLocalTime(scheduledDate, scheduledEnd) : undefined,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al agendar visita');
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Agendar Visita Técnica</h2>
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputClass}>
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha <span className="text-danger-500">*</span></label>
            <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora inicio</label>
              <input type="time" value={scheduledStart} onChange={(e) => setScheduledStart(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora fin</label>
              <input type="time" value={scheduledEnd} onChange={(e) => setScheduledEnd(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={submitting}
              className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors">
              {submitting ? 'Agendando...' : 'Agendar Visita'}
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
