'use client'

import type { IQuoteItem, QuoteItemType } from '@/quotes/types/quote-version'

interface ServicesCardsProps {
  items: IQuoteItem[]
}

function formatCLP(value: number): string {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value)
}

const TYPE_LABEL: Record<QuoteItemType, string> = {
  product: 'Producto',
  service: 'Servicio',
  labor: 'Mano de obra',
  material: 'Material',
  part: 'Repuesto',
}

const TYPE_COLOR: Record<QuoteItemType, string> = {
  product: 'bg-sky-600 text-white',
  service: 'bg-violet-600 text-white',
  labor: 'bg-amber-500 text-gray-900',
  material: 'bg-teal-600 text-white',
  part: 'bg-gray-700 text-white',
}

export function ServicesCards({ items }: ServicesCardsProps) {
  if (!items || items.length === 0) return null

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Servicios Cotizados</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((item, index) => (
          <div
            key={index}
            className="border border-gray-100 rounded-lg p-4 hover:border-gray-200 transition-colors"
          >
            <div className="flex justify-between items-start gap-3 mb-2">
              <div className="space-y-1 min-w-0">
                <h3 className="font-medium text-gray-900 break-words">{item.description}</h3>
                {item.type && (
                  <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLOR[item.type] || 'bg-gray-700 text-white'}`}>
                    {TYPE_LABEL[item.type] || item.type}
                  </span>
                )}
              </div>
              <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">
                {formatCLP(item.subtotal)}
              </span>
            </div>

            <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1 bg-gray-50 rounded-md px-2 py-1 text-gray-600">
                <span className="font-semibold text-gray-400">Cant:</span> {item.quantity}
              </span>
              <span className="inline-flex items-center gap-1 bg-gray-50 rounded-md px-2 py-1 text-gray-600">
                <span className="font-semibold text-gray-400">Precio:</span> {formatCLP(item.unitPrice)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
