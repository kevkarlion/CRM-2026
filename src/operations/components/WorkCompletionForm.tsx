'use client';

import { useEffect, useState } from 'react';
import { api, unwrapData } from '@/lib/api-client';

// Type definitions matching the API
export type WorkResult =
  | 'Reparación completada'
  | 'Instalación completada'
  | 'Mantenimiento realizado'
  | 'Reparación parcial'
  | 'No fue posible completar el trabajo'
  | 'Requiere nueva visita';

export type WorkPerformed =
  | 'Limpieza'
  | 'Cambio de filtro'
  | 'Carga de refrigerante'
  | 'Reparación eléctrica'
  | 'Reparación mecánica'
  | 'Cambio de componente'
  | 'Instalación'
  | 'Diagnóstico'
  | 'Configuración'
  | 'Pruebas de funcionamiento';

export type AdditionalIssue =
  | 'Pérdida de refrigerante'
  | 'Instalación deficiente'
  | 'Problema eléctrico'
  | 'Problema mecánico'
  | 'Equipo muy deteriorado'
  | 'Otro';

export type NextVisitRecommendation =
  | 'No'
  | 'Sí urgente'
  | 'Sí dentro de 30 días'
  | 'Sí dentro de 3 meses'
  | 'Sí dentro de 6 meses'
  | 'Sí dentro de 1 año';

// Form data structure
export interface MaterialItem {
  item: string;
  quantity: number;
  unit: string;
}

export interface WorkCompletionFormData {
  result: WorkResult;
  workPerformed: WorkPerformed[];
  workPerformedOther?: string;
  hasObservations: boolean;
  observationsText?: string;
  hasAdditionalIssues: boolean;
  additionalIssues?: AdditionalIssue[];
  additionalIssuesText?: string;
  nextVisitRecommendation?: NextVisitRecommendation;
}

interface WorkCompletionFormProps {
  workOrderId?: string;
  technicalVisitId?: string;
  onSuccess: () => void;
  onCancel: () => void;
  /** 'create' (default) va al endpoint /complete. 'edit' va al PATCH del work-report. */
  mode?: 'create' | 'edit';
  /** En modo edit: datos existentes del informe a precargar (NO se borran). */
  initialData?: Partial<WorkCompletionFormData> & {
    internalComments?: string;
    materialsItems?: MaterialItem[];
  };
  /** Version del informe (OCC), requerida en modo edit. */
  version?: number;
}

// Options as arrays for rendering
const RESULT_OPTIONS: WorkResult[] = [
  'Reparación completada',
  'Instalación completada',
  'Mantenimiento realizado',
  'Reparación parcial',
  'No fue posible completar el trabajo',
  'Requiere nueva visita',
];

const WORK_PERFORMED_OPTIONS: WorkPerformed[] = [
  'Limpieza',
  'Cambio de filtro',
  'Carga de refrigerante',
  'Reparación eléctrica',
  'Reparación mecánica',
  'Cambio de componente',
  'Instalación',
  'Diagnóstico',
  'Configuración',
  'Pruebas de funcionamiento',
];

const ADDITIONAL_ISSUE_OPTIONS: AdditionalIssue[] = [
  'Pérdida de refrigerante',
  'Instalación deficiente',
  'Problema eléctrico',
  'Problema mecánico',
  'Equipo muy deteriorado',
  'Otro',
];

const NEXT_VISIT_OPTIONS: NextVisitRecommendation[] = [
  'No',
  'Sí urgente',
  'Sí dentro de 30 días',
  'Sí dentro de 3 meses',
  'Sí dentro de 6 meses',
  'Sí dentro de 1 año',
];

