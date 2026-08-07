'use client';

import { Children, isValidElement, useCallback, useId, useMemo, useRef } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { EntityTab } from './EntityTab';
import { EntityTabPanel } from './EntityTabPanel';
import { EntityTabsContext } from './entity-tabs-context';

export interface EntityTabsProps {
  activeId: string;
  onChange: (id: string) => void;
  'aria-label': string;
  className?: string;
  children: ReactNode;
}

function isTab(child: ReactNode): child is ReactElement<unknown> {
  return isValidElement(child) && child.type === EntityTab;
}

function isPanel(child: ReactNode): child is ReactElement<unknown> {
  return isValidElement(child) && child.type === EntityTabPanel;
}

/**
 * Accessible, chrome-style tab interface (tablist + lazy panels).
 *
 * Composition (both must be direct children):
 *   <EntityTabs activeId onChange aria-label>
 *     <EntityTab id label icon count disabled />
 *     <EntityTabPanel id className>{content}</EntityTabPanel>
 *   </EntityTabs>
 *
 * Only the active panel is mounted (lazy). Keyboard navigation:
 * ArrowLeft/ArrowRight (RTL aware), Home, End.
 */
export function EntityTabs({
  activeId,
  onChange,
  'aria-label': ariaLabel,
  className,
  children,
}: EntityTabsProps) {
  const baseId = useId();
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  const registerTab = useCallback((id: string, node: HTMLButtonElement | null) => {
    if (node) {
      tabRefs.current.set(id, node);
    } else {
      tabRefs.current.delete(id);
    }
  }, []);

  const getTabIds = useCallback(() => [...tabRefs.current.keys()], []);

  const focusTab = useCallback((id: string) => {
    tabRefs.current.get(id)?.focus();
  }, []);

  const value = useMemo(
    () => ({ activeId, baseId, onChange, registerTab, getTabIds, focusTab }),
    [activeId, baseId, onChange, registerTab, getTabIds, focusTab],
  );

  const tabs = Children.toArray(children).filter(isTab);
  const panels = Children.toArray(children).filter(isPanel);

  if (tabs.length === 0) return null;

  return (
    <EntityTabsContext.Provider value={value}>
      <div className={['flex flex-col', className].filter(Boolean).join(' ')}>
        <div
          role="tablist"
          aria-label={ariaLabel}
          className="entity-tab-scroll relative flex overflow-x-auto rounded-t-xl bg-gray-100 after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-gray-200"
        >
          {tabs}
        </div>
        <div>{panels}</div>
      </div>
    </EntityTabsContext.Provider>
  );
}
