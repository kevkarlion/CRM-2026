'use client';

import { useRef, useState } from 'react';
import { api } from '@/lib/api-client';

interface ClientNotesCardProps {
  notes?: string;
  clientId: string;
}

/**
 * Editable client notes card.
 *
 * Implements the `responsive-inline-edit-field` skill: explicit Empty / Edit /
 * Persisted states with guardrails (Guardar disabled on empty or unmodified,
 * no silent-save, confirmation on unsaved changes) and Mobile vs. Desktop
 * adaptation (touch targets, action placement, keyboard shortcuts).
 */
export function ClientNotesCard({ notes, clientId }: ClientNotesCardProps) {
  // persistedNotes is the card's source of truth for display. The `notes` prop
  // only initializes it (first mount). We do NOT sync from the prop afterward:
  // the parent does not refresh client.notes on save, so syncing would overwrite
  // a freshly saved local value with a stale prop and blank the card until reload.
  const [persistedNotes, setPersistedNotes] = useState(notes || '');
  const hasNotes = !!persistedNotes && persistedNotes.trim().length > 0;
  const [isEditing, setIsEditing] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const savedValueRef = useRef(notes || '');
  const isDirtyRef = useRef(false);

  function startEditing() {
    const current = persistedNotes;
    savedValueRef.current = current;
    setNotesValue(current);
    isDirtyRef.current = false;
    setConfirmDiscard(false);
    setIsEditing(true);
    // Focus the textarea on the next frame so the virtual/mobile keyboard opens.
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function cancelEditing() {
    setIsEditing(false);
    setConfirmDiscard(false);
    isDirtyRef.current = false;
  }

  function handleChange(value: string) {
    setNotesValue(value);
    isDirtyRef.current = value !== savedValueRef.current;
    // Once the user types something, a pending discard confirmation is moot.
    if (value !== savedValueRef.current) setConfirmDiscard(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.post(`/api/crm/clients/${clientId}/update-notes`, {
        notes: notesValue,
      });
      savedValueRef.current = notesValue;
      isDirtyRef.current = false;
      setPersistedNotes(notesValue);
      setIsEditing(false);
      setConfirmDiscard(false);
    } catch (error) {
      console.error('Error saving notes:', error);
    } finally {
      setSaving(false);
    }
  }

  function handleCancelPressed() {
    // Unsaved changes and text entered -> confirm before discarding.
    if (isDirtyRef.current && notesValue.trim().length > 0) {
      setConfirmDiscard(true);
      return;
    }
    // Otherwise (empty or unmodified) -> discard without saving.
    cancelEditing();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelPressed();
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      const canSave = notesValue.trim().length > 0 && isDirtyRef.current && !saving;
      if (canSave) handleSave();
    }
  }

  const canSave = notesValue.trim().length > 0 && isDirtyRef.current && !saving;

  if (confirmDiscard) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="mb-3 text-base font-semibold text-gray-900">Notas</h2>
        <p className="mb-4 text-sm text-gray-700">
          Hay cambios sin guardar. ¿Descartarlos?
        </p>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
          <button
            onClick={() => setConfirmDiscard(false)}
            className="inline-flex min-h-11 sm:min-h-0 sm:h-9 items-center justify-center px-4 sm:px-3 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            Seguir editando
          </button>
          <button
            onClick={cancelEditing}
            className="inline-flex min-h-11 sm:min-h-0 sm:h-9 items-center justify-center px-4 sm:px-3 text-sm font-medium rounded-lg bg-danger-600 text-white hover:bg-danger-700"
          >
            Descartar cambios
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h2 className="mb-3 text-base font-semibold text-gray-900">Notas</h2>

      {isEditing ? (
        <div className="space-y-3">
          <textarea
            ref={textareaRef}
            value={notesValue}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Notas del cliente"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
            rows={4}
            placeholder="Escribe notas sobre este cliente..."
          />
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
            <button
              onClick={handleCancelPressed}
              aria-label="Cancelar y cerrar"
              title="Cancelar (Esc)"
              className="inline-flex min-h-11 sm:min-h-0 sm:h-9 items-center justify-center px-4 sm:px-3 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              X
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="inline-flex min-h-11 sm:min-h-0 sm:h-9 items-center justify-center px-4 sm:px-3 text-sm font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      ) : hasNotes ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{persistedNotes}</p>
          <button
            onClick={startEditing}
            className="inline-flex min-h-11 sm:min-h-0 sm:h-9 items-center justify-center px-4 sm:px-3 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Editar
          </button>
        </div>
      ) : (
        <button
          onClick={startEditing}
          className="inline-flex min-h-11 sm:min-h-0 sm:h-9 items-center justify-center px-4 sm:px-3 text-sm font-medium rounded-lg border border-dashed border-gray-300 text-brand-600 hover:bg-brand-50"
        >
          + Agregar nota
        </button>
      )}
    </div>
  );
}