'use client';

import { formatDateShort } from '@/lib/format-date';
import { VersionHistory } from './version-history';

interface QuoteItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface QuoteVersion {
  _id: string;
  version: number;
  items: QuoteItem[];
  title?: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  createdAt: string;
}

interface DetailInfoPanelProps {
  quote: any;
  currentVersion: any;
  versions: any[];
  versionsLoading: boolean;
  onToggleVersions: () => void;
  showVersions: boolean;
}

function formatCLP(value: number): string {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);
}

function formatDate(dateStr: string): string {
  return formatDateShort(dateStr);
}

function clientDisplayName(quote: any): string {
  if (!quote.clientId) return '—';
  if (typeof quote.clientId === 'object' && quote.clientId !== null) {
    return quote.clientId.companyName || quote.clientId.fullName || '—';
  }
  return quote.clientId;
}

function clientContactName(quote: any): string {
  if (!quote.clientId || typeof quote.clientId === 'object') return '—';
  return quote.clientId;
}

function clientEmail(quote: any): string {
  if (!quote.clientId || typeof quote.clientId !== 'object' || !quote.clientId) return '—';
  return quote.clientId.email || '—';
}

function clientPhone(quote: any): string {
  if (!quote.clientId || typeof quote.clientId !== 'object' || !quote.clientId) return '—';
  return quote.clientId.phone || '—';
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center py-3 border-b border-gray-100 last:border-0">
      <dt className="text-sm font-medium text-gray-500 sm:w-44 shrink-0">{label}</dt>
      <dd className="text-sm text-gray-900 mt-0.5 sm:mt-0">{value || '—'}</dd>
    </div>
  );
}

export function DetailInfoPanel({
  quote,
  currentVersion,
  versions,
  versionsLoading,
  onToggleVersions,
  showVersions,
}: DetailInfoPanelProps) {
  const items: QuoteItem[] = currentVersion?.items || [];
  const subtotal = quote.subtotal ?? 0;
  const taxAmount = quote.taxAmount ?? 0;
  const total = quote.total ?? 0;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Información</h2>
        <dl className="divide-y divide-gray-100">
          <DetailRow label="# Cotización" value={quote.number} />
          <DetailRow label="Cliente" value={clientDisplayName(quote)} />
          <DetailRow label="Email" value={clientEmail(quote)} />
          <DetailRow label="Teléfono" value={clientPhone(quote)} />
          <DetailRow label="Creado" value={quote.createdAt ? formatDate(quote.createdAt) : '—'} />
          <DetailRow label="Válido Hasta" value={quote.validUntil ? formatDate(quote.validUntil) : '—'} />
          {quote.sentAt && <DetailRow label="Enviado" value={formatDate(quote.sentAt)} />}
          {quote.approvedAt && <DetailRow label="Aprobado" value={formatDate(quote.approvedAt)} />}
        </dl>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Items</h2>
        {items.length === 0 ? (
          <p className="text-sm text-gray-500">Sin items</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-2 font-semibold text-gray-600">#</th>
                  <th className="text-left px-4 py-2 font-semibold text-gray-600">Descripción</th>
                  <th className="text-right px-4 py-2 font-semibold text-gray-600">Cantidad</th>
                  <th className="text-right px-4 py-2 font-semibold text-gray-600">Precio Unit.</th>
                  <th className="text-right px-4 py-2 font-semibold text-gray-600">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 text-gray-400">{index + 1}</td>
                    <td className="px-4 py-3 text-gray-900">{item.description}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{item.quantity}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{formatCLP(item.unitPrice)}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCLP(item.quantity * item.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-gray-200 mt-4 pt-4 space-y-1 text-sm">
          <div className="flex justify-between text-gray-500">
            <span>Subtotal</span>
            <span>{formatCLP(subtotal)}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>IVA (19%)</span>
            <span>{formatCLP(taxAmount)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold text-gray-900">
            <span>Total</span>
            <span>{formatCLP(total)}</span>
          </div>
        </div>
      </div>

      {quote.notes && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Notas</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{quote.notes}</p>
        </div>
      )}

      <VersionHistory
        versions={versions}
        loading={versionsLoading}
        showVersions={showVersions}
        onToggle={onToggleVersions}
      />
    </div>
  );
}
