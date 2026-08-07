'use client';

import { useState } from 'react';

interface LeadAdminNotesCardProps {
  notes?: string;
  onSave: (value: string) => Promise<void> | void;
}

/** Editable private administrator notes card. */
export function LeadAdminNotesCard({ notes, onSave }: LeadAdminNotesCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const [saving, setSaving] = useState(false);

  function startEditing() {
    setNotesValue(notes || '');
    setIsEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(notesValue);
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving notes:', error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h2 className="mb-3 text-base font-semibold text-gray-900">Notas</h2>
      {isEditing ? (
        <div className="space-y-3">
          <textarea
            value={notesValue}
            onChange={(e) => setNotesValue(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
            rows={4}
            placeholder="Notas privadas del administrador..."
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div onClick={startEditing} className="cursor-pointer -m-2 rounded-lg p-2 hover:bg-gray-50">
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {notes || 'Haz clic para agregar notas...'}
          </p>
        </div>
      )}
    </div>
  );
}
