'use client';

interface LeadSummaryNoteCardProps {
  notes?: string;
}

/** Shows the first line of the lead notes (bot summary). */
export function LeadSummaryNoteCard({ notes }: LeadSummaryNoteCardProps) {
  if (!notes) return null;

  const summaryLine = notes.split('\n')[0];

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h2 className="mb-3 text-base font-semibold text-gray-900">Resumen MSJ</h2>
      <p className="text-sm text-gray-700">{summaryLine}</p>
    </div>
  );
}
