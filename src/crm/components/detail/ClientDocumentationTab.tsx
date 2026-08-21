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

interface ClientDocumentationTabProps {
  clientId: string;
  clientPhone?: string;
  onStatusChange?: (newStatus: string) => void;
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
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

// Export directly without wrapper
export function ClientDocumentationTab({ clientId, clientPhone = '', onStatusChange }: ClientDocumentationTabProps) {
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

  const [quotes, setQuotes] = useState<{ _id: string; sourceDocumentId: string; status: string; saleType?: string; sentAt?: string; approvedAt?: string; wonAt?: string }[]>([]);
  const [remitos, setRemitos] = useState<{ _id: string; sourceDocumentId: string; status: string; sentAt?: string }[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionDocId, setActionDocId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'quote_sent' | 'approved' | 'won' | 'delete' | 'remito_sent' | null>(null);
  const [confirmDocId, setConfirmDocId] = useState<string | null>(null);
  const [selectedSaleType, setSelectedSaleType] = useState<'product' | 'service'>('service');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showUploadSuccess, setShowUploadSuccess] = useState(false);
  const [filter, setFilter] = useState<'all' | 'quotes' | 'remitos'>('all');
  const [sendingDocId, setSendingDocId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const docsRes = await api.get<{ documents: Document[] }>('/api/crm/documents', { clientId });
        setDocuments(docsRes?.documents || []);
        
        const quotesRes = await api.get<{ data: { _id: string; sourceDocumentId: string; status: string; saleType?: string; sentAt?: string; approvedAt?: string; wonAt?: string }[] }>('/api/crm/quotes', { clientId });
        setQuotes(quotesRes?.data || []);

        const remitosRes = await api.get<{ data: { _id: string; sourceDocumentId: string; status: string; sentAt?: string }[] }>('/api/crm/remitos', { clientId });
        setRemitos(remitosRes?.data || []);
      } catch (err) {
        console.error('Error loading data:', err);
        setDocuments([]);
        setQuotes([]);
        setRemitos([]);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [clientId]);

  const getQuoteStatus = (docId: string): { status: string; saleType?: string; sentAt?: string; approvedAt?: string; wonAt?: string } | null => {
    const quote = quotes.find(q => String(q.sourceDocumentId) === docId || q.sourceDocumentId === docId);
    return quote ? { status: quote.status, saleType: quote.saleType, sentAt: quote.sentAt, approvedAt: quote.approvedAt, wonAt: quote.wonAt } : null;
  };

  const getRemitoStatus = (docId: string): { status: string; sentAt?: string } | null => {
    const remito = remitos.find(r => String(r.sourceDocumentId) === docId || r.sourceDocumentId === docId);
    return remito ? { status: remito.status, sentAt: remito.sentAt } : null;
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
    e.preventDefault();
    const files = e.target.files;
    if (files && files[0]) {
      setSelectedFile(files[0]);
      setUploadTitle(`${files[0].name.split('.')[0]} - ${new Date().toLocaleDateString('es-AR')}`);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('clientId', clientId);
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
      setShowUploadSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Error al subir archivo');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    setConfirmDocId(docId);
    setConfirmAction('delete');
    setShowConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDocId) return;
    
    const docId = confirmDocId;
    
    setShowConfirm(false);
    setConfirmDocId(null);
    setConfirmAction(null);

    try {
      await api.del(`/api/crm/documents/${docId}`);
      setDocuments(prev => prev.filter(d => d._id !== docId));
    } catch (err) {
      console.error('Error deleting document:', err);
      setError('Error al eliminar documento');
    }
  };

  const handleDocumentActionClick = (docId: string, action: 'quote_sent' | 'approved' | 'won') => {
    // Open confirmation modal instead of directly executing
    setConfirmDocId(docId);
    setConfirmAction(action);
    // Reset sale type selection for 'won' action
    if (action === 'won') {
      setSelectedSaleType('service');
    }
    setShowConfirm(true);
  };

  const handleRemitoSendClick = (docId: string) => {
    setConfirmDocId(docId);
    setConfirmAction('remito_sent');
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

    try {
      // Handle remito_sent FIRST - before quote API
      if (action === 'remito_sent') {
        const doc = documents.find(d => d._id === docId);
        if (!doc) {
          throw new Error('Documento no encontrado');
        }

        if (!clientPhone) {
          throw new Error('Cliente sin teléfono registrado');
        }

        // Send to WhatsApp
        const phone = clientPhone.replace(/[^\d+]/g, '');
        const response = await fetch('/api/webhook/whatsapp/send-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: doc.secureUrl,
            to: phone,
            caption: doc.title,
            clientId,
            mimeType: doc.mimeType,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Error al enviar por WhatsApp');
        }

        // Create remito record
        await api.post('/api/crm/remitos', {
          documentId: doc._id,
          clientId,
        });

        // Small delay to ensure DB is updated
        await new Promise(resolve => setTimeout(resolve, 500));

        // Reload remitos
        const remitosRes = await api.get<{ data: { _id: string; sourceDocumentId: string; status: string; sentAt?: string }[] }>('/api/crm/remitos', { clientId });
        setRemitos(remitosRes?.data || []);
        return;
      }

      // Handle approve action (separate API call to approve the quote)
      if (action === 'approved') {
        const quote = quotes.find(q => String(q.sourceDocumentId) === docId || q.sourceDocumentId === docId);
        if (!quote) {
          throw new Error('Quote no encontrada para este documento');
        }
        await api.post(`/api/crm/quotes/${quote._id}/approve`, {});
        
        // Reload quotes and documents to get updated status
        const quotesRes = await api.get<{ data: { _id: string; sourceDocumentId: string; status: string; sentAt?: string; approvedAt?: string; wonAt?: string }[] }>('/api/crm/quotes', {
          clientId,
        });
        setQuotes(quotesRes?.data || []);
        
        const docsRes = await api.get<{ documents: Document[] }>('/api/crm/documents', { clientId });
        setDocuments(docsRes?.documents || []);
        
        // Notify parent to update operation status
        if (onStatusChange) {
          onStatusChange('quote_approved');
        }
        return;
      }

      // Handle quote_sent - send to WhatsApp AND create quote
      if (action === 'quote_sent') {
        const doc = documents.find(d => d._id === docId);
        if (doc && clientPhone) {
          try {
            // Send to WhatsApp first
            const phone = clientPhone.replace(/[^\d+]/g, '');
            const response = await fetch('/api/webhook/whatsapp/send-document', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                url: doc.secureUrl,
                to: phone,
                caption: doc.title,
                clientId,
                mimeType: doc.mimeType,
              }),
            });

            if (!response.ok) {
              const data = await response.json();
              throw new Error(data.error || 'Error al enviar por WhatsApp');
            }
          } catch (err: any) {
            console.error('Error sending to WhatsApp:', err);
            // Continue with quote creation even if WhatsApp fails
          }
        }
      }

