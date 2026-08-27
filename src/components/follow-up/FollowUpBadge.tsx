'use client';

import React from 'react';
import type { FollowUpMark } from '@/leads/pipeline-board/hooks/useFollowUpMarks';

interface FollowUpBadgeProps {
  mark?: FollowUpMark;
  size?: 'sm' | 'md';
  showTooltip?: boolean;
  onClick?: () => void;
}

export function FollowUpBadge({ mark, size = 'sm', showTooltip = true, onClick }: FollowUpBadgeProps) {
  if (!mark) return null;

  const sizeClasses = size === 'sm' 
    ? 'w-4 h-4 text-[10px]' 
    : 'w-5 h-5 text-xs';

  const content = (
    <span
      className={`
        inline-flex items-center justify-center rounded-full bg-amber-100 text-amber-700 
        border border-amber-200 font-medium ${sizeClasses}
        ${onClick ? 'cursor-pointer hover:bg-amber-200 transition-colors' : ''}
      `}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      title={showTooltip && mark.note ? `Seguimiento: ${mark.note}` : 'Marcado para seguimiento'}
    >
      👁️
    </span>
  );

  return content;
}
