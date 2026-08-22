'use client';

import { Suspense, useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, unwrapData } from '@/lib/api-client';
import { SearchInput } from '@/components/ui/SearchInput';

interface WorkReport {
  _id: string;
  result: string;
  workPerformed?: string[];
  workPerformedOther?: string;
  hasObservations: boolean;
  observationsText?: string;
  hasAdditionalIssues: boolean;
  additionalIssues?: string[];
  additionalIssuesText?: string;
  nextVisitRecommendation?: string;
  nextVisitRecommendation?: string;
  startedAt: string;
  finishedAt: string;
  durationMinutes?: number;
  workOrderId?: string;
  technicalVisitId?: string;
  workOrderNumber?: string;
  visitNumber?: string;
  technicianName: string;
  technicianEmail: string;
  clientName?: string;
  clientPhone?: string;
  leadName?: string;
  leadPhone?: string;
  entityType: 'OT' | 'VT';
}

type SortField = 'finishedAt' | 'clientName' | 'result';
type SortOrder = 'asc' | 'desc';

const PAGE_SIZE = 50;

function InformesPageContent() {
  const searchParams = useSearchParams();
  const workOrderIdFromUrl = searchParams.get('workOrderId');
  
  const [reports, setReports] = useState<WorkReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('finishedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedReport, setSelectedReport] = useState<WorkReport | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [filterType, setFilterType] = useState<string>('');
  const [filterTechnician, setFilterTechnician] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewedIds, setViewedIds] = useState<string[]>([]);

  // Load viewed IDs from sessionStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('work-reports-viewed');
      if (stored) {
        setViewedIds(JSON.parse(stored));
      }
    }
  }, []);

  // Mark as viewed when drawer opens
  const handleView = (report: WorkReport) => {
    setSelectedReport(report);
    setShowDrawer(true);
    // Mark as viewed
    if (!viewedIds.includes(report._id)) {
      const newViewed = [...viewedIds, report._id];
      setViewedIds(newViewed);
      sessionStorage.setItem('work-reports-viewed', JSON.stringify(newViewed));
    }
  };

  // Get unique technicians for dropdown
  const uniqueTechnicians = useMemo(() => {
    const techMap = new Map<string, string>();
    reports.forEach(r => {
      if (r.technicianName && r.technicianEmail) {
        techMap.set(r.technicianEmail, r.technicianName);
      }
    });
    return Array.from(techMap, ([email, name]) => ({ email, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [reports]);

  useEffect(() => {
    loadReports();
  }, [search]);

  // Auto-open drawer when workOrderId is in URL
  useEffect(() => {
    if (workOrderIdFromUrl && reports.length > 0) {
      const report = reports.find(r => r.workOrderId === workOrderIdFromUrl);
      if (report) {
        handleView(report);
      }
    }
  }, [reports, workOrderIdFromUrl]);

  async function loadReports() {
    setLoading(true);
    setCurrentPage(1);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('limit', '200');
      
      const result = await api.get<{ data: WorkReport[], total: number }>(`/api/operations/work-reports?${params}`);
      const data = unwrapData(result);
      setReports(data);
    } catch (err) {
      console.error('Error loading reports:', err);
    } finally {
      setLoading(false);
    }
  }

  // Sort and filter functionality
  const sortedReports = useMemo(() => {
    let filtered = [...reports];
    
    if (filterType) {
      filtered = filtered.filter(r => r.entityType === filterType);
    }
    
    if (filterTechnician) {
      filtered = filtered.filter(r => r.technicianEmail === filterTechnician);
    }
    
    return filtered.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      if (aVal == null) return sortOrder === 'asc' ? 1 : -1;
      if (bVal == null) return sortOrder === 'asc' ? -1 : 1;

      if (sortField === 'finishedAt') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [reports, sortField, sortOrder, filterType, filterTechnician]);

  // Pagination
  const totalPages = Math.ceil(sortedReports.length / PAGE_SIZE);
  const paginatedReports = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedReports.slice(start, start + PAGE_SIZE);
  }, [sortedReports, currentPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterType, filterTechnician]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  }

  function formatDate(dateStr: string) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function getEntityNumber(report: WorkReport) {
    if (report.entityType === 'OT') {
      const num = report.workOrderNumber || '';
      return num.length > 8 ? '...' + num.slice(-8) : num;
    }
    if (report.entityType === 'VT') return report.visitNumber;
    return '-';
  }

  function getClientName(report: WorkReport) {
    return report.clientName || report.leadName || '-';
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <span className="ml-1 text-gray-300">⇅</span>;
    return <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  }

  return (
    <div className="p-4 md:p-6">
      {/* Back button */}
      <button
        onClick={() => window.history.back()}
        className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Volver a Órdenes de Trabajo
      </button>

      {/* Header */}
      <div className="mb-4 md:mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Informes Técnicos</h1>
        <p className="text-xs md:text-sm text-gray-500 mt-1">
          Informes de visitas técnicas y órdenes de trabajo
        </p>
      </div>

      {/* Search and Filters - Responsive */}
      <div className="mb-4 space-y-2 md:space-y-0 md:flex md:flex-wrap md:gap-2">
        <div className="w-full md:w-auto md:flex-1 md:min-w-[200px]">
          <SearchInput
            placeholder="Buscar..."
            value={search}
            onChange={setSearch}
            className="w-full"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="w-full md:w-auto px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white"
        >
          <option value="">Todos</option>
          <option value="OT">Órdenes</option>
          <option value="VT">Visitas</option>
        </select>
        <select
          value={filterTechnician}
          onChange={(e) => setFilterTechnician(e.target.value)}
          className="w-full md:w-auto px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white"
        >
          <option value="">Técnicos</option>
          {uniqueTechnicians.map(t => (
            <option key={t.email} value={t.email}>{t.name}</option>
          ))}
        </select>
      </div>

      {/* Results count */}
      <div className="mb-3 text-xs text-gray-500 flex flex-wrap items-center justify-between gap-2">
        <span>
          {sortedReports.length} informes
          {filterType && ` · filtrado`}
          {filterTechnician && ` · filtrado`}
        </span>
        {totalPages > 1 && (
          <span className="text-gray-400">
            Página {currentPage} de {totalPages}
          </span>
        )}
      </div>

      {/* Table - Desktop */}
      <div className="hidden md:block bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700"
                  onClick={() => handleSort('finishedAt')}
                >
                  Fecha <SortIcon field="finishedAt" />
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                <th 
                  className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700"
                  onClick={() => handleSort('clientName')}
                >
                  Cliente <SortIcon field="clientName" />
                </th>
                <th 
                  className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700"
                  onClick={() => handleSort('result')}
                >
                  Resultado <SortIcon field="result" />
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Técnico</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Duración</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Volver</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Acción</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600"></div>
                    </div>
                  </td>
                </tr>
              ) : paginatedReports.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500 text-sm">
                    {reports.length === 0 ? 'No hay informes' : 'Sin resultados'}
                  </td>
                </tr>
              ) : (
                paginatedReports.map((report) => (
                  <tr key={report._id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-xs text-gray-900">
                      {formatDate(report.finishedAt)}
                    </td>
                    <td className="px-3 py-2 text-xs font-mono text-gray-600">
                      {getEntityNumber(report)}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                        report.entityType === 'OT' 
                          ? 'bg-purple-100 text-purple-700' 
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {report.entityType}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-900 max-w-[120px] truncate">
                      {getClientName(report)}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700 max-w-[150px] truncate">
                      <div className="flex items-center gap-1">
                        <span className="truncate max-w-[120px]">{report.result}</span>
                        {!viewedIds.includes(report._id) && (
                          <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-brand-100 text-brand-700">
                            Nuevo
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600 max-w-[100px] truncate">
                      {report.technicianName || report.technicianEmail || '-'}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {report.durationMinutes ? (
                        report.durationMinutes >= 60
                          ? `${Math.floor(report.durationMinutes / 60)}h ${report.durationMinutes % 60}m`
                          : `${report.durationMinutes}m`
                      ) : '-'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {report.nextVisitRecommendation && report.nextVisitRecommendation !== 'No' ? (
                        <span 
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 cursor-pointer" 
                          title={report.nextVisitRecommendation}
                        >
                          ⚠ {report.nextVisitRecommendation}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => handleView(report)}
                        className="px-2 py-1 text-xs font-medium text-brand-700 bg-brand-50 rounded hover:bg-brand-100 cursor-pointer"
                        title="Ver detalle"
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cards - Mobile */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
          </div>
        ) : paginatedReports.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-500 text-sm">
            {reports.length === 0 ? 'No hay informes' : 'Sin resultados'}
          </div>
        ) : (
          paginatedReports.map((report) => (
            <div 
              key={report._id} 
              className="bg-white rounded-lg border border-gray-200 p-4 space-y-2"
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                      report.entityType === 'OT' 
                        ? 'bg-purple-100 text-purple-700' 
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {report.entityType}
                    </span>
                    <span className="text-xs font-mono text-gray-500">
                      {getEntityNumber(report)}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 mt-1 truncate">
                    {getClientName(report)}
                  </p>
                </div>
                <button
                  onClick={() => handleView(report)}
                  className="px-3 py-1.5 text-xs font-medium text-brand-700 bg-brand-50 rounded hover:bg-brand-100 shrink-0 cursor-pointer"
                  title="Ver detalle"
                >
                  Ver
                </button>
              </div>

              {/* Info row */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                <span>{formatDate(report.finishedAt)}</span>
                <div className="flex items-center gap-1">
                  <span className="truncate max-w-[150px]">{report.result}</span>
                  {!viewedIds.includes(report._id) && (
                    <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-brand-100 text-brand-700">
                      Nuevo
                    </span>
                  )}
                </div>
                {report.durationMinutes && (
                  <span>
                    {report.durationMinutes >= 60
                      ? `${Math.floor(report.durationMinutes / 60)}h ${report.durationMinutes % 60}m`
                      : `${report.durationMinutes}m`}
                  </span>
                )}
                {report.nextVisitRecommendation && report.nextVisitRecommendation !== 'No' && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                    ⚠ Volver
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            ← Anterior
          </button>
          
          {/* Page numbers */}
          <div className="hidden sm:flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-8 h-8 text-sm rounded-lg ${
                    currentPage === pageNum
                      ? 'bg-brand-600 text-white'
                      : 'border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Siguiente →
          </button>
        </div>
      )}

      {/* Drawer - Fully responsive */}
      {showDrawer && selectedReport && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 z-[60] md:z-[70]"
            onClick={() => setShowDrawer(false)}
          />
          
          {/* Drawer Panel */}
          <div className="fixed right-0 top-14 bottom-0 w-full md:top-14 md:w-full md:max-w-xl lg:max-w-2xl bg-white shadow-2xl z-[70] md:z-[70] flex flex-col overflow-hidden animate-slide-in">
            {/* Header */}
            <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3 md:px-6 md:py-4 flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <h2 className="text-base md:text-lg font-semibold text-gray-900 truncate">
                  {selectedReport.entityType} {getEntityNumber(selectedReport)}
                </h2>
                <p className="text-xs text-gray-500">
                  {formatDate(selectedReport.finishedAt)}
                </p>
              </div>
              <button
                onClick={() => setShowDrawer(false)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 shrink-0 ml-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
              {/* Status Badge */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-2 md:p-3">
                <span className="text-xs font-medium text-green-700">Estado: Completado</span>
              </div>

              {/* Cliente */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                <h4 className="text-xs font-medium text-gray-500">Cliente/Lead</h4>
                <p className="text-sm font-semibold text-gray-900">
                  {getClientName(selectedReport)}
                </p>
                {(selectedReport.clientPhone || selectedReport.leadPhone) && (
                  <p className="text-xs text-gray-500">{selectedReport.clientPhone || selectedReport.leadPhone}</p>
                )}
              </div>

              {/* Técnico */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                <h4 className="text-xs font-medium text-gray-500">Técnico</h4>
                <p className="text-sm font-semibold text-gray-900">
                  {selectedReport.technicianName || selectedReport.technicianEmail || '-'}
                </p>
              </div>

              {/* Resultado */}
              {selectedReport.result && (
                <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                  <h4 className="text-xs font-medium text-gray-500">Resultado</h4>
                  <p className="text-sm text-gray-900">{selectedReport.result}</p>
                </div>
              )}

              {/* Duración y Fecha */}
              <div className="grid grid-cols-2 gap-3">
                {selectedReport.startedAt && (
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                    <h4 className="text-xs font-medium text-gray-500">Inicio</h4>
                    <p className="text-xs text-gray-900">{formatDate(selectedReport.startedAt)}</p>
                  </div>
                )}
                {selectedReport.durationMinutes && (
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                    <h4 className="text-xs font-medium text-gray-500">Duración</h4>
                    <p className="text-sm font-semibold text-gray-900">
                      {selectedReport.durationMinutes >= 60
                        ? `${Math.floor(selectedReport.durationMinutes / 60)}h ${selectedReport.durationMinutes % 60}m`
                        : `${selectedReport.durationMinutes}m`}
                    </p>
                  </div>
                )}
              </div>

              {/* Trabajos Realizados */}
              {selectedReport.workPerformed && selectedReport.workPerformed.length > 0 && (
                <div className="bg-green-50/50 rounded-lg p-3 space-y-2">
                  <h4 className="text-xs font-medium text-gray-500">Trabajos Realizados</h4>
                  <ul className="space-y-1">
                    {selectedReport.workPerformed.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-gray-700">
                        <span className="text-green-500 shrink-0">✓</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Otros Trabajos */}
              {selectedReport.workPerformedOther && (
                <div className="bg-green-50/50 rounded-lg p-3 space-y-1">
                  <h4 className="text-xs font-medium text-gray-500">Otros Trabajos</h4>
                  <p className="text-xs text-gray-700">{selectedReport.workPerformedOther}</p>
                </div>
              )}

              {/* Observaciones */}
              {selectedReport.hasObservations && selectedReport.observationsText && (
                <div className="bg-yellow-50/50 rounded-lg p-3 space-y-1">
                  <h4 className="text-xs font-medium text-gray-500">Observaciones</h4>
                  <p className="text-xs text-gray-700 whitespace-pre-wrap">{selectedReport.observationsText}</p>
                </div>
              )}

              {/* Problemas Adicionales */}
              {selectedReport.hasAdditionalIssues && selectedReport.additionalIssues && selectedReport.additionalIssues.length > 0 && (
                <div className="bg-orange-50/50 rounded-lg p-3 space-y-2">
                  <h4 className="text-xs font-medium text-orange-700">Problemas Adicionales</h4>
                  <ul className="space-y-1">
                    {selectedReport.additionalIssues.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-orange-700">
                        <span className="text-orange-500 shrink-0">⚠</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Descripción Problemas */}
              {selectedReport.hasAdditionalIssues && selectedReport.additionalIssuesText && (
                <div className="bg-orange-50/50 rounded-lg p-3 space-y-1">
                  <h4 className="text-xs font-medium text-orange-700">Descripción</h4>
                  <p className="text-xs text-orange-700 whitespace-pre-wrap">{selectedReport.additionalIssuesText}</p>
                </div>
              )}

              {/* Recomendación Próxima Visita */}
              {selectedReport.nextVisitRecommendation && selectedReport.nextVisitRecommendation !== 'No' && (
                <div className="bg-blue-50/50 rounded-lg p-3 space-y-1">
                  <h4 className="text-xs font-medium text-blue-700">Próxima Visita</h4>
                  <p className="text-xs text-blue-700">{selectedReport.nextVisitRecommendation}</p>
                </div>
              )}

              {/* Fecha Finalización */}
              {selectedReport.finishedAt && (
                <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                  <h4 className="text-xs font-medium text-gray-500">Finalización</h4>
                  <p className="text-xs text-gray-900">{formatDate(selectedReport.finishedAt)}</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Animation Styles */}
      <style jsx>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

export default function InformesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Cargando...</div>}>
      <InformesPageContent />
    </Suspense>
  );
}