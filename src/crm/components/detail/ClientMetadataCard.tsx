'use client';

import type { ClientDetail } from './client-detail.types';
import {
  CLIENT_STATUS_DOT_COLOR,
  CLIENT_STATUS_OPTIONS,
  CLIENT_STATUS_VARIANT,
  CUSTOMER_TYPE_LABEL,
  formatLongDate,
} from './client-detail.constants';

interface ClientMetadataCardProps {
  client: ClientDetail;
}

export function ClientMetadataCard({ client }: ClientMetadataCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h2 className="mb-4 text-base font-semibold text-gray-900">Detalles</h2>

      <div className="space-y-4">
        <div>
          <dt className="text-xs font-medium text-gray-500">Estado</dt>
          <dd className="mt-1.5">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                CLIENT_STATUS_VARIANT[client.status] || 'bg-gray-100 text-gray-700'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  CLIENT_STATUS_DOT_COLOR[client.status] || 'bg-gray-400'
                }`}
              />
              {CLIENT_STATUS_OPTIONS.find((o) => o.value === client.status)?.label ||
                client.status}
            </span>
          </dd>
        </div>

        <div>
          <dt className="text-xs font-medium text-gray-500">Tipo de cliente</dt>
          <dd className="mt-0.5 text-sm text-gray-900">
            {CUSTOMER_TYPE_LABEL[client.customerType] || client.customerType}
          </dd>
        </div>

        {client.tags && client.tags.length > 0 && (
          <div>
            <dt className="text-xs font-medium text-gray-500">Etiquetas</dt>
            <dd className="mt-1.5 flex flex-wrap gap-1.5">
              {client.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-full text-xs font-medium bg-brand-50 text-brand-700"
                >
                  {tag}
                </span>
              ))}
            </dd>
          </div>
        )}

        <div>
          <dt className="text-xs font-medium text-gray-500">Creado</dt>
          <dd className="mt-0.5 text-sm text-gray-900">{formatLongDate(client.createdAt)}</dd>
        </div>
      </div>
    </div>
  );
}
