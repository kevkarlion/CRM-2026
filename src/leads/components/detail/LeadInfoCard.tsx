'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';

import type { LeadDetail, SaleDetail } from './lead-detail.types';
import {
  SOURCE_LABELS,
  formatCurrency,
  formatLongDate,
} from './lead-detail.constants';
import { GESTION_STATUS_LABELS, GESTION_STATUS_VARIANT, GESTION_STATUS_DOT_COLOR } from '@/crm/components/detail';

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
  const hasValue = Boolean(value);
  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</dt>
      <dd className={`mt-0.5 text-sm font-medium break-words ${hasValue ? 'text-gray-900' : 'text-gray-400'}`}>
        {value || '—'}
      </dd>
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
      <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">{children}</dl>
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
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-900">Información del Lead</h2>
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
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                  <dt className="w-full sm:w-32 sm:shrink-0 text-[10px] font-semibold uppercase tracking-wider text-gray-400">OT Creada</dt>
                  <dd>
                    <Link
                      href={`/work-orders/${lead.convertedToWorkOrder}`}
                      className="font-medium text-brand-600 hover:text-brand-700"
                    >
                      Ver Orden de Trabajo →
                    </Link>
                  </dd>
                </div>
              )}

              {loadingSaleDetail ? (
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                  <dt className="w-full sm:w-32 sm:shrink-0 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    Detalle de Venta
                  </dt>
                  <dd className="text-sm text-gray-400">Cargando...</dd>
                </div>
              ) : saleDetail?.hasSale && saleDetail.quote ? (
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                  <dt className="w-full sm:w-32 sm:shrink-0 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    Detalle de Venta
                  </dt>
                  <dd className="flex flex-1 items-center gap-3">
                    <Link
                      href={`/quotes/${saleDetail.quote._id}`}
                      className="flex-1 font-medium text-brand-600 hover:text-brand-700"
                    >
                      {saleDetail.quote.title} ({formatCurrency(saleDetail.quote.total)}) →
                    </Link>
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