      // Handle quote_sent and won actions (document action API)
      const actionBody: { action: string; saleType?: 'product' | 'service' } = { action };
      if (action === 'won') {
        actionBody.saleType = selectedSaleType;
      }
      const res = await api.post<{ success: boolean; quote?: any }>(
        `/api/crm/clients/${clientId}/documents/${docId}/action`,
        actionBody
      );

      if (res.success) {
        // Force a small delay to ensure DB is updated
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Refresh quotes and documents to get updated status
        const quotesRes = await api.get<{ data: { _id: string; sourceDocumentId: string; status: string; saleType?: string; sentAt?: string; approvedAt?: string; wonAt?: string }[] }>('/api/crm/quotes', { clientId });
        setQuotes(quotesRes?.data || []);
        
        const docsRes = await api.get<{ documents: Document[] }>('/api/crm/documents', { clientId });
        setDocuments(docsRes?.documents || []);
        
        // Notify parent to update operation status
        if ((action === 'won' || action === 'approved' || action === 'quote_sent') && onStatusChange) {
          if (action === 'won') {
            onStatusChange('sale_confirmed');
          } else if (action === 'approved') {
            onStatusChange('quote_approved');
          } else if (action === 'quote_sent') {
            onStatusChange('quote_pending');
          }
        }
      }
    } catch (err: any) {
      console.error('Error performing document action:', err);
      setError(err.message || 'Error al realizar la acción');
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

  const handleSendToWhatsApp = async (doc: Document) => {
    if (!clientPhone) {
      setNotification({ type: 'error', message: 'Cliente sin teléfono registrado' });
      return;
    }

    // Extract phone number (remove any non-numeric characters except +)
    const phone = clientPhone.replace(/[^\d+]/g, '');
    
    try {
      setSendingDocId(doc._id);
      
      // Send to WhatsApp
      const response = await fetch('/api/webhook/whatsapp/send-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: doc.secureUrl,
          to: phone,
          caption: doc.title,
          clientId,
          mimeType: doc.mimeType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al enviar');
      }

      // If it's a remito, also create the remito record
      if (doc.documentType === 'remito') {
        await api.post('/api/crm/remitos', {
          documentId: doc._id,
          clientId,
        });
        // Reload remitos to get updated status
        const remitosRes = await api.get<{ data: { _id: string; sourceDocumentId: string; status: string; sentAt?: string }[] }>('/api/crm/remitos', { clientId });
        setRemitos(remitosRes?.data || []);
      }
    } catch (err: any) {
      console.error('Error sending to WhatsApp:', err);
      setNotification({ type: 'error', message: err.message || 'Error al enviar por WhatsApp' });
    } finally {
      setSendingDocId(null);
    }
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

  const filteredDocs = filter === 'quotes' 
    ? documents.filter(d => d.documentType === 'presupuesto' || d.documentType === 'cotizacion')
    : filter === 'remitos'
    ? documents.filter(d => d.documentType === 'remito')
    : documents;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 items-center">
        <div className="flex flex-col gap-2 items-center sm:items-start">
          <h2 className="text-lg font-semibold text-gray-900">
            Documentación
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({filter === 'quotes' 
                ? documents.filter(d => d.documentType === 'presupuesto' || d.documentType === 'cotizacion').length 
                : filter === 'remitos'
                ? documents.filter(d => d.documentType === 'remito').length
                : documents.length})
            </span>
          </h2>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-4 py-2 text-sm rounded-lg font-medium ${filter === 'all' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setFilter('quotes')}
              className={`px-4 py-2 text-sm rounded-lg font-medium ${filter === 'quotes' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              Presupuestos
            </button>
            <button
              type="button"
              onClick={() => setFilter('remitos')}
              className={`px-4 py-2 text-sm rounded-lg font-medium ${filter === 'remitos' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              Remitos
            </button>
          </div>
        </div>
        
        {/* Add button */}
        <button 
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full inline-flex justify-center items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors cursor-pointer sm:w-auto"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Agregar</span>
        </button>
        
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const files = e.target.files;
            if (files && files[0]) {
              setSelectedFile(files[0]);
              setUploadTitle(`${files[0].name.split('.')[0]} - ${new Date().toLocaleDateString('es-AR')}`);
              setShowUploadForm(true);
            }
          }}
          accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
        />
      </div>

      {/* Notification */}
      {notification && (
        <div className={`p-3 rounded-lg text-sm ${notification.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {notification.message}
        </div>
      )}

      {/* Drag & Drop */}
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
          <p className="text-gray-500">Arrastrá y soltá archivos aquí</p>
          <p className="text-xs text-gray-400 mt-1">o hacé click en "Agregar documento"</p>
        </div>
      )}

      {/* Upload Form Modal */}
      {showUploadForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-xl p-4 sm:p-6 w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Subir documento</h3>
              <button 
                onClick={handleCancel}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {selectedFile ? (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
              </div>
            ) : (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Seleccionar archivo *</label>
                <input
                  type="file"
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files && files[0]) {
                      setSelectedFile(files[0]);
                      setUploadTitle(`${files[0].name.split('.')[0]} - ${new Date().toLocaleDateString('es-AR')}`);
                    }
                  }}
                  accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                  placeholder="Ej: Presupuesto instalación - 07/08/2026"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (opcional)</label>
                <textarea
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                  placeholder="Detalles adicionales..."
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-6">
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 px-4 py-2.5 sm:py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer w-full sm:w-auto"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!selectedFile) {
                    setError('Debe seleccionar un archivo');
                    return;
                  }
                  handleUpload();
                }}
                disabled={uploading || !uploadTitle || !selectedFile}
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
        <div className="space-y-3">
          {filteredDocs.map((doc) => (
            <div key={doc._id} className="flex flex-col sm:flex-row sm:items-start gap-3 p-3 sm:p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-colors">
              {/* File thumbnail - smaller on mobile */}
              <div className="shrink-0">
                {doc.mimeType.startsWith('image/') ? (
                  <img src={doc.secureUrl} alt={doc.title} className="w-10 h-10 sm:w-12 sm:h-12 object-cover rounded-lg" />
                ) : (
                  <div className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center">
                    {getFileIcon(doc.mimeType)}
                  </div>
                )}
              </div>
              
              {/* File info and actions - left side */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{doc.title}</p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 mt-1">
                  <span className="shrink-0">{DOCUMENT_TYPE_LABELS[doc.documentType as DocumentType] || doc.documentType}</span>
                  <span className="hidden sm:inline">•</span>
                  <span className="shrink-0">{formatDate(doc.createdAt)}</span>
                  <span className="hidden sm:inline">•</span>
                  <span className="shrink-0">{formatFileSize(doc.fileSize)}</span>
                </div>

                {/* Action Buttons - presupuestos and remitos */}
                {(doc.documentType === 'presupuesto' || doc.documentType === 'cotizacion') && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {(() => {
                      const quoteStatus = getQuoteStatus(doc._id);
                      
                      // Quote sent (presupuesto enviado, esperando aprobación)
                      if (quoteStatus?.status === 'sent') {
                        const sentDate = quoteStatus.sentAt ? formatDate(quoteStatus.sentAt) : '';
                        return (
                          <>
                            <span className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-md">
                              Enviado {sentDate ? `- ${sentDate}` : ''}
                            </span>
                            <button
                              onClick={() => handleDocumentActionClick(doc._id, 'approved')}
                              disabled={actionLoading !== null}
                              className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
                            >
                              {actionLoading === 'approved' && actionDocId === doc._id ? 'Procesando...' : 'Presupuesto aprobado'}
                            </button>
                            <button
                              onClick={() => handleDocumentActionClick(doc._id, 'won')}
                              disabled={actionLoading !== null}
                              className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
                            >
                              {actionLoading === 'won' && actionDocId === doc._id ? 'Procesando...' : 'Confirmar venta'}
                            </button>
                          </>
                        );
                      }
                      
                      // Quote approved (presupuesto aprobado)
                      if (quoteStatus?.status === 'approved') {
                        const approvedDate = quoteStatus.approvedAt ? formatDate(quoteStatus.approvedAt) : '';
                        return (
                          <>
                            <span className="px-3 py-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 rounded-md">
                              Aprobado {approvedDate ? `- ${approvedDate}` : ''}
                            </span>
                            <button
                              onClick={() => handleDocumentActionClick(doc._id, 'won')}
                              disabled={actionLoading !== null}
                              className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
                            >
                              {actionLoading === 'won' && actionDocId === doc._id ? 'Procesando...' : 'Confirmar venta'}
                            </button>
                          </>
                        );
                      }
                      
                      // Direct sale or won (venta confirmada)
                      if (quoteStatus?.status === 'direct_sale') {
                        // Use wonAt, fallback to approvedAt or convertedAt for older sales
                        const wonDate = quoteStatus.wonAt ? formatDate(quoteStatus.wonAt) : (quoteStatus.approvedAt ? formatDate(quoteStatus.approvedAt) : '');
                        
                        // Determine sale type label
                        let saleTypeLabel = '';
                        if (quoteStatus.saleType === 'product') {
                          saleTypeLabel = 'de producto';
                        } else if (quoteStatus.saleType === 'service') {
                          saleTypeLabel = 'de servicio';
                        }
                        
                        return (
                          <span className="px-3 py-1.5 text-xs font-medium text-white bg-gray-800 rounded-md">
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
                            className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors cursor-pointer"
                          >
                            {actionLoading === 'quote_sent' && actionDocId === doc._id ? 'Enviando...' : 'Enviar presupuesto'}
                          </button>
                          <button
                            onClick={() => handleDocumentActionClick(doc._id, 'won')}
                            disabled={actionLoading !== null}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
                          >
                            {actionLoading === 'won' && actionDocId === doc._id ? 'Procesando...' : 'Confirmar venta'}
                          </button>
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* Remito buttons */}
                {doc.documentType === 'remito' && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {(() => {
                      const remitoStatus = getRemitoStatus(doc._id);
                      
                      if (remitoStatus?.status === 'sent') {
                        const sentDate = remitoStatus.sentAt ? formatDate(remitoStatus.sentAt) : '';
                        return (
                          <span className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-md">
                            Enviado {sentDate ? `- ${sentDate}` : ''}
                          </span>
                        );
                      }
                      
                      // Not sent yet - show send button
                      return (
                        <button
                          onClick={() => handleRemitoSendClick(doc._id)}
                          disabled={actionLoading !== null}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
                        >
                          {actionLoading !== null ? 'Enviando...' : 'Enviar remito'}
                        </button>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Right side - Download and Delete for ALL documents */}
              <div className="flex gap-2 mt-3 sm:mt-0 sm:shrink-0">
                {/* Download button */}
                <a
                  href={doc.secureUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                  title="Descargar"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </a>
                {/* Delete button */}
                <button
                  onClick={() => handleDelete(doc._id)}
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  title="Eliminar"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {documents.length === 0 && !showUploadForm && (
        <div className="text-center py-8 text-gray-500">
          No hay documentos cargados
        </div>
      )}

      {/* Confirm Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-xl p-4 sm:p-6 w-full sm:max-w-sm">
            <div className="flex items-start gap-3 mb-4">
              {confirmAction === 'won' ? (
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : confirmAction === 'approved' ? (
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              ) : confirmAction === 'delete' ? (
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
              )}
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {confirmAction === 'quote_sent' 
                    ? 'Enviar presupuesto' 
                    : confirmAction === 'approved'
                    ? 'Aprobar presupuesto'
                    : confirmAction === 'won'
                    ? 'Confirmar venta'
                    : confirmAction === 'remito_sent'
                    ? 'Enviar remito'
                    : 'Eliminar documento'}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {confirmAction === 'quote_sent' 
                    ? 'Esta acción enviará el presupuesto al cliente. ¿Estás seguro de continuar?'
                    : confirmAction === 'approved'
                    ? 'Esta acción aprobará el presupuesto. ¿Estás seguro de continuar?'
                    : confirmAction === 'won'
                    ? selectedSaleType === 'product' 
                      ? 'Esta acción confirmará la venta como producto (sin orden de trabajo). ¿Estás seguro de continuar?'
                      : 'Esta acción confirmará la venta y creará una orden de trabajo en estado borrador. ¿Estás seguro de continuar?'
                    : confirmAction === 'remito_sent'
                    ? 'Esta acción enviará el remito al chat de WhatsApp del cliente. ¿Estás seguro de continuar?'
                    : '¿Estás seguro de eliminar este documento? Esta acción no se puede deshacer.'}
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
            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
              <button
                onClick={() => {
                  setShowConfirm(false);
                  setConfirmDocId(null);
                  setConfirmAction(null);
                }}
                className="px-4 py-2.5 sm:py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer w-full sm:w-auto"
              >
                Cancelar
              </button>
              <button
                onClick={confirmAction === 'delete' ? handleConfirmDelete : handleConfirmAction}
                disabled={actionLoading !== null}
                className={`px-4 py-2.5 sm:py-2 text-white rounded-lg transition-colors cursor-pointer w-full sm:w-auto ${
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

      {/* Upload Success Modal */}
      {showUploadSuccess && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-xl p-6 w-full sm:max-w-sm text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Documento subido correctamente
            </h3>
            <button
              onClick={() => setShowUploadSuccess(false)}
              className="px-6 py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors cursor-pointer w-full"
            >
              Aceptar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Also export as default for backward compatibility
export default ClientDocumentationTab;
