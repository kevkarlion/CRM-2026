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
  product: 'bg-blue-50 text-blue-700',
  service: 'bg-purple-50 text-purple-700',
  labor: 'bg-orange-50 text-orange-700',
  material: 'bg-teal-50 text-teal-700',
  part: 'bg-gray-100 text-gray-700',
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
            <div className="flex justify-between items-start mb-2">
              <div className="space-y-1">
                <h3 className="font-medium text-gray-900">{item.description}</h3>
                {item.type && (
                  <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLOR[item.type] || 'bg-gray-100 text-gray-700'}`}>
                    {TYPE_LABEL[item.type] || item.type}
                  </span>
                )}
              </div>
              <span className="text-sm font-semibold text-gray-700">
                {formatCLP(item.subtotal)}
              </span>
            </div>

            <div className="flex gap-4 text-xs text-gray-500">
              <span>Cant: {item.quantity}</span>
              <span>Precio: {formatCLP(item.unitPrice)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
