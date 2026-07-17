'use client'

import type { PriorityInfo } from '@/quotes/types/decision-engine'

const PRIORITY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  urgent: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  high: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  medium: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  low: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  none: { bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200' },
}

interface PriorityIndicatorProps {
  priority: PriorityInfo
}

export function PriorityIndicator({ priority }: PriorityIndicatorProps) {
  const styles = PRIORITY_STYLES[priority.level] ?? PRIORITY_STYLES.none

  return (
    <div className={`${styles.bg} ${styles.border} border rounded-lg p-3`}>
      <div className={`text-sm font-medium ${styles.text}`}>
        {priority.label}
      </div>
      {priority.description && (
        <div className="text-xs text-gray-500 mt-1">
          {priority.description}
        </div>
      )}
    </div>
  )
}
