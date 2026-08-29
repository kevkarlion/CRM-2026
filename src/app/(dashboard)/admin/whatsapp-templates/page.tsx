'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api-client';

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
  content?: string;
  variables: WhatsAppTemplateVariable[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const CATEGORIES = [
  { value: 'TRANSACTIONAL', label: 'Transaccional' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'AUTHENTICATION', label: 'Autenticación' },
];

const CATEGORY_LABEL: Record<string, string> = {
  TRANSACTIONAL: 'Transaccional',
  MARKETING: 'Marketing',
  AUTHENTICATION: 'Autenticación',
};

const CATEGORY_BADGE: Record<string, string> = {
  TRANSACTIONAL: 'bg-sky-600 text-white',
  MARKETING: 'bg-violet-600 text-white',
  AUTHENTICATION: 'bg-gray-700 text-white',
};

const CATEGORY_ACCENT: Record<string, string> = {
  TRANSACTIONAL: 'border-l-sky-500',
  MARKETING: 'border-l-violet-500',
  AUTHENTICATION: 'border-l-gray-500',
};

const LANGUAGES = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'Inglés' },
  { value: 'pt', label: 'Portugués' },
];

export default function WhatsAppTemplatesAdminPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WhatsAppTemplate | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [formName, setFormName] = useState('');
  const [formLanguage, setFormLanguage] = useState('es');
  const [formCategory, setFormCategory] = useState<'TRANSACTIONAL' | 'MARKETING' | 'AUTHENTICATION'>('TRANSACTIONAL');
  const [formContent, setFormContent] = useState('');
  const [formVariables, setFormVariables] = useState<WhatsAppTemplateVariable[]>([]);

  const loadTemplates = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  function resetForm() {
    setFormName('');
    setFormLanguage('es');
    setFormCategory('TRANSACTIONAL');
    setFormContent('');
    setFormVariables([]);
    setFormError(null);
    setEditingTemplate(null);
  }

  function openCreateForm() {
    resetForm();
    setShowForm(true);
  }

  function openEditForm(template: WhatsAppTemplate) {
    setEditingTemplate(template);
    setFormName(template.name);
    setFormLanguage(template.language);
    setFormCategory(template.category);
    setFormContent((template as any).content || '');
    setFormVariables(template.variables || []);
    setFormError(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    resetForm();
  }

  function addVariable() {
    const newIndex = formVariables.length + 1;
    setFormVariables([
      ...formVariables,
      { index: newIndex, field: '', defaultValue: '' },
    ]);
  }

  function removeVariable(index: number) {
    const updated = formVariables
      .filter((v) => v.index !== index)
      .map((v, i) => ({ ...v, index: i + 1 }));
    setFormVariables(updated);
  }

  function updateVariable(index: number, field: string, value: string) {
    setFormVariables((prev) =>
      prev.map((v) => (v.index === index ? { ...v, [field]: value } : v))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formName.trim() || !formLanguage || !formCategory) {
      setFormError('Nombre, idioma y categoría son requeridos');
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);

      const payload = {
        name: formName.trim(),
        language: formLanguage,
        category: formCategory,
        content: formContent.trim() || undefined,
        variables: formVariables.filter((v) => v.field.trim()),
      };

      if (editingTemplate) {
        // Update existing template
        await api.put(`/api/whatsapp/templates/${editingTemplate._id}`, payload);
      } else {
        // Create new template
        await api.post('/api/whatsapp/templates', payload);
      }

      await loadTemplates();
      closeForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar plantilla');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(templateId: string) {
    if (!confirm('¿Estás seguro de eliminar esta plantilla?')) return;

    try {
      setLoading(true);
      await api.delete(`/api/whatsapp/templates/${templateId}`);
      await loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar plantilla');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Plantillas de WhatsApp</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestiona las plantillas de mensaje para WhatsApp Business API
          </p>
        </div>
        <button
          onClick={openCreateForm}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
        >
          + Nueva plantilla
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {error}
        </div>
      )}

      {/* Templates list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-gray-500">No hay plantillas configuradas</p>
          <button
            onClick={openCreateForm}
            className="mt-4 text-sm text-brand-600 font-medium hover:underline"
          >
            Crear primera plantilla
          </button>
        </div>
      ) : (
        <>
        <div className="hidden sm:block bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Nombre
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Idioma
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Categoría
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Variables
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {templates.map((template) => (
                <tr key={template._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{template.name}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{template.language}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        template.category === 'TRANSACTIONAL'
                          ? 'bg-blue-100 text-blue-800'
                          : template.category === 'MARKETING'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {template.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {template.variables?.length || 0} variable(s)
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openEditForm(template)}
                      className="text-brand-600 hover:text-brand-700 text-sm font-medium mr-3"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(template._id)}
                      className="text-danger-600 hover:text-danger-700 text-sm font-medium"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="sm:hidden space-y-3">
          {templates.map((template) => (
            <div
              key={template._id}
              className={`bg-white border border-gray-200 rounded-xl p-4 shadow-sm border-l-4 ${CATEGORY_ACCENT[template.category] || 'border-l-gray-500'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{template.name}</p>
                  <span className={`inline-flex items-center px-2 py-0.5 mt-1.5 text-xs font-medium rounded-full ${CATEGORY_BADGE[template.category] || 'bg-gray-700 text-white'}`}>
                    {CATEGORY_LABEL[template.category] || template.category}
                  </span>
                </div>
                <span className="text-xs text-gray-400 shrink-0 uppercase">{template.language}</span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="bg-gray-50 rounded-lg px-3 py-2">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Variables</span>
                  <p className="text-sm font-medium text-gray-900">{template.variables?.length || 0}</p>
                </div>
                <div className="bg-gray-50 rounded-lg px-3 py-2">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Actualizado</span>
                  <p className="text-sm font-medium text-gray-900 truncate">{new Date(template.updatedAt).toLocaleDateString('es-CL')}</p>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2">
                <button
                  onClick={() => openEditForm(template)}
                  className="flex-1 inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium bg-white border border-brand-200 text-brand-700 hover:bg-brand-50 transition-colors"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(template._id)}
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium bg-white border border-danger-200 text-danger-600 hover:bg-danger-50 transition-colors"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
        </>
      )}

      {/* Create/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">
                {editingTemplate ? 'Editar plantilla' : 'Nueva plantilla'}
              </h2>
              <button
                onClick={closeForm}
                className="text-gray-400 hover:text-gray-600"
                disabled={submitting}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Form Error */}
            {formError && (
              <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700 mb-4">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre de plantilla <span className="text-danger-500">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                  placeholder="reapertura_gestion_v1"
                  disabled={submitting}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Nombre exacto de la plantilla en Meta Business
                </p>
              </div>

              {/* Language */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Idioma <span className="text-danger-500">*</span>
                </label>
                <select
                  value={formLanguage}
                  onChange={(e) => setFormLanguage(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                  disabled={submitting}
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.value} value={lang.value}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categoría <span className="text-danger-500">*</span>
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as any)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                  disabled={submitting}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contenido de la plantilla
                </label>
                <textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                  placeholder="Ej: Hola &#123;&#123;1&#125;&#125;, te escribimos desde Mi Empresa para retomar la conversación sobre &#123;&#123;2&#125;&#125;. Responde cuando gustes."
                  rows={4}
                  disabled={submitting}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Copiá el texto exacto de la plantilla de Meta (incluyendo variables como &#123;&#123;1&#125;&#125;, &#123;&#123;2&#125;&#125;, etc.)
                </p>
              </div>

              {/* Variables */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Variables
                  </label>
                  <button
                    type="button"
                    onClick={addVariable}
                    className="text-sm text-brand-600 hover:text-brand-700 font-medium"
                  >
                    + Agregar variable
                  </button>
                </div>
                {formVariables.length === 0 ? (
                  <p className="text-sm text-gray-500 py-2">
                    Sin variables configuradas
                  </p>
                ) : (
                  <div className="space-y-2">
                    {formVariables.map((variable) => (
                      <div key={variable.index} className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <span className="text-sm text-gray-500 w-8">
                          {`{{${variable.index}}}`}
                        </span>
                        <input
                          type="text"
                          value={variable.field}
                          onChange={(e) => updateVariable(variable.index, 'field', e.target.value)}
                          className="flex-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                          placeholder="field (e.g., fullName)"
                          disabled={submitting}
                        />
                        <input
                          type="text"
                          value={variable.defaultValue || ''}
                          onChange={(e) => updateVariable(variable.index, 'defaultValue', e.target.value)}
                          className="w-full sm:w-32 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                          placeholder="default"
                          disabled={submitting}
                        />
                        <button
                          type="button"
                          onClick={() => removeVariable(variable.index)}
                          className="self-end sm:self-auto text-danger-600 hover:text-danger-700"
                          disabled={submitting}
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Campo: nombre del campo en el cliente (fullName, notes, etc.)
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
                >
                  {submitting
                    ? 'Guardando...'
                    : editingTemplate
                    ? 'Actualizar'
                    : 'Crear'}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={submitting}
                  className="w-full sm:w-auto rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
