'use client';

interface LeadEditActionCardProps {
  onEdit: () => void;
}

export function LeadEditActionCard({ onEdit }: LeadEditActionCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
      <h3 className="text-sm font-semibold text-gray-900 mb-2">Acciones</h3>
      <button
        onClick={onEdit}
        className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors cursor-pointer"
      >
        Editar Lead
      </button>
    </div>
  );
}
