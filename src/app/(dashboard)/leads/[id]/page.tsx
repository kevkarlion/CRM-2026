'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api-client';
import { CreateQuoteDrawer } from '@/leads/components/CreateQuoteDrawer';
import { CreateVisitDrawer } from '@/leads/components/CreateVisitDrawer';
import { QuoteDetailDrawer } from '@/leads/components/QuoteDetailDrawer';
import { WorkOrderDetailDrawer } from '@/operations/components/WorkOrderDetailDrawer';
import { CreateWorkOrderDrawer } from '@/operations/components/CreateWorkOrderDrawer';
import { ConfirmSaleDrawer } from '@/leads/components/ConfirmSaleDrawer';
import { useLeadStatuses } from '@/leads/hooks/useLeadStatuses';
import { getDaysUntilExpiry } from '@/lib/format-date';
import { LeadTimeline } from '@/activity/components/LeadTimeline';

interface Lead {
  _id: string;
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  source: string;
  status: string;
  assignedTo?: { _id: string; name: string; email: string } | string;
  estimatedValue?: number;
  notes?: string;
  convertedToClient?: string;
  convertedAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

interface Quote {
  _id: string;
  number: string;
  title: string;
  status: 'draft' | 'sent' | 'approved' | 'rejected' | 'expired' | 'cancelled';
  total: number;
  validUntil: string | null;
  createdAt: string;
}

interface WorkOrder {
  _id: string;
  workOrderNumber: string;
  title: string;
  status: string;
  scheduledDate?: string;
  scheduledStart?: string;
}

const STATUS_OPTIONS = [
  { value: 'new', label: 'Nuevo' },
  { value: 'contacted', label: 'Contactado' },
  { value: 'quote_sent', label: 'Presupuesto enviado' },
  { value: 'technical_visit', label: 'Visita técnica' },
  { value: 'negotiation', label: 'Negociación' },
  { value: 'qualified', label: 'Calificado' },
  { value: 'won', label: 'Ganado' },
  { value: 'lost', label: 'Perdido' },
  { value: 'disqualified', label: 'Descalificado' },
];

const STATUS_VARIANT: Record<string, string> = {
  new: 'bg-info-50 text-info-700',
  contacted: 'bg-brand-50 text-brand-700',
  quote_sent: 'bg-purple-50 text-purple-700',
  technical_visit: 'bg-orange-50 text-orange-700',
  negotiation: 'bg-yellow-50 text-yellow-700',
  qualified: 'bg-warning-50 text-warning-700',
  won: 'bg-success-50 text-success-700',
  lost: 'bg-danger-50 text-danger-700',
  disqualified: 'bg-gray-100 text-gray-700',
};

const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  sent: 'Enviado',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  expired: 'Expirado',
  cancelled: 'Cancelado',
};

const QUOTE_STATUS_VARIANT: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-50 text-blue-700',
  approved: 'bg-success-50 text-success-700',
  rejected: 'bg-danger-50 text-danger-700',
  expired: 'bg-warning-50 text-warning-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

const SOURCE_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp', call: 'Llamada', form: 'Formulario',
  referral: 'Referido', walk_in: 'Presencial', other: 'Otro',
};

