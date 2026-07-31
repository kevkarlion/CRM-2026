'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapFilters as MapFiltersType } from '@/operations/types/map-marker';

interface Technician {
  _id: string;
  name: string;
}

interface MapFiltersProps {
  filters: MapFiltersType;
  onFiltersChange: (filters: MapFiltersType) => void;
  technicians?: Technician[];
}

// Status options
const STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Programado' },
  { value: 'confirmed', label: 'Confirmado' },
  { value: 'assigned', label: 'Asignado' },
  { value: 'en_route', label: 'En Ruta' },
  { value: 'on_site', label: 'En Sitio' },
  { value: 'paused', label: 'Pausado' },
  { value: 'completed', label: 'Completado' },
  { value: 'cancelled', label: 'Cancelado' },
  { value: 'closed', label: 'Cerrado' },
];

// Entity type options
const ENTITY_TYPE_OPTIONS = [
  { value: 'ALL', label: 'Todos' },
  { value: 'WorkOrder', label: 'Órdenes de Trabajo' },
  { value: 'TechnicalVisit', label: 'Visitas Técnicas' },
];

// Service type options (common service types)
const SERVICE_TYPE_OPTIONS = [
  { value: '', label: 'Todos los servicios' },
  { value: 'installation', label: 'Instalación' },
  { value: 'maintenance', label: 'Mantenimiento' },
  { value: 'repair', label: 'Reparación' },
  { value: 'inspection', label: 'Inspección' },
  { value: 'warranty', label: 'Garantía' },
  { value: 'delivery', label: 'Entrega' },
  { value: 'consultation', label: 'Consulta' },
];

export function MapFilters({ filters, onFiltersChange, technicians = [] }: MapFiltersProps) {
  const [localFilters, setLocalFilters] = useState<MapFiltersType>(filters);
  const [technicianList, setTechnicianList] = useState<Technician[]>(technicians);

  // Debounced filter change
  useEffect(() => {
    const timer = setTimeout(() => {
      onFiltersChange(localFilters);
    }, 300);

    return () => clearTimeout(timer);
  }, [localFilters, onFiltersChange]);

  // Update local state when props change
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleEntityTypeChange = (value: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      entityType: value as MapFiltersType['entityType'],
    }));
  };

  const handleStatusChange = (status: string, checked: boolean) => {
    setLocalFilters((prev) => {
      const currentStatuses = prev.status || [];
      if (checked) {
        return { ...prev, status: [...currentStatuses, status] };
      } else {
        return { ...prev, status: currentStatuses.filter((s) => s !== status) };
      }
    });
  };

  const handleDateChange = (field: 'dateFrom' | 'dateTo', value: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      [field]: value || undefined,
    }));
  };

  const handleTechnicianChange = (value: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      technicianId: value || undefined,
    }));
  };

  const handleServiceTypeChange = (value: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      serviceType: value || undefined,
    }));
  };

  const clearFilters = () => {
    const defaultFilters: MapFiltersType = {
      entityType: 'ALL',
      status: [],
    };
    setLocalFilters(defaultFilters);
  };

  const hasActiveFilters = 
    localFilters.entityType !== 'ALL' ||
    (localFilters.status && localFilters.status.length > 0) ||
    localFilters.dateFrom ||
    localFilters.dateTo ||
    localFilters.technicianId ||
    localFilters.serviceType;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900">Filtros</h3>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Filters Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Entity Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tipo de Entidad
          </label>
          <select
            value={localFilters.entityType}
            onChange={(e) => handleEntityTypeChange(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none bg-white"
          >
            {ENTITY_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Technician */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Técnico
          </label>
          <select
            value={localFilters.technicianId || ''}
            onChange={(e) => handleTechnicianChange(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none bg-white"
          >
            <option value="">Todos los técnicos</option>
            {technicianList.map((tech) => (
              <option key={tech._id} value={tech._id}>
                {tech.name}
              </option>
            ))}
          </select>
        </div>

        {/* Service Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tipo de Servicio
          </label>
          <select
            value={localFilters.serviceType || ''}
            onChange={(e) => handleServiceTypeChange(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none bg-white"
          >
            {SERVICE_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Date Range */}
        <div className="md:col-span-2 lg:col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Rango de Fechas
          </label>
          <div className="flex gap-2">
            <input
              type="date"
              value={localFilters.dateFrom || ''}
              onChange={(e) => handleDateChange('dateFrom', e.target.value)}
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
              placeholder="Desde"
            />
            <input
              type="date"
              value={localFilters.dateTo || ''}
              onChange={(e) => handleDateChange('dateTo', e.target.value)}
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
              placeholder="Hasta"
            />
          </div>
        </div>

        {/* Status Checkboxes */}
        <div className="md:col-span-2 lg:col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Estado
          </label>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((opt) => {
              const isChecked = (localFilters.status || []).includes(opt.value);
              return (
                <label
                  key={opt.value}
                  className={`inline-flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                    isChecked
                      ? 'bg-brand-50 text-brand-700 border border-brand-200'
                      : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => handleStatusChange(opt.value, e.target.checked)}
                    className="sr-only"
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}