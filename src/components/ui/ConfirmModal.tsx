'use client';

import { useState } from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      bg: 'bg-danger-50',
      border: 'border-danger-200',
      icon: '🗑️',
      confirmBtn: 'bg-danger-500 hover:bg-danger-600 text-white',
    },
    warning: {
      bg: 'bg-warning-50',
      border: 'border-warning-200',
      icon: '⚠️',
      confirmBtn: 'bg-warning-500 hover:bg-warning-600 text-white',
    },
    info: {
      bg: 'bg-info-50',
      border: 'border-info-200',
      icon: 'ℹ️',
      confirmBtn: 'bg-info-500 hover:bg-info-600 text-white',
    },
  };

  const style = variantStyles[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40" 
        onClick={onCancel}
      />
      
      {/* Modal */}
      <div className={`relative ${style.bg} border ${style.border} rounded-xl p-6 w-full max-w-md mx-4 shadow-xl`}>
        <div className="flex items-start gap-4">
          <div className="text-3xl">{style.icon}</div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {title}
            </h3>
            <p className="text-sm text-gray-600">
              {message}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-lg transition-colors cursor-pointer ${style.confirmBtn}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// Hook para usar confirm modales
export function useConfirmModal() {
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  } | null>(null);

  const confirm = (
    options: {
      title: string;
      message: string;
      confirmLabel?: string;
      cancelLabel?: string;
      variant?: 'danger' | 'warning' | 'info';
    },
    onConfirm: () => void
  ) => {
    setModalConfig({
      isOpen: true,
      ...options,
      onConfirm: () => {
        onConfirm();
        setModalConfig(null);
      },
    });
  };

  const close = () => {
    setModalConfig(null);
  };

  const Modal = modalConfig ? (
    <ConfirmModal
      isOpen={modalConfig.isOpen}
      title={modalConfig.title}
      message={modalConfig.message}
      confirmLabel={modalConfig.confirmLabel}
      cancelLabel={modalConfig.cancelLabel}
      variant={modalConfig.variant}
      onConfirm={modalConfig.onConfirm}
      onCancel={close}
    />
  ) : null;

  return { confirm, Modal };
}