function QuoteExpiryAlert({ validUntil }: { validUntil: string | null }) {
  const daysLeft = getDaysUntilExpiry(validUntil);
  
  if (daysLeft === null) return null;
  
  if (daysLeft < 0) {
    return (
      <div className="mt-2 p-2 bg-danger-50 border border-danger-200 rounded-lg">
        <p className="text-xs text-danger-700 font-medium">
          ⚠️ Vencido hace {Math.abs(daysLeft)} días
        </p>
      </div>
    );
  }
  
  if (daysLeft === 0) {
    return (
      <div className="mt-2 p-2 bg-danger-50 border border-danger-200 rounded-lg">
        <p className="text-xs text-danger-700 font-medium">
          ⚠️ Vence hoy
        </p>
      </div>
    );
  }
  
  if (daysLeft <= 3) {
    return (
      <div className="mt-2 p-2 bg-danger-50 border border-danger-200 rounded-lg">
        <p className="text-xs text-danger-700 font-medium">
          ⏰ Vence en {daysLeft} día{daysLeft !== 1 ? 's' : ''}
        </p>
      </div>
    );
  }
  
  if (daysLeft <= 7) {
    return (
      <div className="mt-2 p-2 bg-warning-50 border border-warning-200 rounded-lg">
        <p className="text-xs text-warning-700 font-medium">
          ⏰ Vence en {daysLeft} días
        </p>
      </div>
    );
  }
  
  return null;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center py-3 border-b border-gray-100 last:border-0">
      <dt className="text-sm font-medium text-gray-500 sm:w-40 shrink-0">{label}</dt>
      <dd className="text-sm text-gray-900 mt-0.5 sm:mt-0">{value || '—'}</dd>
    </div>
  );
}

