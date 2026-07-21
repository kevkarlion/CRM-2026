'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';

interface MaterialItem {
  item: string;
  quantity: number;
  unit: string;
}

interface VisitReportData {
  _id: string;
  workOrderId: string;
  technicianId?: string;
  arrivalTime?: string;
  departureTime?: string;
  workPerformed?: string;
  observations?: string;
  recommendations?: string;
  materialsUsed?: string;
  materialsItems?: MaterialItem[];
  needsNextVisit?: boolean;
  internalComments?: string;
  attachments?: { filename: string; url: string; type: string; uploadedAt: string }[];
  version?: number;
}

interface VisitReportFormProps {
  workOrderId: string;
  report: VisitReportData;
  onSaved: (updated: VisitReportData) => void;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-gray-900 mb-3">{children}</h3>;
}

export function VisitReportForm({ workOrderId, report, onSaved }: VisitReportFormProps) {
  const [materialsUsed, setMaterialsUsed] = useState(report.materialsUsed || '');
  const [materialsItems, setMaterialsItems] = useState<MaterialItem[]>(
    report.materialsItems?.length ? report.materialsItems : [{ item: '', quantity: 1, unit: '' }]
  );
  const [needsNextVisit, setNeedsNextVisit] = useState(report.needsNextVisit || false);
  const [internalComments, setInternalComments] = useState(report.internalComments || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function addMaterialItem() {
    setMaterialsItems((prev) => [...prev, { item: '', quantity: 1, unit: '' }]);
  }

  function removeMaterialItem(index: number) {
    setMaterialsItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateMaterialItem(index: number, field: keyof MaterialItem, value: string | number) {
    setMaterialsItems((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        materialsUsed: materialsUsed || undefined,
        materialsItems: materialsItems.filter((m) => m.item.trim()),
        needsNextVisit,
        internalComments: internalComments || undefined,
        version: report.version || 0,
      };
      const result = await api.patch<{ data: VisitReportData }>(
        `/api/operations/work-orders/${workOrderId}/report`,
        payload
      );
      onSaved(result.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // error handled by parent
    } finally {
      setSaving(false);
    }
  }

  const hasAttachments = report.attachments && report.attachments.length > 0;

  return (
    <div className="space-y-6">
      {/* Materials Section */}
      <div>
        <SectionTitle>Materiales utilizados</SectionTitle>
        <textarea
          value={materialsUsed}
          onChange={(e) => setMaterialsUsed(e.target.value)}
          placeholder="Describa los materiales utilizados en la visita..."
          rows={3}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none resize-none"
        />
      </div>

      {/* Materials Items */}
      <div>
        <SectionTitle>Ítems de materiales</SectionTitle>
        <div className="space-y-2">
          {materialsItems.map((m, idx) => (
            <div key={idx} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={m.item}
                onChange={(e) => updateMaterialItem(idx, 'item', e.target.value)}
                placeholder="Ítem"
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
              />
              <input
                type="number"
                value={m.quantity || ''}
                onChange={(e) => updateMaterialItem(idx, 'quantity', Number(e.target.value))}
                placeholder="Cant."
                min={0}
                className="w-20 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
              />
              <input
                type="text"
                value={m.unit}
                onChange={(e) => updateMaterialItem(idx, 'unit', e.target.value)}
                placeholder="Unidad"
                className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
              />
              {materialsItems.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeMaterialItem(idx)}
                  className="p-2 text-gray-400 hover:text-danger-500 transition-colors"
                  title="Eliminar ítem"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addMaterialItem}
          className="mt-2 text-sm text-brand-600 hover:text-brand-700 font-medium transition-colors"
        >
          + Agregar ítem
        </button>
      </div>

      {/* Follow-up Section */}
      <div>
        <SectionTitle>Seguimiento</SectionTitle>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={needsNextVisit}
            onChange={(e) => setNeedsNextVisit(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="text-sm text-gray-700">¿Se necesita próxima visita?</span>
        </label>
      </div>

      {/* Internal Comments */}
      <div>
        <SectionTitle>Comentarios internos</SectionTitle>
        <textarea
          value={internalComments}
          onChange={(e) => setInternalComments(e.target.value)}
          placeholder="Notas internas del equipo (no visible para el cliente)..."
          rows={3}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none resize-none"
        />
      </div>

      {/* Attachments Section (placeholder) */}
      <div>
        <SectionTitle>Archivos adjuntos</SectionTitle>
        {hasAttachments ? (
          <div className="space-y-2">
            {report.attachments!.map((att, idx) => (
              <div key={idx} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <span className="text-sm text-gray-700">{att.filename}</span>
                <span className="text-xs text-gray-400">{att.type}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">Próximamente: carga de archivos</p>
        )}
      </div>

      {/* Save Button */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
        {saved && (
          <span className="text-sm text-success-600 font-medium">Guardado correctamente</span>
        )}
      </div>
    </div>
  );
}
