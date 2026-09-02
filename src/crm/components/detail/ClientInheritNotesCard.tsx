'use client';

interface ClientInheritNotesCardProps {
  inheritNotes?: string;
}

/**
 * Read-only card showing notes inherited from the lead at conversion time
 * (only the lead's private `adminNotes`, not the bot Resumen MSJ).
 * Not editable. Shows "Sin Notas" when empty.
 */
export function ClientInheritNotesCard({ inheritNotes }: ClientInheritNotesCardProps) {
  const hasNotes = !!inheritNotes && inheritNotes.trim().length > 0;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Notas Heredadas de Lead</h2>
      {hasNotes ? (
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{inheritNotes}</p>
      ) : (
        <p className="text-sm text-gray-400">Sin Notas</p>
      )}
    </div>
  );
}