export default function LeadDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignUserId, setAssignUserId] = useState('');
  const [showAssignInput, setShowAssignInput] = useState(false);

  // Drawer states
  const [showQuoteDrawer, setShowQuoteDrawer] = useState(false);
  const [showVisitDrawer, setShowVisitDrawer] = useState(false);
  const [showQuoteDetail, setShowQuoteDetail] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);

  // Quote sending state
  const [sendingQuoteId, setSendingQuoteId] = useState<string | null>(null);

  // Lists
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [visits, setVisits] = useState<WorkOrder[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await api.get<Lead>(`/api/crm/leads/${id}`);
        setLead(data);
        if (data.status === 'contacted' || data.status === 'quote_sent' || data.status === 'technical_visit') {
          loadRelatedData();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar lead');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function loadRelatedData() {
    setLoadingRelated(true);
    try {
      const [quotesData, visitsData] = await Promise.all([
        api.get<{ data: Quote[] }>(`/api/crm/leads/${id}/quotes`),
        api.get<WorkOrder[]>(`/api/crm/leads/${id}/visits`).catch(() => []),
      ]);
      setQuotes(quotesData.data || quotesData);
      setVisits(visitsData);
    } catch (err) {
      console.error('Error loading related data:', err);
    } finally {
      setLoadingRelated(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.del(`/api/crm/leads/${id}`);
      router.push('/leads');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    setChangingStatus(true);
    try {
      const updated = await api.patch<Lead>(`/api/crm/leads/${id}/status`, { status: newStatus });
      setLead(updated);
      setShowStatusMenu(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar estado');
    } finally {
      setChangingStatus(false);
    }
  }

  async function handleConvert() {
    try {
      const result = await api.post<{ clientId: string }>(`/api/crm/leads/${id}/convert`, {});
      router.push(`/contracts`); // or wherever client detail is
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al convertir');
    }
  }

  async function handleAssign() {
    if (!assignUserId.trim()) return;
    setAssigning(true);
    try {
      await api.post(`/api/crm/leads/${id}/assign`, { userId: assignUserId.trim() });
      setShowAssignInput(false);
      setAssignUserId('');
      const refreshed = await api.get<Lead>(`/api/crm/leads/${id}`);
      setLead(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al asignar');
    } finally {
      setAssigning(false);
    }
  }

  async function handleSendQuote(quoteId: string) {
    setSendingQuoteId(quoteId);
    try {
      await api.post(`/api/crm/quotes/${quoteId}/send`);
      // Refresh quotes and lead
      await loadRelatedData();
      const refreshed = await api.get<Lead>(`/api/crm/leads/${id}`);
      setLead(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar presupuesto');
    } finally {
      setSendingQuoteId(null);
    }
  }

  function handleViewQuoteDetail(quoteId: string) {
    setSelectedQuoteId(quoteId);
    setShowQuoteDetail(true);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
    );
  }

  if (!lead) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Lead no encontrado</p>
        <button onClick={() => router.push('/leads')} className="mt-4 text-sm text-brand-600 font-medium">
          Volver a leads
        </button>
      </div>
    );
  }

  const isConverted = !!lead.convertedToClient;
  const isContacted = lead?.status === 'contacted' || lead?.status === 'quote_sent' || lead?.status === 'technical_visit';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/leads')} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{lead.name}</h1>
            {lead.companyName && (
              <p className="text-sm text-gray-500">{lead.companyName}</p>
            )}
          </div>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_VARIANT[lead.status]}`}>
            {STATUS_OPTIONS.find((o) => o.value === lead.status)?.label || lead.status}
          </span>
          {isConverted && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-50 text-success-700">
              Convertido
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Información del Lead</h2>
            <dl className="divide-y divide-gray-100">
              <DetailRow label="Nombre" value={lead.name} />
              <DetailRow label="Empresa" value={lead.companyName || '—'} />
              <DetailRow label="Email" value={lead.email || '—'} />
              <DetailRow label="Teléfono" value={lead.phone || '—'} />
              <DetailRow label="Origen" value={SOURCE_LABELS[lead.source] || lead.source} />
              <DetailRow label="Valor Estimado" value={lead.estimatedValue ? `$${lead.estimatedValue.toLocaleString()}` : '—'} />
              <DetailRow label="Asignado a" value={
                lead.assignedTo
                  ? (typeof lead.assignedTo === 'object' ? lead.assignedTo.name : lead.assignedTo)
                  : '—'
              } />
              <DetailRow label="Creado" value={new Date(lead.createdAt).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })} />
              <DetailRow label="Actualizado" value={new Date(lead.updatedAt).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })} />
              {isConverted && (
                <>
                  <DetailRow label="Convertido" value={lead.convertedAt ? new Date(lead.convertedAt).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Sí'} />
                </>
              )}
            </dl>
          </div>

          {lead.notes && (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-3">Notas</h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{lead.notes}</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Acciones</h3>

            <button onClick={() => router.push(`/leads/${id}/edit`)}
              className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Editar Lead
            </button>

            <div className="relative">
              <button onClick={() => setShowStatusMenu(!showStatusMenu)} disabled={changingStatus}
                className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                {changingStatus ? 'Cambiando...' : 'Cambiar Estado'}
              </button>
              {showStatusMenu && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                  {STATUS_OPTIONS.filter((o) => o.value !== lead.status).map((opt) => (
                    <button key={opt.value} onClick={() => handleStatusChange(opt.value)}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <button onClick={() => setShowAssignInput(!showAssignInput)}
                className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                Asignar a...
              </button>
              {showAssignInput && (
                <div className="mt-2 space-y-2">
                  <input type="text" value={assignUserId} onChange={(e) => setAssignUserId((e.target as any).value)}
                    placeholder="ID del usuario"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none" />
                  <button onClick={handleAssign} disabled={assigning || !assignUserId.trim()}
                    className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors">
                    {assigning ? 'Asignando...' : 'Confirmar'}
                  </button>
                </div>
              )}
            </div>

            {!isConverted && (
              <button onClick={handleConvert}
                className="w-full rounded-lg bg-success-500 px-4 py-2 text-sm font-medium text-white hover:bg-success-600 transition-colors">
                Convertir a Cliente
              </button>
            )}

            {!showDeleteConfirm ? (
              <button onClick={() => setShowDeleteConfirm(true)}
                className="w-full rounded-lg border border-danger-200 px-4 py-2 text-sm font-medium text-danger-600 hover:bg-danger-50 transition-colors">
                Eliminar
              </button>
            ) : (
              <div className="space-y-2 p-3 bg-danger-50 rounded-lg">
                <p className="text-xs text-danger-700 font-medium">¿Eliminar este lead?</p>
                <div className="flex gap-2">
                  <button onClick={handleDelete} disabled={deleting}
                    className="flex-1 rounded-lg bg-danger-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-danger-600 disabled:opacity-50 transition-colors">
                    {deleting ? 'Eliminando...' : 'Sí, eliminar'}
                  </button>
                  <button onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Acciones de Lead Contactado */}
          {isContacted && !isConverted && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Gestión Comercial</h3>
              
              <button 
                onClick={() => setShowQuoteDrawer(true)}
                className="w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors">
                Enviar Presupuesto
              </button>
              
              <button 
                onClick={() => setShowVisitDrawer(true)}
                className="w-full rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors">
                Programar Visita Técnica
              </button>
            </div>
          )}

          {/* Lista de Presupuestos */}
          {quotes.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Presupuestos</h3>
              <div className="space-y-2">
                {quotes.map((quote) => (
                  <div key={quote._id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <button
                          onClick={() => handleViewQuoteDetail(quote._id)}
                          className="text-sm font-medium text-gray-900 hover:text-brand-600 transition-colors text-left"
                        >
                          {quote.title}
                        </button>
                        <p className="text-xs text-gray-500">#{quote.number}</p>
                      </div>
                      <div className="text-right ml-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${QUOTE_STATUS_VARIANT[quote.status]}`}>
                          {QUOTE_STATUS_LABELS[quote.status]}
                        </span>
                        <p className="text-sm font-medium text-gray-900 mt-1">${quote.total.toLocaleString()}</p>
                      </div>
                    </div>
                    
                    {/* Alerta de caducidad para presupuestos enviados */}
                    {quote.status === 'sent' && <QuoteExpiryAlert validUntil={quote.validUntil} />}
                    
                    {/* Botones de acción */}
                    <div className="mt-2 pt-2 border-t border-gray-200 flex gap-2">
                      <button
                        onClick={() => handleViewQuoteDetail(quote._id)}
                        className="flex-1 text-sm border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors font-medium"
                      >
                        Ver Detalle
                      </button>
                      {quote.status === 'draft' && (
                        <button
                          onClick={() => handleSendQuote(quote._id)}
                          disabled={sendingQuoteId === quote._id}
                          className="flex-1 text-sm bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors font-medium"
                        >
                          {sendingQuoteId === quote._id ? 'Enviando...' : 'Enviar'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lista de Visitas Técnicas */}
          {visits.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Visitas Técnicas</h3>
              <div className="space-y-2">
                {visits.map((visit) => (
                  <div key={visit._id} className="p-3 bg-gray-50 rounded-lg flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{visit.title}</p>
                      <p className="text-xs text-gray-500">#{visit.workOrderNumber}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-500">
                        {visit.scheduledDate ? new Date(visit.scheduledDate).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }) : '—'}
                      </span>
                      <p className="text-xs text-gray-400 capitalize">{visit.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Drawers */}
      <CreateQuoteDrawer
        isOpen={showQuoteDrawer}
        onClose={() => setShowQuoteDrawer(false)}
        leadId={id}
        leadName={lead?.name || ''}
        onSuccess={() => {
          loadRelatedData();
          // Refresh lead status
          api.get<Lead>(`/api/crm/leads/${id}`).then(setLead);
        }}
      />

      <CreateVisitDrawer
        isOpen={showVisitDrawer}
        onClose={() => setShowVisitDrawer(false)}
        leadId={id}
        leadName={lead?.name || ''}
        leadPhone={lead?.phone}
        leadEmail={lead?.email}
        onSuccess={() => {
          loadRelatedData();
          // Refresh lead status
          api.get<Lead>(`/api/crm/leads/${id}`).then(setLead);
        }}
      />

      <QuoteDetailDrawer
        isOpen={showQuoteDetail}
        onClose={() => {
          setShowQuoteDetail(false);
          setSelectedQuoteId(null);
        }}
        quoteId={selectedQuoteId || ''}
      />
    </div>
  );
}
