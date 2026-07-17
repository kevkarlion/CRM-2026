'use client'

import type { Action } from '@/quotes/types/decision-engine'

const VARIANT_STYLES: Record<string, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700',
  secondary: 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50',
  danger: 'bg-danger-500 text-white hover:bg-danger-600',
  ghost: 'text-gray-600 hover:bg-gray-100',
}

interface SmartActionBarProps {
  actions: Action[]
  onAction: (actionId: string) => void
  loading?: boolean
}

export function SmartActionBar({ actions, onAction, loading }: SmartActionBarProps) {
  if (actions.length === 0) return null

  return (
    <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4">
      <div className="flex flex-wrap gap-2 justify-end">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={() => onAction(action.id)}
            disabled={action.disabled || loading}
            title={action.tooltip}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${VARIANT_STYLES[action.variant]}
              ${action.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  )
}
