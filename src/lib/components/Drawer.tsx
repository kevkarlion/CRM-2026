'use client';

import { useEffect, useRef, ReactNode } from 'react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Drawer({ isOpen, onClose, title, children, footer }: DrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        className="relative w-full max-w-lg h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 mt-12 md:mt-0"
      >
        {/* Header - Fixed at top */}
        <div className="flex items-center gap-2 px-3 py-3 border-b border-gray-200 bg-gray-50 shrink-0">
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors cursor-pointer shadow-sm"
            title="Volver"
          >
            ‹
          </button>
          <h2 className="text-sm md:text-base font-semibold text-gray-900 truncate">{title}</h2>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-4 md:px-6 py-3 md:py-4 border-t border-gray-200 bg-gray-50 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}