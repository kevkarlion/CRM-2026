'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';

interface LeadCommercialActionsCardProps {
  onOpenQuoteDrawer: () => void;
  onOpenVisitDrawer: () => void;
  onOpenQuickSaleDrawer: () => void;
  onSendQuotePdf?: () => void;
  onConfirmSalePdf?: () => void;
  disabled?: boolean;
  leadId?: string;
  currentStatus?: string;
  clientId?: string;
  clientOperationStatus?: string;
}

/** Commercial actions for leads or clients */
export function LeadCommercialActionsCard({
  onOpenQuoteDrawer,
  onOpenVisitDrawer,
  onOpenQuickSaleDrawer,
  onSendQuotePdf,
  onConfirmSalePdf,
  disabled = false,
  leadId,
  currentStatus,
  clientId,
  clientOperationStatus,
}: LeadCommercialActionsCardProps) {
  const [loadingQuotePdf, setLoadingQuotePdf] = useState(false);
  const [loadingSalePdf, setLoadingSalePdf] = useState(false);
  const [loadingScheduleVisit, setLoadingScheduleVisit] = useState(false);

  // Determinar si es cliente o lead
  const isClient = !!clientId;
  const isLead = !!leadId;

  // Para lead: usar currentStatus; para cliente: usar operationStatus
  const effectiveStatus = isClient ? clientOperationStatus : currentStatus;

  // Estados válidos para lead
  const validLeadStatuses = ['new', 'contacted', 'technical_visit', 'negotiation'];
  // Estados válidos para cliente
  const validClientStatuses = ['none', 'quote_pending', 'visit_scheduled', 'sale_confirmed'];

  // Estados donde se puede enviar presupuesto PDF
  const canSendQuotePdf = !disabled && (
    (isLead && leadId && validLeadStatuses.includes(currentStatus || '')) ||
    (isClient && clientId)
  );
  
  // Estados donde se puede programar visita técnica
  const canScheduleVisit = !disabled && (
    (isLead && leadId && ['new', 'contacted', 'quote_sent', 'negotiation'].includes(currentStatus || '')) ||
    (isClient && clientId)
  );
  
  // Estados donde se puede confirmar venta PDF
  const canConfirmSalePdf = !disabled && (
    (isLead && leadId && ['new', 'contacted', 'quote_sent', 'technical_visit', 'negotiation'].includes(currentStatus || '')) ||
    (isClient && clientId)
  );

  const handleSendQuotePdf = async () => {
    if (loadingQuotePdf) return;
    
    setLoadingQuotePdf(true);
    try {
      if (isClient && clientId) {
        await api.post(`/api/crm/clients/${clientId}/send-quote-pdf`, {});
      } else if (isLead && leadId) {
        await api.post(`/api/crm/leads/${leadId}/send-quote-pdf`, {});
      }
      onSendQuotePdf?.();
    } catch (err) {
      console.error('Error sending quote PDF:', err);
    } finally {
      setLoadingQuotePdf(false);
    }
  };

  const handleScheduleVisit = async () => {
    if (loadingScheduleVisit) return;
    
    setLoadingScheduleVisit(true);
    try {
      if (isClient && clientId) {
        await api.post(`/api/crm/clients/${clientId}/schedule-visit`, {});
      } else if (isLead && leadId) {
        await api.post(`/api/crm/leads/${leadId}/schedule-visit`, {});
      }
      onSendQuotePdf?.();
    } catch (err) {
      console.error('Error scheduling visit:', err);
    } finally {
      setLoadingScheduleVisit(false);
    }
  };

  const handleConfirmSalePdf = async () => {
    if (loadingSalePdf) return;
    
    if (!confirm('¿Confirmar esta venta? Se creará una orden de trabajo en borrador.')) {
      return;
    }

    setLoadingSalePdf(true);
    try {
      let result;
      if (isClient && clientId) {
        result = await api.post<{ success: boolean; workOrder: { workOrderNumber: string } }>(
          `/api/crm/clients/${clientId}/confirm-sale-pdf`, 
          {}
        );
      } else if (isLead && leadId) {
        result = await api.post<{ success: boolean; workOrder: { workOrderNumber: string } }>(
          `/api/crm/leads/${leadId}/confirm-sale-pdf`, 
          {}
        );
      }
      onConfirmSalePdf?.();
      
      if (result?.success) {
        alert(`Venta confirmada. OT creada: ${result.workOrder?.workOrderNumber || '—'}`);
      }
    } catch (err) {
      console.error('Error confirming sale PDF:', err);
    } finally {
      setLoadingSalePdf(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
      <h3 className="text-sm font-semibold text-gray-900 mb-2">Gestión Comercial</h3>

      {disabled && (
        <div className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">
          Cliente bloqueado — no puede operar
        </div>
      )}

      <button
        onClick={onOpenQuoteDrawer}
        disabled={disabled}
        className="w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-purple-600"
      >
        Enviar Presupuesto
      </button>

      {/* Ocultar botones PDF temporalmente */}
      {false && canSendQuotePdf && (
        <button
          onClick={handleSendQuotePdf}
          disabled={disabled || loadingQuotePdf}
          className="w-full rounded-lg bg-purple-100 border border-purple-300 px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loadingQuotePdf ? 'Enviando...' : 'Enviar Presupuesto PDF'}
        </button>
      )}

      <button
        onClick={onOpenVisitDrawer}
        disabled={disabled}
        className="w-full rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-orange-500"
      >
        Programar Visita Técnica
      </button>

      {false && canScheduleVisit && (
        <button
          onClick={handleScheduleVisit}
          disabled={disabled || loadingScheduleVisit}
          className="w-full rounded-lg bg-orange-100 border border-orange-300 px-4 py-2 text-sm font-medium text-orange-700 hover:bg-orange-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loadingScheduleVisit ? 'Programando...' : 'Programar Visita Técnica PDF'}
        </button>
      )}

      <button
        onClick={onOpenQuickSaleDrawer}
        disabled={disabled}
        className="w-full rounded-lg bg-success-500 px-4 py-2 text-sm font-medium text-white hover:bg-success-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-success-500"
      >
        Confirmar Venta
      </button>

      {false && canConfirmSalePdf && (
        <button
          onClick={handleConfirmSalePdf}
          disabled={disabled || loadingSalePdf}
          className="w-full rounded-lg bg-success-100 border border-success-300 px-4 py-2 text-sm font-medium text-success-700 hover:bg-success-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loadingSalePdf ? 'Confirmando...' : 'Confirmar Venta PDF'}
        </button>
      )}
    </div>
  );
}
