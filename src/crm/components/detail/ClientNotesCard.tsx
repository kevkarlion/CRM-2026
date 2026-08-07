'use client';

interface ClientNotesCardProps {
  notes?: string;
}

export function ClientNotesCard({ notes }: ClientNotesCardProps) {
  if (!notes) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h2 className="mb-3 text-base font-semibold text-gray-900">Notas</h2>
      <p className="text-sm text-gray-700 whitespace-pre-line">{notes}</p>
    </div>
  );
}
