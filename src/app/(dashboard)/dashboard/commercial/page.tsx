// ── Commercial / Sales — pipeline de ventas completo ───────

'use client';

import { useEffect, useState } from 'react';
import { MetricCard, KpiGrid, SectionHeader } from '@/dashboard/components';
import { DateRangePicker } from '@/dashboard/components/DateRangePicker';
import { fetchSummary, fetchCommercial, fetchContracts } from '@/dashboard/services/client-index';
import type { SummaryResponse, CommercialResponse, ContractsResponse } from '@/dashboard/types/metrics';

export default function CommercialPage() {
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [commercial, setCommercial] = useState<CommercialResponse | null>(null);
  const [contracts, setContracts] = useState<ContractsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [s, co, ct] = await Promise.all([
          fetchSummary(),
          fetchCommercial(),
          fetchContracts(),
        ]);
        setSummary(s);
        setCommercial(co);
        setContracts(ct);
      } catch {
        // handled by empty state
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const totalLeads = commercial ? commercial.leadsByStage.reduce((a, b) => a + b.count, 0) : 0;
  const totalQuotes = commercial ? commercial.quotesByStatus.reduce((a, b) => a + b.count, 0) : 0;
  const approvalRate = commercial && commercial.quotesByStatus.length > 0
    ? commercial.quotesByStatus.reduce((a, b) => a + b.count, 0) > 0
      ? Math.round(
          (commercial.quotesByStatus.find((q) => q.status === 'approved')?.count ?? 0)
          / Math.max(
            commercial.quotesByStatus.filter((q) => q.status !== 'draft').reduce((a, b) => a + b.count, 0),
            1
          ) * 100
        )
      : 0
    : 0;

  const colorMap: Record<string, string> = {
    draft: 'bg-gray-400',
    sent: 'bg-brand-400',
    approved: 'bg-success-500',
    rejected: 'bg-danger-500',
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Panel Comercial</h1>
          <p className="text-sm text-gray-500 mt-1">Pipeline de ventas, leads y cotizaciones</p>
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* ─── KPIs Rápidos ─── */}
      <section>
        <SectionHeader title="Snapshot Comercial" subtitle="Métricas principales del pipeline" />
        <KpiGrid>
          <MetricCard label="Leads Activos" value={commercial?.totalActiveLeads ?? '-'} loading={loading} />
          <MetricCard label="Nuevos este Mes" value={commercial?.newLeadsThisMonth ?? '-'} loading={loading}
            trend={commercial && commercial.newLeadsThisMonth > 0 ? { direction: 'up', label: 'Nuevos' } : undefined} />
          <MetricCard label="Convertidos" value={commercial?.convertedThisMonth ?? '-'} loading={loading} />
          <MetricCard label="Tasa Conversión" value={`${commercial?.conversionRate ?? 0}%`} loading={loading}
            trend={(commercial?.conversionRate ?? 0) < 25 ? { direction: 'down', label: 'Baja' } : undefined} />
          <MetricCard label="Pipeline Total" value={summary?.quotes.totalEstimatedValue ? `$${(summary.quotes.totalEstimatedValue / 1000).toFixed(0)}k` : '-'} loading={loading} />
          <MetricCard label="Clientes" value={summary?.clients.total ?? '-'} loading={loading} />
        </KpiGrid>
      </section>

      {/* ─── Leads: desglose por etapa ─── */}
      <section>
        <SectionHeader title="Leads por Etapa" subtitle={`${totalLeads} leads en pipeline — distribución`} />
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          {commercial && commercial.leadsByStage.length > 0 ? (
            <div className="space-y-4">
              {commercial.leadsByStage.map((stage) => {
                const pct = totalLeads > 0 ? Math.round((stage.count / totalLeads) * 100) : 0;
                return (
                  <div key={stage.stage}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="capitalize font-medium text-gray-700">
                        {stage.stage === 'contacted' ? 'Contactados' :
                         stage.stage === 'qualified' ? 'Calificados' :
                         stage.stage === 'won' ? 'Ganados' :
                         stage.stage === 'lost' ? 'Perdidos' :
                         stage.stage}
                      </span>
                      <span className="text-gray-500">{stage.count} leads ({pct}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full ${stage.stage === 'won' ? 'bg-success-500' : stage.stage === 'lost' ? 'bg-danger-500' : stage.stage === 'qualified' ? 'bg-brand-500' : 'bg-gray-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-6">Sin leads en pipeline</p>
          )}
        </div>
      </section>

      {/* ─── Cotizaciones ─── */}
      <section>
        <SectionHeader title="Cotizaciones" subtitle={`${totalQuotes} cotizaciones — estado actual`} />
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          {commercial && commercial.quotesByStatus.length > 0 ? (
            <div className="space-y-4">
              {commercial.quotesByStatus.map((q) => {
                const pct = totalQuotes > 0 ? Math.round((q.count / totalQuotes) * 100) : 0;
                return (
                  <div key={q.status}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="capitalize font-medium text-gray-700">
                        {q.status === 'draft' ? 'Borrador' :
                         q.status === 'sent' ? 'Enviadas' :
                         q.status === 'approved' ? 'Aprobadas' :
                         q.status === 'rejected' ? 'Rechazadas' :
                         q.status}
                      </span>
                      <span className="text-gray-500">{q.count} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5">
                      <div className={`h-2.5 rounded-full ${colorMap[q.status] || 'bg-gray-400'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-6">Sin cotizaciones</p>
          )}

          {approvalRate > 0 && (
            <div className="mt-5 pt-4 border-t border-gray-100">
              <div className="flex justify-between text-sm mb-2">
                <span className="font-semibold text-gray-700">Tasa de Aprobación</span>
                <span className={`font-bold ${approvalRate > 60 ? 'text-success-600' : approvalRate > 30 ? 'text-warning-600' : 'text-danger-600'}`}>
                  {approvalRate}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${approvalRate > 60 ? 'bg-success-500' : approvalRate > 30 ? 'bg-warning-500' : 'bg-danger-500'}`}
                  style={{ width: `${Math.min(approvalRate, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Cotizaciones aprobadas vs enviadas (excluye borradores)
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ─── Top Clientes ─── */}
      <section>
        <SectionHeader title="Top Clientes por Facturación" subtitle="Clientes con mayor volumen cotizado" />
        {commercial && commercial.topClients.length > 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">#</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Cliente</th>
                  <th className="text-right px-5 py-3 font-semibold text-gray-600">Total Cotizado</th>
                </tr>
              </thead>
              <tbody>
                {commercial.topClients.map((client, idx) => (
                  <tr key={client.clientId} className="border-b border-gray-100 last:border-0">
                    <td className="px-5 py-3 text-gray-400 font-mono">{idx + 1}</td>
                    <td className="px-5 py-3 font-medium text-gray-900">{client.name}</td>
                    <td className="px-5 py-3 text-right font-mono text-gray-700">${(client.totalQuoted / 1000).toFixed(0)}k</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : loading ? (
          <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />
        ) : (
          <p className="text-sm text-gray-400">Sin datos de clientes</p>
        )}
      </section>

      {/* ─── Contratos ─── */}
      <section>
        <SectionHeader title="Contratos y Renovaciones" subtitle="Oportunidades de renovación y nuevas mantenciones" />
        <KpiGrid>
          <MetricCard label="Contratos Activos" value={summary?.contracts.active ?? '-'} loading={loading} />
          <MetricCard label="Próximos a Vencer" value={contracts?.expiringNextMonth ?? '-'} loading={loading}
            trend={contracts && contracts.expiringNextMonth > 0 ? { direction: 'up', label: 'Oportunidad de renovación' } : undefined} />
          <MetricCard label="Mantenciones Próximas" value={contracts?.upcomingMaintenance ?? '-'} loading={loading} />
          <MetricCard label="Equipos en Contrato" value={contracts?.equipmentUnderContract ?? '-'} loading={loading} />
        </KpiGrid>
      </section>
    </div>
  );
}
