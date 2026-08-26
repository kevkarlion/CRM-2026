'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';
import { Drawer } from '@/lib/components/Drawer';

interface WhatsAppTemplateVariable {
  index: number;
  field: string;
  defaultValue?: string;
}

interface WhatsAppTemplate {
  _id: string;
  name: string;
  language: string;
  category: 'TRANSACTIONAL' | 'MARKETING' | 'AUTHENTICATION';
  variables: WhatsAppTemplateVariable[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface WhatsAppTemplateSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  onSuccess?: (result: { messageId: string; templateName: string }) => void;
}

export function WhatsAppTemplateSelector({
  isOpen,
  onClose,
  clientId,
  clientName,
  onSuccess,
}: WhatsAppTemplateSelectorProps) {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [variableValues, setVariableValues] = useState<Record<number, string>>({});

  const selectedTemplate = templates.find((t) => t._id === selectedTemplateId);

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
      resetForm();
    }
  }, [isOpen]);

  async function loadTemplates() {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<WhatsAppTemplate[]>('/api/whatsapp/templates');
      setTemplates(data);
    } catch (err) {
      setError('No se pudieron cargar las plantillas');
      console.error('Error loading templates:', err);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setSelectedTemplateId('');
    setVariableValues({});
    setError(null);
    setSuccessMessage(null);
  }

  function handleTemplateSelect(templateId: string) {
    setSelectedTemplateId(templateId);
    // Initialize variable values with defaults or empty
    const template = templates.find((t) => t._id === templateId);
    if (template) {
      const initialValues: Record<number, string> = {};
      template.variables.forEach((v) => {
        initialValues[v.index] = v.defaultValue || '';
      });
      setVariableValues(initialValues);
    }
  }

  function handleVariableChange(index: number, value: string) {
    setVariableValues((prev) => ({
      ...prev,
      [index]: value,
    }));
  }

  function renderPreview(): string {
    if (!selectedTemplate) return '';

    // If we have the template content, show the full message with variables replaced
    if (selectedTemplate.content) {
      let message = selectedTemplate.content;
      // Replace {{1}}, {{2}}, etc. with actual values
      selectedTemplate.variables.forEach((v) => {
        const value = variableValues[v.index] || `[${v.field}]`;
        message = message.replace(new RegExp(`\\{\\{${v.index}\\}\\}`, 'g'), value);
      });
      return message;
    }

    // Fallback: show variable structure
    let preview = `📋 Plantilla: ${selectedTemplate.name}\n`;
    preview += `🌐 Idioma: ${selectedTemplate.language}\n\n`;
    
    preview += `📝 Variables que se enviarán:\n`;
    selectedTemplate.variables.forEach((v) => {
      const value = variableValues[v.index] || `[${v.field}]`;
      preview += `  {{${v.index}}} → ${v.field}: ${value}\n`;
    });

    return preview;
  }

  async function handleSend() {
    if (!selectedTemplateId) {
      setError('Selecciona una plantilla');
      return;
    }

    try {
      setSending(true);
      setError(null);

      const result = await api.post<{
        success: boolean;
        messageId: string;
        templateName: string;
      }>('/api/whatsapp/templates/send', {
        clientId,
        templateId: selectedTemplateId,
        variableOverrides: variableValues, // Send the edited values
      });

      if (result.success) {
        setSuccessMessage(`Mensaje enviado con plantilla "${result.templateName}"`);
        onSuccess?.({ messageId: result.messageId, templateName: result.templateName });
        
        // Close after short delay
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar mensaje');
    } finally {
      setSending(false);
    }
  }

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Drawer isOpen={isOpen} onClose={handleClose} title="Enviar plantilla de WhatsApp">
      <div className="space-y-4">
        {/* Success message */}
        {successMessage && (
          <div className="rounded-lg bg-success-50 px-4 py-3 text-sm text-success-700">
            {successMessage}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">
            {error}
          </div>
        )}

        {/* Loading templates */}
        {loading ? (
          <div className="space-y-2">
            <div className="h-10 bg-gray-200 rounded animate-pulse" />
            <div className="h-10 bg-gray-200 rounded animate-pulse" />
            <div className="h-10 bg-gray-200 rounded animate-pulse" />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No hay plantillas disponibles</p>
            <p className="text-sm mt-1">Crea plantillas en el panel de administración</p>
          </div>
        ) : (
          <>
            {/* Template selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Seleccionar plantilla <span className="text-danger-500">*</span>
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => handleTemplateSelect(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                disabled={sending}
              >
                <option value="">-- Selecciona una plantilla --</option>
                {templates.map((template) => (
                  <option key={template._id} value={template._id}>
                    {template.name} ({template.language}) - {template.category}
                  </option>
                ))}
              </select>
            </div>

            {/* Template details and variables */}
            {selectedTemplate && selectedTemplate.variables.length > 0 && (
              <div className="border border-gray-200 rounded-lg p-4 space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Variables</h4>
                  {selectedTemplate.variables.map((variable) => (
                    <div key={variable.index} className="mb-3">
                      <label className="block text-sm text-gray-600 mb-1">
                        {`{{${variable.index}}} → ${variable.field}`}
                        {variable.defaultValue && (
                          <span className="text-gray-400 ml-1">(default: {variable.defaultValue})</span>
                        )}
                      </label>
                      <input
                        type="text"
                        value={variableValues[variable.index] || ''}
                        onChange={(e) => handleVariableChange(variable.index, e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                        placeholder={`Ingresa ${variable.field}`}
                        disabled={sending}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Preview */}
            {selectedTemplate && (
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Vista previa</h4>
                <div className="text-sm text-gray-700 whitespace-pre-wrap">
                  {renderPreview()}
                </div>
              </div>
            )}

            {/* Client info */}
            <div className="text-sm text-gray-500">
              Enviando a: <span className="font-medium text-gray-700">{clientName}</span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSend}
                disabled={!selectedTemplateId || sending}
                className="rounded-lg bg-success-600 px-5 py-2 text-sm font-medium text-white hover:bg-success-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {sending ? 'Enviando...' : 'Enviar mensaje'}
              </button>
              <button
                onClick={handleClose}
                disabled={sending}
                className="rounded-lg border border-gray-200 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}
