'use client';

interface LeadCommercialActionsCardProps {
  onOpenQuoteDrawer: () => void;
  onOpenVisitDrawer: () => void;
  onOpenQuickSaleDrawer: () => void;
}

/** Commercial actions for contacted leads (not yet converted). */
export function LeadCommercialActionsCard({
  onOpenQuoteDrawer,
  onOpenVisitDrawer,
  onOpenQuickSaleDrawer,
}: LeadCommercialActionsCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
      <h3 className="text-sm font-semibold text-gray-900 mb-2">Gestión Comercial</h3>

      <button
        onClick={onOpenQuoteDrawer}
        className="w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
      >
        Enviar Presupuesto
      </button>

      <button
        onClick={onOpenVisitDrawer}
        className="w-full rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors"
      >
        Programar Visita Técnica
      </button>

      <button
        onClick={onOpenQuickSaleDrawer}
        className="w-full rounded-lg bg-success-500 px-4 py-2 text-sm font-medium text-white hover:bg-success-600 transition-colors"
      >
        Confirmar Venta
      </button>
    </div>
  );
}
