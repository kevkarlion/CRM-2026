'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { DOCUMENT_TYPE_OPTIONS, DOCUMENT_TYPE_LABELS, DocumentType } from '@/documents/types/document';

interface Document {
  _id: string;
  filename: string;
  title: string;
  description?: string;
  documentType: DocumentType;
  mimeType: string;
  fileSize: number;
  secureUrl: string;
  cloudinaryPublicId: string;
  source: string;
  createdAt: string;
}

interface LeadDocumentationTabProps {
  leadId: string;
  leadStatus?: string;
  onStatusChange?: (newStatus: string) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }) + ' ' + date.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) {
    return (
      <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  }
  if (mimeType === 'application/pdf') {
    return (
      <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    );
  }
  return (
    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

export function LeadDocumentationTab({ leadId, leadStatus, onStatusChange }: LeadDocumentationTabProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadType, setUploadType] = useState<DocumentType>('otro');
  const [uploadDescription, setUploadDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Action states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionDocId, setActionDocId] = useState<string | null>(null);
  
  // Quotes del lead - para saber el estado de cada documento
  const [quotes, setQuotes] = useState<{ _id: string; sourceDocumentId: string; status: string; saleType?: string; sentAt?: string; approvedAt?: string; wonAt?: string }[]>([]);
  
  // Confirmation modal state
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'quote_sent' | 'approved' | 'won' | 'delete' | null>(null);
  const [confirmDocId, setConfirmDocId] = useState<string | null>(null);
  const [selectedSaleType, setSelectedSaleType] = useState<'product' | 'service'>('service');
  
  // Success notification state
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filter state
  const [filter, setFilter] = useState<'all' | 'quotes'>('all');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load documents and quotes
  useEffect(() => {
    async function loadData() {
      try {
        // Load documents
        const docsRes = await api.get<{ documents: Document[] }>('/api/crm/documents', {
          leadId,
        });
        setDocuments(docsRes.documents || []);
        
        // Load quotes for this lead to know their status
        const quotesRes = await api.get<{ data: { _id: string; sourceDocumentId: string; status: string; saleType?: string; sentAt?: string; approvedAt?: string; wonAt?: string }[] }>('/api/crm/quotes', {
          leadId,
        });
        setQuotes(quotesRes.data || []);
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [leadId]);

  // Get quote status for a document
  const getQuoteStatus = (docId: string): { status: string; saleType?: string; sentAt?: string; approvedAt?: string; wonAt?: string } | null => {
    const quote = quotes.find(q => String(q.sourceDocumentId) === docId || q.sourceDocumentId === docId);
    return quote ? { status: quote.status, saleType: quote.saleType, sentAt: quote.sentAt, approvedAt: quote.approvedAt, wonAt: quote.wonAt } : null;
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  }, []);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    const typeLabel = DOCUMENT_TYPE_LABELS[uploadType as DocumentType] || 'Documento';
    const dateStr = new Date().toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    setUploadTitle(`${typeLabel} - ${dateStr}`);
    setShowUploadForm(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('leadId', leadId);
      formData.append('title', uploadTitle);
      formData.append('documentType', uploadType);
      if (uploadDescription) {
        formData.append('description', uploadDescription);
      }

      const res = await api.post<Document>('/api/crm/documents/upload', formData, true);

      setDocuments(prev => [res, ...prev]);
      setShowUploadForm(false);
      setSelectedFile(null);
      setUploadTitle('');
      setUploadType('otro');
      setUploadDescription('');
    } catch (err: any) {
      setError(err.message || 'Error al subir archivo');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    // Open confirmation modal instead of native confirm
    setConfirmDocId(docId);
    setConfirmAction('delete');
    setShowConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDocId) return;
    
    const docId = confirmDocId;
    
    // Close modal
    setShowConfirm(false);
    setConfirmDocId(null);
    setConfirmAction(null);

    try {
      await api.del(`/api/crm/documents/${docId}`);
      setDocuments(prev => prev.filter(d => d._id !== docId));
      setNotification({ type: 'success', message: 'Documento eliminado correctamente' });
      setTimeout(() => setNotification(null), 5000);
    } catch (err) {
      console.error('Error deleting document:', err);
      setError('Error al eliminar documento');
    }
  };

  const handleDocumentActionClick = (docId: string, action: 'quote_sent' | 'approved' | 'won') => {
    // Open confirmation modal instead of native confirm
    setConfirmDocId(docId);
    setConfirmAction(action);
    // Reset sale type selection for 'won' action
    if (action === 'won') {
      setSelectedSaleType('service');
    }
    setShowConfirm(true);
  };

  const handleConfirmAction = async () => {
    if (!confirmDocId || !confirmAction) return;
    
    const docId = confirmDocId;
    const action = confirmAction;
    
    // Close modal
    setShowConfirm(false);
    setConfirmDocId(null);
    setConfirmAction(null);
    
    setActionLoading(action);
    setActionDocId(docId);
    setError(null);

    // Handle approve action (separate API call)
    if (action === 'approved') {
      try {
        const quote = quotes.find(q => String(q.sourceDocumentId) === docId || q.sourceDocumentId === docId);
        if (!quote) {
          throw new Error('Quote no encontrada para este documento');
        }
        await api.post(`/api/crm/quotes/${quote._id}/approve`, {});
        
        // Reload quotes to get updated status
        const quotesRes = await api.get<{ data: { _id: string; sourceDocumentId: string; status: string; saleType?: string; sentAt?: string; approvedAt?: string; wonAt?: string }[] }>('/api/crm/quotes', {
          leadId,
        });
        setQuotes(quotesRes.data || []);
        
        setNotification({ type: 'success', message: 'Presupuesto aprobado correctamente' });
        setTimeout(() => setNotification(null), 5000);
      } catch (err: any) {
        setError(err.message || 'Error al aprobar presupuesto');
      } finally {
        setActionLoading(null);
        setActionDocId(null);
      }
      return;
    }

    // Handle quote_sent and won actions (existing document action API)
    try {
      // Build action body - include saleType only for 'won'
      const actionBody: { action: string; saleType?: 'product' | 'service' } = { action };
      if (action === 'won') {
        actionBody.saleType = selectedSaleType;
      }

      const res = await api.post<{
        success: boolean;
        quoteId: string;
        leadId: string;
        newStatus: string;
        saleType?: string;
        client?: { _id: string };
        workOrder?: { _id: string; workOrderNumber: string; status: string };
      }>(`/api/crm/leads/${leadId}/documents/${docId}/action`, actionBody);

      if (res.success) {
        // Force a small delay to ensure DB is updated
        await new Promise(resolve => setTimeout(resolve, 300));

        // Reload quotes to get updated status
        const quotesRes = await api.get<{ data: { _id: string; sourceDocumentId: string; status: string; saleType?: string; sentAt?: string; approvedAt?: string; wonAt?: string }[] }>('/api/crm/quotes', {
          leadId,
        });
        setQuotes(quotesRes.data || []);
        
        // Notify parent about status change
        if (onStatusChange && res.newStatus) {
          onStatusChange(res.newStatus);
        }
        
        // Show success notification
        if (res.newStatus === 'won') {
          setNotification({ 
            type: 'success', 
            message: res.saleType === 'product'
              ? 'Venta de producto confirmada'
              : `Venta confirmada. OT: ${res.workOrder?.workOrderNumber || '—'} (borrador)` 
          });
        } else {
          setNotification({ type: 'success', message: 'Presupuesto enviado correctamente' });
        }
        
        // Auto-hide notification after 5 seconds
        setTimeout(() => setNotification(null), 5000);
      }
    } catch (err: any) {
      setError(err.message || 'Error al procesar acción');
    } finally {
      setActionLoading(null);
      setActionDocId(null);
    }
  };

  const handleCancel = () => {
    setShowUploadForm(false);
    setSelectedFile(null);
    setUploadTitle('');
    setUploadType('otro');
    setUploadDescription('');
    setError(null);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  // Filter documents
  const filteredDocs = filter === 'quotes' 
    ? documents.filter(d => d.documentType === 'presupuesto' || d.documentType === 'cotizacion')
    : documents;

  return (
    <div className="space-y-4">
      {/* Header with Add button */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">
          Documentación
          <span className="ml-2 text-sm font-normal text-gray-500">
            ({filter === 'quotes' 
              ? documents.filter(d => d.documentType === 'presupuesto' || d.documentType === 'cotizacion').length 
              : documents.length})
          </span>
          <div className="flex gap-1 ml-4 inline-flex">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 text-xs rounded-lg ${filter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilter('quotes')}
              className={`px-3 py-1 text-xs rounded-lg ${filter === 'quotes' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              Presupuestos
            </button>
          </div>
        </h2>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Agregar documento
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
        />
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      {/* Drag & Drop Zone */}
      {documents.length === 0 && !showUploadForm && (
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            dragActive ? 'border-brand-500 bg-brand-50' : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-gray-500">
            Arrastrá y soltá archivos aquí
          </p>
          <p className="text-xs text-gray-400 mt-1">
            o hacé click en "Agregar documento"
          </p>
        </div>
      )}

      {/* Upload Form Modal */}
      {showUploadForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Subir documento
            </h3>

            {selectedFile && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Título *
                </label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                  placeholder="Ej: Presupuesto instalación - 07/08/2026"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo *
                </label>
                <select
                  value={uploadType}
                  onChange={(e) => setUploadType(e.target.value as DocumentType)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                >
                  {DOCUMENT_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción (opcional)
                </label>
                <textarea
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                  placeholder="Detalles adicionales..."
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">
                  {error}
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCancel}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || !uploadTitle}
                className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {uploading ? 'Subiendo...' : 'Subir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document List */}
      {filteredDocs.length > 0 && (
        <div className="space-y-2">
          {filteredDocs.map((doc) => (
            <div
              key={doc._id}
              className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-colors"
            >
              {doc.mimeType.startsWith('image/') ? (
                <img
                  src={doc.secureUrl}
                  alt={doc.title}
                  className="w-12 h-12 object-cover rounded-lg"
                />
              ) : (
                <div className="w-12 h-12 flex items-center justify-center">
                  {getFileIcon(doc.mimeType)}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {doc.title}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>{DOCUMENT_TYPE_LABELS[doc.documentType as DocumentType] || doc.documentType}</span>
                  <span>•</span>
                  <span>{formatDate(doc.createdAt)}</span>
                  <span>•</span>
                  <span>{formatFileSize(doc.fileSize)}</span>
                </div>
              </div>

              {/* Action Buttons - based on quote status from API */}
              <div className="flex flex-col gap-1 items-stretch">
                {/* Only show action buttons for quote documents */}
                {(doc.documentType === 'presupuesto' || doc.documentType === 'cotizacion') && (() => {
                    const quoteStatus = getQuoteStatus(doc._id);
                    
                    // Quote sent (presupuesto enviado, esperando aprobación)
                    if (quoteStatus?.status === 'sent') {
                      return (
                        <>
                          <span className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 rounded-lg">
                            ✓ Presupuesto enviado
                          </span>
                          {/* Botón para aprobar el presupuesto */}
                          <button
                            onClick={() => handleDocumentActionClick(doc._id, 'approved')}
                            disabled={actionLoading !== null}
                            className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors cursor-pointer"
                            title="Aprobar presupuesto"
                          >
                            {actionLoading === 'approved' && actionDocId === doc._id ? '...' : 'Aprobada'}
                          </button>
                          {/* Allow confirm sale even after sending */}
                          {leadStatus !== 'won' && (
                            <button
                              onClick={() => handleDocumentActionClick(doc._id, 'won')}
                              disabled={actionLoading !== null}
                              className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 disabled:opacity-50 transition-colors cursor-pointer"
                              title="Confirmar venta y crear OT"
                            >
                              {actionLoading === 'won' && actionDocId === doc._id ? '...' : 'Confirmar Venta'}
                            </button>
                          )}
                        </>
                      );
                    }
                    
                    // Quote approved (presupuesto aprobado)
                    if (quoteStatus?.status === 'approved') {
                      return (
                        <>
                          <span className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 rounded-lg">
                            ✓ Presupuesto aprobado
                          </span>
                          {leadStatus !== 'won' && (
                            <button
                              onClick={() => handleDocumentActionClick(doc._id, 'won')}
                              disabled={actionLoading !== null}
                              className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 disabled:opacity-50 transition-colors cursor-pointer"
                              title="Confirmar venta y crear OT"
                            >
                              {actionLoading === 'won' && actionDocId === doc._id ? '...' : 'Confirmar Venta'}
                            </button>
                          )}
                        </>
                      );
                    }
                    
                    // Direct sale or lead won (venta confirmada)
                    if (quoteStatus?.status === 'direct_sale' || leadStatus === 'won') {
                      const wonDate = quoteStatus?.wonAt ? formatDate(quoteStatus.wonAt) : (quoteStatus?.approvedAt ? formatDate(quoteStatus.approvedAt) : '');
                      let saleTypeLabel = '';
                      if (quoteStatus?.saleType === 'product') {
                        saleTypeLabel = 'de producto';
                      } else if (quoteStatus?.saleType === 'service') {
                        saleTypeLabel = 'de servicio';
                      }
                      return (
                        <span className="px-3 py-1.5 text-xs font-medium text-white bg-gray-800 rounded-lg">
                          Venta confirmada {saleTypeLabel ? `${saleTypeLabel} ` : ''}{wonDate ? `- ${wonDate}` : ''}
                        </span>
                      );
                    }
                    
                    // No quote yet - show action buttons
                    return (
                      <>
                        <button
                          onClick={() => handleDocumentActionClick(doc._id, 'quote_sent')}
                          disabled={actionLoading !== null}
                          className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors cursor-pointer"
                          title="Enviar presupuesto al cliente"
                        >
                          {actionLoading === 'quote_sent' && actionDocId === doc._id ? '...' : 'Enviar Presupuesto'}
                        </button>
                        {leadStatus !== 'won' && (
                          <button
                            onClick={() => handleDocumentActionClick(doc._id, 'won')}
                            disabled={actionLoading !== null}
                            className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 disabled:opacity-50 transition-colors cursor-pointer"
                            title="Confirmar venta y crear OT"
                          >
                            {actionLoading === 'won' && actionDocId === doc._id ? '...' : 'Confirmar Venta'}
                          </button>
                        )}
                      </>
                    );
                  })()}
              </div>

              <div className="flex flex-col gap-1 items-stretch">
                <a
                  href={doc.secureUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-gray-500 hover:text-brand-600 transition-colors"
                  title="Ver"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </a>
                <button
                  onClick={() => handleDelete(doc._id)}
                  className="p-2 text-gray-500 hover:text-red-600 transition-colors"
                  title="Eliminar"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Confirmar acción</h3>
                <p className="text-sm text-gray-500">
                  {confirmAction === 'quote_sent' 
                    ? 'Esta acción confirma el envío de un presupuesto al cliente. ¿Estás seguro de continuar?'
                    : confirmAction === 'approved'
                    ? 'Esta acción aprobará el presupuesto. ¿Estás seguro de continuar?'
                    : confirmAction === 'won'
                    ? selectedSaleType === 'product'
                      ? 'Esta acción confirmará la venta como producto (sin orden de trabajo). ¿Estás seguro de continuar?'
                      : 'Esta acción confirmará la venta y creará una orden de trabajo en estado borrador. ¿Estás seguro de continuar?'
                    : '¿Estás seguro de eliminar este documento? Esta acción no se puede deshacer.'
                  }
                </p>

                {/* Sale type selection for 'won' action */}
                {confirmAction === 'won' && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-700 mb-2">Tipo de venta:</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedSaleType('product')}
                        className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors cursor-pointer ${
                          selectedSaleType === 'product'
                            ? 'bg-brand-600 text-white border-brand-600'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        Producto
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedSaleType('service')}
                        className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors cursor-pointer ${
                          selectedSaleType === 'service'
                            ? 'bg-brand-600 text-white border-brand-600'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        Servicio
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {selectedSaleType === 'product'
                        ? 'Solo se registrará la venta, sin orden de trabajo.'
                        : 'Se creará una orden de trabajo en estado borrador.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowConfirm(false);
                  setConfirmDocId(null);
                  setConfirmAction(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={confirmAction === 'delete' ? handleConfirmDelete : handleConfirmAction}
                disabled={actionLoading !== null}
                className={`px-4 py-2 text-white rounded-lg transition-colors cursor-pointer ${
                  confirmAction === 'won' 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : confirmAction === 'delete'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                } disabled:opacity-50`}
              >
                {actionLoading ? 'Procesando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Notification */}
      {notification && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in-up z-50">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>{notification.message}</span>
          <button 
            onClick={() => setNotification(null)}
            className="ml-2 hover:text-green-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span>{error}</span>
          <button 
            onClick={() => setError(null)}
            className="ml-2 hover:text-red-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}