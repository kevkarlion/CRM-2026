'use client';

import { forwardRef, useCallback } from 'react';
import type { KeyboardEvent, ReactNode, Ref } from 'react';
import { useEntityTabs } from './entity-tabs-context';

export interface EntityTabProps {
  id: string;
  label: string;
  icon?: ReactNode;
  count?: number;
  disabled?: boolean;
  className?: string;
}

const ACTIVE_CLASSES =
  'relative z-10 border border-gray-200 border-b-0 bg-white text-gray-900 shadow-sm';
const INACTIVE_CLASSES =
  'border-transparent text-gray-500 hover:bg-white/60 hover:text-gray-700';

export const EntityTab = forwardRef<HTMLButtonElement, EntityTabProps>(
  function EntityTab({ id, label, icon, count, disabled = false, className }, ref: Ref<HTMLButtonElement>) {
    const { activeId, baseId, onChange, registerTab, getTabIds, focusTab } = useEntityTabs();

    const active = activeId === id;
    const tabId = `${baseId}-tab-${id}`;
    const panelId = `${baseId}-panel-${id}`;

    const refCallback = useCallback(
      (node: HTMLButtonElement | null) => {
        registerTab(id, node);
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      },
      [id, ref, registerTab],
    );

    function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
      const ids = getTabIds();
      if (ids.length === 0) return;

      const index = ids.indexOf(id);
      if (index === -1) return;

      const isRTL = typeof document !== 'undefined' && document.dir === 'rtl';
      let next = -1;

      switch (event.key) {
        case 'ArrowRight':
          next = isRTL
            ? (index - 1 + ids.length) % ids.length
            : (index + 1) % ids.length;
          break;
        case 'ArrowLeft':
          next = isRTL
            ? (index + 1) % ids.length
            : (index - 1 + ids.length) % ids.length;
          break;
        case 'Home':
          next = 0;
          break;
        case 'End':
          next = ids.length - 1;
          break;
        default:
          return;
      }

      event.preventDefault();
      const targetId = ids[next];
      onChange(targetId);
      focusTab(targetId);
    }

    return (
      <button
        ref={refCallback}
        type="button"
        role="tab"
        id={tabId}
        aria-controls={panelId}
        aria-selected={active}
        aria-disabled={disabled}
        tabIndex={active ? 0 : -1}
        onClick={() => onChange(id)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={[
          'group inline-flex shrink-0 items-center gap-1.5 rounded-t-lg border px-3.5 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1',
          active ? ACTIVE_CLASSES : INACTIVE_CLASSES,
          disabled && 'cursor-not-allowed opacity-50',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {icon && <span className="shrink-0 text-current">{icon}</span>}
        <span className="whitespace-nowrap">{label}</span>
        {typeof count === 'number' && count > 0 && (
          <span
            className={[
              'inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none',
              active ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-600 group-hover:bg-gray-300',
            ].join(' ')}
          >
            {count}
          </span>
        )}
      </button>
    );
  },
);
