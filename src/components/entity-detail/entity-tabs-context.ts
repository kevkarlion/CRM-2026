'use client';

import { createContext, useContext } from 'react';

export interface EntityTabsContextValue {
  activeId: string;
  baseId: string;
  onChange: (id: string) => void;
  registerTab: (id: string, node: HTMLButtonElement | null) => void;
  getTabIds: () => string[];
  focusTab: (id: string) => void;
}

export const EntityTabsContext = createContext<EntityTabsContextValue | null>(null);

export function useEntityTabs(): EntityTabsContextValue {
  const ctx = useContext(EntityTabsContext);
  if (!ctx) {
    throw new Error('useEntityTabs must be used within an <EntityTabs>');
  }
  return ctx;
}
