'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';

interface ClientNotesCardProps {
  notes?: string;
  clientId: string;
}

export function ClientNotesCard({ notes, clientId }: ClientNotesCardProps) {
  const [localNotes, setLocalNotes] = useState(notes || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sincronizar cuando cambia la prop
  useEffect(() => {
    setLocalNotes(notes || '');
  }, [notes]);

  const handleSave = async () => {
    if (localNotes === notes) return;
    
    setSaving(true);
    try {
      await api.post(`/api/crm/clients/${clientId}/update-notes`, {
        notes: localNotes,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Error saving notes:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 min-h-[200px]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Notas</h2>
        {saved && (
          <span className="text-xs text-green-600 font-medium">✓ Guardado</span>
        )}
      </div>
      
      <textarea
        value={localNotes}
        onChange={(e) => setLocalNotes(e.target.value)}
        onBlur={handleSave}
        placeholder="Escribe notas sobre este cliente..."
        className="w-full h-40 p-4 text-sm text-gray-700 border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        disabled={saving}
      />
      
      <p className="text-xs text-gray-400 mt-3">
        Las notas se guardan automáticamente al perder el foco
      </p>
    </div>
  );
}