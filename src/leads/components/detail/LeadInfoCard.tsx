'use client';

import type { ReactNode } from 'react';
import type { LeadDetail, SaleDetail } from './lead-detail.types';
import {
  SOURCE_LABELS,
  formatCurrency,
  formatLongDate,
} from './lead-detail.constants';

interface LeadInfoCardProps {
  lead: LeadDetail;
  isConverted: boolean;
  saleDetail: SaleDetail | null;
  loadingSaleDetail: boolean;
  onViewQuote: (quoteId: string) => void;
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
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <SectionTitle>{title}</SectionTitle>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

export function LeadInfoCard({
  lead,
  isConverted,
  saleDetail,
  loadingSaleDetail,
  onViewQuote,
}: LeadInfoCardProps) {
  const fullAddress = [lead.address, lead.locality, lead.province].filter(Boolean).join(', ');

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Información del Lead</h2>
        <span className="text-xs text-gray-400">{lead.name}</span>
      </div>

      <div className="space-y-5">
        <SectionBlock title="Contacto">
          <InfoField label="Nombre" value={lead.name} />
          <InfoField label="Empresa" value={lead.profileName || lead.companyName || ''} />
          <InfoField label="Email" value={lead.email || ''} />
          <InfoField label="Teléfono" value={lead.phone || ''} />
          {fullAddress && <InfoField label="Dirección" value={fullAddress} />}
        </SectionBlock>

        <SectionBlock title="Comercial">
          <InfoField label="Origen" value={SOURCE_LABELS[lead.source] || lead.source} />
          <InfoField label="Valor Estimado" value={formatCurrency(lead.estimatedValue)} />
          <InfoField
            label="Asignado a"
            value={
              lead.assignedTo
                ? typeof lead.assignedTo === 'object'
                  ? lead.assignedTo.name
                  : lead.assignedTo
                : ''
            }
          />
        </SectionBlock>

        <SectionBlock title="Seguimiento">
          <InfoField label="Creado" value={formatLongDate(lead.createdAt)} />
          <InfoField label="Actualizado" value={formatLongDate(lead.updatedAt)} />
          {isConverted && (
            <InfoField
              label="Convertido"
              value={formatLongDate(lead.convertedAt)}
            />
          )}
        </SectionBlock>

        {isConverted && (
          <section className="space-y-3">
            <SectionTitle>Venta</SectionTitle>
            <div className="mt-3 space-y-2 text-sm">
              {lead.convertedToWorkOrder && (
                <div className="flex items-center gap-3">
                  <dt className="w-32 shrink-0 text-xs font-medium text-gray-500">OT Creada</dt>
                  <dd>
                    <a
                      href={`/work-orders/${lead.convertedToWorkOrder}`}
                      className="font-medium text-brand-600 hover:text-brand-700"
                    >
                      Ver Orden de Trabajo →
                    </a>
                  </dd>
                </div>
              )}

              {loadingSaleDetail ? (
                <div className="flex items-center gap-3">
                  <dt className="w-32 shrink-0 text-xs font-medium text-gray-500">
                    Detalle de Venta
                  </dt>
                  <dd className="text-sm text-gray-400">Cargando...</dd>
                </div>
              ) : saleDetail?.hasSale && saleDetail.quote ? (
                <div className="flex items-center gap-3">
                  <dt className="w-32 shrink-0 text-xs font-medium text-gray-500">
                    Detalle de Venta
                  </dt>
                  <dd className="flex flex-1 items-center gap-3">
                    <a
                      href={`/quotes/${saleDetail.quote._id}`}
                      className="flex-1 font-medium text-brand-600 hover:text-brand-700"
                    >
                      {saleDetail.quote.title} ({formatCurrency(saleDetail.quote.total)}) →
                    </a>
                    <button
                      onClick={() => onViewQuote(saleDetail.quote!._id)}
                      className="text-xs text-gray-500 underline hover:text-gray-700"
                    >
                      Ver
                    </button>
                  </dd>
                </div>
              ) : null}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
