'use client';

import { useState } from 'react';
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
}: WorkCompletionFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state - default sensible values
  const [result, setResult] = useState<WorkResult>('Reparación completada');
  const [workPerformed, setWorkPerformed] = useState<WorkPerformed[]>([]);
  const [workPerformedOther, setWorkPerformedOther] = useState('');
  const [hasObservations, setHasObservations] = useState(false);
  const [observationsText, setObservationsText] = useState('');
  const [hasAdditionalIssues, setHasAdditionalIssues] = useState(false);
  const [additionalIssues, setAdditionalIssues] = useState<AdditionalIssue[]>([]);
  const [additionalIssuesText, setAdditionalIssuesText] = useState('');
  const [nextVisitRecommendation, setNextVisitRecommendation] = useState<NextVisitRecommendation>('No');

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

  async function handleSubmit() {
    if (!result) {
      setError('Debe seleccionar un resultado');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const endpoint = workOrderId
        ? `/api/operations/work-orders/${workOrderId}/complete`
        : `/api/operations/technical-visits/${technicalVisitId}/complete`;

      await api.post(endpoint, {
        result,
        workPerformed: workPerformed.length > 0 ? workPerformed : undefined,
        workPerformedOther: workPerformedOther.trim() || undefined,
        hasObservations,
        observationsText: hasObservations ? observationsText.trim() : undefined,
        hasAdditionalIssues,
        additionalIssues: hasAdditionalIssues && additionalIssues.length > 0 ? additionalIssues : undefined,
        additionalIssuesText: hasAdditionalIssues && additionalIssues.includes('Otro') ? additionalIssuesText.trim() : undefined,
        nextVisitRecommendation: nextVisitRecommendation !== 'No' ? nextVisitRecommendation : undefined,
      });

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
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

      {/* Action buttons */}
      <div className="flex gap-3 pt-4 border-t border-gray-200">
        <button
          onClick={onCancel}
          disabled={submitting}
          className="flex-1 py-3 px-4 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors min-h-[48px]"
        >
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || !result}
          className="flex-1 py-3 px-4 rounded-lg bg-brand-600 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors min-h-[48px]"
        >
          {submitting ? 'Guardando...' : 'Finalizar Servicio'}
        </button>
      </div>
    </div>
  );
}