export function WorkCompletionForm({
  workOrderId,
  technicalVisitId,
  onSuccess,
  onCancel,
  mode = 'create',
  initialData,
  version,
}: WorkCompletionFormProps) {
  useEffect(() => {
    try {
      console.log('[WorkCompletionForm] mounted. mode:', mode, 'version:', version, 'workOrderId:', workOrderId, 'initialData:', initialData);
    } catch (e) {
      console.error('[WorkCompletionForm] error al montar:', e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = mode === 'edit';

  // Form state - en modo edit se precarga la info existente (NO se borra nada).
  const [result, setResult] = useState<WorkResult>(initialData?.result || 'Reparación completada');
  const [workPerformed, setWorkPerformed] = useState<WorkPerformed[]>(initialData?.workPerformed || []);
  const [workPerformedOther, setWorkPerformedOther] = useState(initialData?.workPerformedOther || '');
  const [hasObservations, setHasObservations] = useState(initialData?.hasObservations ?? false);
  const [observationsText, setObservationsText] = useState(initialData?.observationsText || '');
  const [hasAdditionalIssues, setHasAdditionalIssues] = useState(initialData?.hasAdditionalIssues ?? false);
  const [additionalIssues, setAdditionalIssues] = useState<AdditionalIssue[]>(initialData?.additionalIssues || []);
  const [additionalIssuesText, setAdditionalIssuesText] = useState(initialData?.additionalIssuesText || '');
  const [nextVisitRecommendation, setNextVisitRecommendation] = useState<NextVisitRecommendation>(
    (initialData?.nextVisitRecommendation as NextVisitRecommendation) || 'No'
  );
  const [internalComments, setInternalComments] = useState(initialData?.internalComments || '');
  const [materialsItems, setMaterialsItems] = useState<MaterialItem[]>(initialData?.materialsItems || []);
  const [materialItem, setMaterialItem] = useState('');
  const [materialQty, setMaterialQty] = useState(1);
  const [materialUnit, setMaterialUnit] = useState('');

  function toggleWorkPerformed(item: WorkPerformed) {
    setWorkPerformed((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  }

  function toggleAdditionalIssue(item: AdditionalIssue) {
    setAdditionalIssues((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  }

  // Materiales usados (editables en modo edición)
  function addMaterial() {
    const item = materialItem.trim();
    if (!item) return;
    setMaterialsItems((prev) => [
      ...prev,
      { item, quantity: materialQty || 1, unit: materialUnit.trim() || 'unidad' },
    ]);
    setMaterialItem('');
    setMaterialQty(1);
    setMaterialUnit('');
  }

  function removeMaterial(index: number) {
    setMaterialsItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!result) {
      setError('Debe seleccionar un resultado');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        result,
        workPerformed: workPerformed.length > 0 ? workPerformed : undefined,
        workPerformedOther: workPerformedOther.trim() || undefined,
        hasObservations,
        observationsText: hasObservations ? observationsText.trim() : undefined,
        hasAdditionalIssues,
        additionalIssues: hasAdditionalIssues && additionalIssues.length > 0 ? additionalIssues : undefined,
        additionalIssuesText: hasAdditionalIssues && additionalIssues.includes('Otro') ? additionalIssuesText.trim() : undefined,
        nextVisitRecommendation: nextVisitRecommendation !== 'No' ? nextVisitRecommendation : undefined,
      };

      if (isEdit) {
        // En modo edición se mandan también comentarios internos y materiales (editables).
        payload.internalComments = internalComments.trim() || undefined;
        payload.materialsItems = materialsItems.length > 0 ? materialsItems : undefined;
        payload.version = version;

        const endpoint = workOrderId
          ? `/api/operations/work-orders/${workOrderId}/work-report`
          : `/api/operations/technical-visits/${technicalVisitId}/work-report`;

        await api.patch(endpoint, payload);
      } else {
        const endpoint = workOrderId
          ? `/api/operations/work-orders/${workOrderId}/complete`
          : `/api/operations/technical-visits/${technicalVisitId}/complete`;

        await api.post(endpoint, payload);
      }

      onSuccess();
    } catch (err) {
      console.error('[WorkCompletionForm] Error al guardar el informe:', err);
      setError('No pudimos guardar el informe. Por favor, intente de nuevo en unos segundos.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Error message */}
      {error && (
        <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {error}
        </div>
      )}

      {/* Result - Required, radio buttons for speed */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-3">
          Resultado del servicio <span className="text-danger-500">*</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {RESULT_OPTIONS.map((option) => (
            <label
              key={option}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all min-h-[48px] ${
                result === option
                  ? 'border-brand-500 bg-brand-50 text-brand-900'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="result"
                value={option}
                checked={result === option}
                onChange={() => setResult(option)}
                className="w-4 h-4 text-brand-600 border-gray-300 focus:ring-brand-500"
              />
              <span className="text-sm font-medium">{option}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Work Performed - Checkboxes */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-3">
          Trabajos realizados
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {WORK_PERFORMED_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => toggleWorkPerformed(option)}
              className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm font-medium transition-all min-h-[44px] ${
                workPerformed.includes(option)
                  ? 'border-brand-500 bg-brand-50 text-brand-900'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700'
              }`}
            >
              <span className={`w-4 h-4 rounded border flex items-center justify-center ${
                workPerformed.includes(option)
                  ? 'bg-brand-500 border-brand-500'
                  : 'border-gray-300'
              }`}>
                {workPerformed.includes(option) && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              {option}
            </button>
          ))}
        </div>
      </div>

      {/* Observations - Yes/No + conditional textarea */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-3">
          ¿Tiene observaciones importantes?
        </label>
        <div className="flex gap-3 mb-3">
          <button
            type="button"
            onClick={() => {
              setHasObservations(true);
              if (!observationsText) setObservationsText('');
            }}
            className={`flex-1 py-3 px-4 rounded-lg border text-sm font-medium transition-all min-h-[44px] ${
              hasObservations
                ? 'border-brand-500 bg-brand-50 text-brand-900'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700'
            }`}
          >
            Sí
          </button>
          <button
            type="button"
            onClick={() => {
              setHasObservations(false);
              setObservationsText('');
            }}
            className={`flex-1 py-3 px-4 rounded-lg border text-sm font-medium transition-all min-h-[44px] ${
              !hasObservations
                ? 'border-brand-500 bg-brand-50 text-brand-900'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700'
            }`}
          >
            No
          </button>
        </div>
        {hasObservations && (
          <>
            <textarea
              value={observationsText}
              onChange={(e) => setObservationsText(e.target.value)}
              placeholder="Describa las observaciones importantes..."
              rows={3}
              maxLength={5000}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none resize-none"
            />
            <p className="text-xs text-gray-400 text-right mt-1">{observationsText.length}/5000</p>
          </>
        )}
      </div>

      {/* Additional Issues - Yes/No + conditional dropdown */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-3">
          ¿Hay problemas adicionales?
        </label>
        <div className="flex gap-3 mb-3">
          <button
            type="button"
            onClick={() => {
              setHasAdditionalIssues(true);
              if (additionalIssues.length === 0) setAdditionalIssues(['Pérdida de refrigerante']);
            }}
            className={`flex-1 py-3 px-4 rounded-lg border text-sm font-medium transition-all min-h-[44px] ${
              hasAdditionalIssues
                ? 'border-brand-500 bg-brand-50 text-brand-900'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700'
            }`}
          >
            Sí
          </button>
          <button
            type="button"
            onClick={() => {
              setHasAdditionalIssues(false);
              setAdditionalIssues([]);
              setAdditionalIssuesText('');
            }}
            className={`flex-1 py-3 px-4 rounded-lg border text-sm font-medium transition-all min-h-[44px] ${
              !hasAdditionalIssues
                ? 'border-brand-500 bg-brand-50 text-brand-900'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700'
            }`}
          >
            No
          </button>
        </div>
        {hasAdditionalIssues && (
          <>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {ADDITIONAL_ISSUE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => toggleAdditionalIssue(option)}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm font-medium transition-all min-h-[44px] ${
                    additionalIssues.includes(option)
                      ? 'border-brand-500 bg-brand-50 text-brand-900'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <span className={`w-4 h-4 rounded border flex items-center justify-center ${
                    additionalIssues.includes(option)
                      ? 'bg-brand-500 border-brand-500'
                      : 'border-gray-300'
                  }`}>
                    {additionalIssues.includes(option) && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  {option}
                </button>
              ))}
            </div>
            {additionalIssues.includes('Otro') && (
              <>
                <textarea
                  value={additionalIssuesText}
                  onChange={(e) => setAdditionalIssuesText(e.target.value)}
                  placeholder="Especifique el otro problema..."
                  rows={2}
                  maxLength={5000}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none resize-none"
                />
                <p className="text-xs text-gray-400 text-right mt-1">{additionalIssuesText.length}/5000</p>
              </>
            )}
          </>
        )}
      </div>

      {/* Next Visit Recommendation - Dropdown */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-3">
          ¿Recomendación de nueva visita?
        </label>
        <select
          value={nextVisitRecommendation}
          onChange={(e) => setNextVisitRecommendation(e.target.value as NextVisitRecommendation)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none bg-white min-h-[48px]"
        >
          {NEXT_VISIT_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      {/* Comentarios internos y materiales - solo en modo edicion (el tecnico puede ajustar lo cargado) */}
      {isEdit && (
        <>
          {/* Internal comments */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Comentarios internos
            </label>
            <textarea
              value={internalComments}
              onChange={(e) => setInternalComments(e.target.value)}
              placeholder="Comentarios para el equipo interno (opcional)"
              rows={3}
              maxLength={5000}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none resize-none"
            />
            <p className="text-xs text-gray-400 text-right mt-1">{internalComments.length}/5000</p>
          </div>

          {/* Materials used */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Materiales utilizados
            </label>

            {materialsItems.length > 0 && (
              <ul className="space-y-2 mb-3">
                {materialsItems.map((m, index) => (
                  <li key={index} className="flex items-center justify-between gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                    <span className="text-sm text-gray-800">
                      {m.quantity} {m.unit} — {m.item}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeMaterial(index)}
                      className="text-xs font-medium text-danger-600 hover:text-danger-800"
                    >
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap gap-2 items-center">
              <input
                value={materialItem}
                onChange={(e) => setMaterialItem(e.target.value)}
                placeholder="Material / repuesto"
                className="flex-1 min-w-[140px] rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
              />
              <input
                value={materialQty}
                onChange={(e) => setMaterialQty(Number(e.target.value))}
                type="number"
                min={1}
                placeholder="Cant."
                className="w-20 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
              />
              <input
                value={materialUnit}
                onChange={(e) => setMaterialUnit(e.target.value)}
                placeholder="Unidad"
                className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
              />
              <button
                type="button"
                onClick={addMaterial}
                className="px-4 py-2 rounded-lg bg-brand-600 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
              >
                + Agregar
              </button>
            </div>
          </div>
        </>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 pt-4 border-t border-gray-200">
        <button
          onClick={onCancel}
          disabled={submitting}
          className="flex-1 py-4 px-4 rounded-xl border border-gray-300 text-base font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || !result}
          className="flex-1 py-4 px-4 rounded-xl bg-brand-600 text-base font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Guardando...' : isEdit ? '✓ Guardar Cambios' : '✓ Finalizar Servicio'}
        </button>
      </div>
    </div>
  );
}