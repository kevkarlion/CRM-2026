'use client';

import type { ReactNode } from 'react';
import { useEntityTabs } from './entity-tabs-context';

export interface EntityTabPanelProps {
  id: string;
  children: ReactNode;
  className?: string;
}

export function EntityTabPanel({ id, children, className }: EntityTabPanelProps) {
  const { activeId, baseId } = useEntityTabs();
  const active = activeId === id;

  // Lazy mount: only the active panel is rendered. Inactive panels produce
  // no DOM and run no effects until activated.
  if (!active) return null;

  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${id}`}
      aria-labelledby={`${baseId}-tab-${id}`}
      tabIndex={0}
      className={['entity-panel-in bg-white p-3 md:p-5 outline-none', className].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  );
}
