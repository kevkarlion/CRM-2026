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
    <div className="fixed inset-0 z-[60] flex">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Drawer panel - full screen on mobile, side drawer on desktop */}
      <div
        ref={drawerRef}
        className="fixed right-0 top-14 bottom-0 w-full max-w-lg bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-200 bg-gray-50 shrink-0">
          <button
            onClick={onClose}
            className="flex items-center justify-center w-10 h-10 text-xl font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors cursor-pointer shadow-sm"
            title="Cerrar"
          >
            ✕
          </button>
          <h2 className="text-lg font-semibold text-gray-900 truncate flex-1">{title}</h2>
        </div>

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto px-4 py-4 pb-20">
          {children}
        </div>

        {/* Footer - fixed at bottom */}
        {footer && (
          <div className="absolute bottom-0 left-0 right-0 px-4 py-4 border-t border-gray-200 bg-gray-50">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
