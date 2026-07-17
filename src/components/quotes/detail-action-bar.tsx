'use client';

interface DetailActionBarProps {
  status: string;
  loading?: boolean;
  actionLoading?: string | null;
  onAction: (action: string) => void;
  onEdit?: () => void;
}

interface ActionBarButton {
  action: string;
  label: string;
  endpoint: string;
  style: 'primary' | 'success' | 'danger' | 'outline';
  enabled: boolean;
}

function getAvailableActions(status: string): ActionBarButton[] {
  const actions: ActionBarButton[] = [];

  actions.push({
    action: 'edit',
    label: 'Editar',
    endpoint: '',
    style: 'outline',
    enabled: false,
  });

  switch (status) {
    case 'draft':
      actions.push({
        action: 'enviar',
        label: 'Enviar',
        endpoint: '/send',
        style: 'primary',
        enabled: true,
      });
      break;
    case 'sent':
      actions.push({
        action: 'aprobar',
        label: 'Aprobar',
        endpoint: '/approve',
        style: 'success',
        enabled: true,
      });
      actions.push({
        action: 'rechazar',
        label: 'Rechazar',
        endpoint: '/reject',
        style: 'danger',
        enabled: true,
      });
      break;
    case 'approved':
      actions.push({
        action: 'convertir',
        label: 'Convertir a OT',
        endpoint: '/convert',
        style: 'primary',
        enabled: true,
      });
      break;
    case 'rejected':
    case 'expired':
    case 'cancelled':
      break;
  }

  return actions;
}

const STYLE_CLASSES: Record<string, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
  success: 'bg-green-600 text-white hover:bg-green-700',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  outline: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
};

const DISABLED_CLASSES: Record<string, string> = {
  primary: 'bg-blue-300 text-blue-100 cursor-not-allowed',
  success: 'bg-green-300 text-green-100 cursor-not-allowed',
  danger: 'bg-red-300 text-red-100 cursor-not-allowed',
  outline: 'border border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed',
};

export function DetailActionBar({
  status,
  loading = false,
  actionLoading = null,
  onAction,
  onEdit,
}: DetailActionBarProps) {
  const actions = getAvailableActions(status);

  if (actions.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white px-6 py-3 shadow-lg z-10">
      <div className="mx-auto flex max-w-7xl items-center justify-end gap-3">
        {actions.map(btn => {
          if (btn.action === 'edit') {
            return (
              <button
                key={btn.action}
                onClick={onEdit}
                disabled={loading}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${STYLE_CLASSES[btn.style]}`}
              >
                {btn.label}
              </button>
            );
          }

          const isLoading = actionLoading === btn.action;
          const disabled = loading || isLoading;

          return (
            <button
              key={btn.action}
              onClick={() => !disabled && btn.enabled && onAction(btn.action)}
              disabled={disabled || !btn.enabled}
              title={!btn.enabled ? 'Acción no disponible para este estado' : undefined}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                disabled || !btn.enabled ? DISABLED_CLASSES[btn.style] : STYLE_CLASSES[btn.style]
              }`}
            >
              {isLoading ? `${btn.label}...` : btn.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
