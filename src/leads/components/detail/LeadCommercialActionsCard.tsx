'use client';

interface LeadCommercialActionsCardProps {
  onOpenQuoteDrawer: () => void;
  onOpenVisitDrawer: () => void;
  onOpenQuickSaleDrawer: () => void;
  disabled?: boolean;
}

/** Commercial actions for contacted leads (not yet converted). */
export function LeadCommercialActionsCard({
  onOpenQuoteDrawer,
  onOpenVisitDrawer,
  onOpenQuickSaleDrawer,
  disabled = false,
}: LeadCommercialActionsCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
      <h3 className="text-sm font-semibold text-gray-900 mb-2">Gestión Comercial</h3>

      {disabled && (
        <div className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">
          Cliente bloqueado — no puede operar
        </div>
      )}

      <button
        onClick={onOpenQuoteDrawer}
        disabled={disabled}
        className="w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-purple-600"
      >
        Enviar Presupuesto
      </button>

      <button
        onClick={onOpenVisitDrawer}
        disabled={disabled}
        className="w-full rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-orange-500"
      >
        Programar Visita Técnica
      </button>

      <button
        onClick={onOpenQuickSaleDrawer}
        disabled={disabled}
        className="w-full rounded-lg bg-success-500 px-4 py-2 text-sm font-medium text-white hover:bg-success-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-success-500"
      >
        Confirmar Venta
      </button>
    </div>
  );
}
