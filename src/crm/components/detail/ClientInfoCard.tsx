'use client';

import type { ReactNode } from 'react';
import type { ClientDetail } from './client-detail.types';
import { CUSTOMER_TYPE_LABEL, formatLongDate, GESTION_STATUS_LABELS, GESTION_STATUS_VARIANT, GESTION_STATUS_DOT_COLOR } from './client-detail.constants';

interface ClientInfoCardProps {
  client: ClientDetail;
}

interface InfoFieldProps {
  label: string;
  value: string;
}

function InfoField({ label, value }: InfoFieldProps) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900">{value || '—'}</dd>
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h3 className="border-b border-gray-100 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
      {children}
    </h3>
  );
}

function SectionBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

export function ClientInfoCard({ client }: ClientInfoCardProps) {
  const fullAddress = [client.address, client.locality, client.province]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h2 className="mb-4 text-base font-semibold text-gray-900">Información del Cliente</h2>

      <div className="space-y-5">
        <SectionBlock title="Identificación">
          <InfoField label="Empresa" value={client.profileName || client.companyName || ''} />
          <InfoField label="Nombre completo" value={client.fullName || ''} />
          <InfoField label="RUT / Tax ID" value={client.taxId || ''} />
          <InfoField
            label="Tipo de cliente"
            value={CUSTOMER_TYPE_LABEL[client.customerType] || client.customerType}
          />
        </SectionBlock>

        <SectionBlock title="Contacto">
          <InfoField label="Email" value={client.email || ''} />
          <InfoField label="Teléfono" value={client.phone || ''} />
        </SectionBlock>

        <SectionBlock title="Ubicación">
          <InfoField label="Dirección" value={fullAddress} />
        </SectionBlock>

        {client.activeGestion && (
          <SectionBlock title="Gestión">
            <div className="col-span-full flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${GESTION_STATUS_DOT_COLOR[client.activeGestion.status] || 'bg-gray-400'}`} />
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                  GESTION_STATUS_VARIANT[client.activeGestion.status] || 'bg-gray-50 border-gray-200 text-gray-700'
                }`}
              >
                {GESTION_STATUS_LABELS[client.activeGestion.status] || client.activeGestion.status}
              </span>
            </div>
          </SectionBlock>
        )}

        <SectionBlock title="Registro">
          <InfoField label="Creado" value={formatLongDate(client.createdAt)} />
          <InfoField label="Actualizado" value={formatLongDate(client.updatedAt)} />
        </SectionBlock>
      </div>
    </div>
  );
}
