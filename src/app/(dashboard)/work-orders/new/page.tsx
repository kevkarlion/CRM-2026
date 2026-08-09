'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, unwrapData } from '@/lib/api-client';
import { AddressAutocomplete } from '@/components/location/AddressAutocomplete';
import type { ParsedPlaceDetails } from '@/lib/google-places';

interface Client {
  _id: string;
  name?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  profileName?: string;
  customerType?: string;
  locations?: Array<{ 
    _id?: string;
    name?: string; 
    address: string; 
    city?: string; 
    province?: string; 
    latitude?: number; 
    longitude?: number 
  }>;
}

function getBrowserTimezone(): string {
  const offset = new Date().getTimezoneOffset();
  const sign = offset <= 0 ? '+' : '-';
  const hours = String(Math.abs(Math.floor(offset / 60))).padStart(2, '0');
  const mins = String(Math.abs(offset % 60)).padStart(2, '0');
  return `${sign}${hours}:${mins}`;
}

function toISOStringWithLocalTime(dateStr: string, timeStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = timeStr.split(':').map(Number);
  const dt = new Date(y, mo - 1, d, h, mi);
  return dt.toISOString();
}

const PRIORITY_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
];

const CATEGORY_OPTIONS = [
  { value: 'installation', label: 'Instalación' },
  { value: 'maintenance', label: 'Mantenimiento' },
  { value: 'repair', label: 'Reparación' },
  { value: 'inspection', label: 'Inspección' },
  { value: 'warranty', label: 'Garantía' },
  { value: 'emergency', label: 'Emergencia' },
];

const TYPE_OPTIONS = [
  { value: 'work_order', label: 'Orden de Trabajo' },
  { value: 'technical_visit', label: 'Visita Técnica' },
];

export default function NewWorkOrderPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  
  // Technicians
  const [technicians, setTechnicians] = useState<{_id: string; name: string; email: string}[]>([]);
  const [selectedTechnicians, setSelectedTechnicians] = useState<string[]>([]);
  
  const [form, setForm] = useState({
    type: 'work_order',
    title: '',
    clientId: '',
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    locationId: '',
    locationName: '',
    locationAddress: '',
    locationCity: '',
    locationProvince: '',
    locationCountry: 'Argentina',
    locationPostalCode: '',
    locationLat: '',
    locationLng: '',
    locationPlaceId: '',
    locationReference: '',
    equipmentType: '',
    equipmentBrand: '',
    equipmentModel: '',
    equipmentSerial: '',
    priority: 'normal',
    category: 'maintenance',
    description: '',
    scheduledDate: '',
    startTime: '',
    endTime: '',
    estimatedDuration: '',
  });

  // Load clients on mount
useEffect(() => {
    async function loadClients() {
      try {
        setClientsLoading(true);
        const response = await fetch('/api/crm/clients?limit=50');
        if (!response.ok) {
          throw new Error(`Failed to fetch clients: ${response.status}`);
        }
        const result = await response.json();
        const clientsData = result?.data || result;
        setClients(Array.isArray(clientsData) ? clientsData : []);
      } catch (err) {
        console.error('Error loading clients:', err);
        setClients([]);
      } finally {
        setClientsLoading(false);
      }
    }
    loadClients();
  }, []);

  // Load technicians on mount
  useEffect(() => {
    async function loadTechnicians() {
      try {
        const response = await fetch('/api/operations/technicians?status=active');
        if (response.ok) {
          const result = await response.json();
          setTechnicians(result?.data || result || []);
        }
      } catch (err) {
        console.error('Error loading technicians:', err);
      }
    }
    loadTechnicians();
  }, []);

  // Filter clients based on search
  const filteredClients = (clients || []).filter(c => 
    !clientSearch || 
    (c.fullName || '').toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.profileName || '').toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.name || '').toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.companyName || '').toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.phone || '').toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(clientSearch.toLowerCase())
  );

  // Get display name for a client (priority: fullName > profileName > name > companyName)
  const getClientDisplayName = (client: Client) => {
    return client.fullName || client.profileName || client.name || client.companyName || 'Sin nombre';
  };

  // Get secondary info (what to show below the name)
  const getClientSecondaryInfo = (client: Client) => {
    const parts: string[] = [];
    // Only show companyName if it's different from the display name
    const displayName = getClientDisplayName(client);
    if (client.companyName && client.companyName !== displayName) {
      parts.push(client.companyName);
    }
    if (client.email) parts.push(client.email);
    if (client.phone) parts.push(client.phone);
    return parts;
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!target.closest('.client-dropdown-container')) {
        setShowClientDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle client selection
  const handleSelectClient = async (client: Client) => {
    setSelectedClient(client);
    const displayName = getClientDisplayName(client);
    
    // Update client fields
    setForm((prev) => ({
      ...prev,
      clientId: client._id,
      clientName: displayName,
      clientEmail: client.email || '',
      clientPhone: client.phone || '',
    }));
    
    // Try to get location from client's locations first
    if (client.locations && client.locations.length > 0) {
      const loc = client.locations[0];
      setForm((prev) => ({
        ...prev,
        locationId: loc._id?.toString() || loc._id || '',
        locationName: loc.name || '',
        locationAddress: loc.address || '',
        locationCity: loc.city || '',
        locationProvince: loc.province || '',
        locationLat: loc.latitude?.toString() || '',
        locationLng: loc.longitude?.toString() || '',
      }));
      setClientSearch(displayName);
      setShowClientDropdown(false);
      return;
    }
    
    // If no locations, try to get from last work order of this client
    try {
      const response = await fetch(`/api/operations/work-orders?clientId=${client._id}`);
      if (response.ok) {
        const result = await response.json();
        const workOrders = result?.data || result;
        if (workOrders && workOrders.length > 0) {
          const lastWO = workOrders[0];
          const locSnapshot = lastWO.locationSnapshot;
          if (locSnapshot && locSnapshot.address) {
            setForm((prev) => ({
              ...prev,
              locationName: locSnapshot.name || '',
              locationAddress: locSnapshot.address || '',
              locationCity: locSnapshot.city || '',
              locationProvince: locSnapshot.province || '',
              locationPostalCode: locSnapshot.postalCode || '',
              locationLat: locSnapshot.latitude?.toString() || '',
              locationLng: locSnapshot.longitude?.toString() || '',
              locationPlaceId: locSnapshot.placeId || '',
            }));
            setClientSearch(displayName);
            setShowClientDropdown(false);
            return;
          }
        }
      }
    } catch (err) {
      console.error('Error loading last work order:', err);
    }
    
    // Clear location fields if nothing found
    setForm((prev) => ({
      ...prev,
      locationId: '',
      locationName: '',
      locationAddress: '',
      locationCity: '',
      locationProvince: '',
      locationPostalCode: '',
      locationLat: '',
      locationLng: '',
      locationPlaceId: '',
    }));
    
    setClientSearch(displayName);
    setShowClientDropdown(false);
  };

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    update((e.target as any).name, (e.target as any).value);
  }

  function handleAddressChange(address: string, details?: ParsedPlaceDetails) {
    setForm((prev) => ({
      ...prev,
      locationAddress: address,
      locationCity: details?.city || '',
      locationProvince: details?.province || '',
      locationCountry: details?.country || '',
      locationPostalCode: details?.postalCode || '',
      locationLat: details?.latitude?.toString() || '',
      locationLng: details?.longitude?.toString() || '',
      locationPlaceId: details?.placeId || '',
    }));
  }

  function handleCoordinatesChange(value: string) {
    const trimmed = value.trim();
    const match = trimmed.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);
    if (match) {
      setForm((prev) => ({
        ...prev,
        locationLat: match[1],
        locationLng: match[2],
      }));
    } else if (trimmed === '') {
      setForm((prev) => ({
        ...prev,
        locationLat: '',
        locationLng: '',
      }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.title.trim()) { setError('El título es obligatorio'); return; }
    if (!form.clientName.trim()) { setError('El nombre del cliente es obligatorio'); return; }

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        title: form.title.trim(),
        source: form.type === 'technical_visit' ? 'technical_visit' : 'manual',
        priority: form.priority,
        category: form.category,
        clientId: form.clientId,
        clientSnapshot: {
          name: form.clientName.trim(),
          email: form.clientEmail.trim() || undefined,
          phone: form.clientPhone.trim() || undefined,
        },
        locationId: form.locationId || undefined,
        locationSnapshot: {
          name: form.locationName.trim() || undefined,
          address: form.locationAddress.trim() || undefined,
          city: form.locationCity.trim() || undefined,
          province: form.locationProvince.trim() || undefined,
          postalCode: form.locationPostalCode.trim() || undefined,
          latitude: form.locationLat ? parseFloat(form.locationLat) : undefined,
          longitude: form.locationLng ? parseFloat(form.locationLng) : undefined,
          placeId: form.locationPlaceId || undefined,
          details: form.locationReference ? { observations: form.locationReference.trim() } : undefined,
        },
      };

      const hasEquipment = form.equipmentType || form.equipmentBrand || form.equipmentModel || form.equipmentSerial;
      if (hasEquipment) {
        body.equipmentSnapshot = {
          equipmentType: form.equipmentType.trim() || undefined,
          brand: form.equipmentBrand.trim() || undefined,
          model: form.equipmentModel.trim() || undefined,
          serialNumber: form.equipmentSerial.trim() || undefined,
        };
      }

      if (form.description.trim()) body.description = form.description.trim();
      if (form.scheduledDate) body.scheduledDate = form.scheduledDate;
      if (form.scheduledDate && form.startTime) body.scheduledStart = toISOStringWithLocalTime(form.scheduledDate, form.startTime);
      if (form.scheduledDate && form.endTime) body.scheduledEnd = toISOStringWithLocalTime(form.scheduledDate, form.endTime);
      if (form.estimatedDuration) body.estimatedDuration = parseInt(form.estimatedDuration, 10);
      if (selectedTechnicians.length > 0) body.assignedTechnicians = selectedTechnicians;

      const result = await api.post<{ data: { _id: string } }>('/api/operations/work-orders', body);
      const created = unwrapData<{ _id: string }>(result);
      router.push(`/work-orders/${created._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear orden de trabajo');
    } finally {
      setLoading(false);
    }
  }

  const inputClass = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Nueva Orden de Trabajo</h1>
        <p className="text-sm text-gray-500 mt-1">Ingresa los datos de la orden</p>
      </div>

      {error && (
        <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
        <div className="space-y-5">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Información General</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo <span className="text-danger-500">*</span>
              </label>
              <div className="flex gap-3">
                {TYPE_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="type"
                      value={opt.value}
                      checked={form.type === opt.value}
                      onChange={handleChange}
                      className="w-4 h-4 text-brand-600 border-gray-300 focus:ring-brand-500"
                    />
                    <span className="text-sm text-gray-700">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Título <span className="text-danger-500">*</span>
              </label>
              <input type="text" name="title" value={form.title} onChange={handleChange}
                className={inputClass} placeholder="Ej: Instalación de equipo split" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
              <select name="priority" value={form.priority} onChange={handleChange} className={inputClass}>
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
              <select name="category" value={form.category} onChange={handleChange} className={inputClass}>
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea name="description" value={form.description} onChange={handleChange}
                className={`${inputClass} min-h-[100px] resize-y`} placeholder="Detalles del trabajo a realizar..." />
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Cliente</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Seleccionar cliente existente
              </label>
              <div className="relative client-dropdown-container">
                <input 
                  type="text" 
                  value={clientSearch} 
                  onChange={(e) => {
                    setClientSearch(e.target.value);
                    setShowClientDropdown(true);
                    setSelectedClient(null);
                  }}
                  onFocus={() => setShowClientDropdown(true)}
                  className={inputClass} 
                  placeholder="Buscar cliente por nombre o empresa..." 
                />
                {showClientDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-white border-2 border-brand-200 rounded-lg shadow-xl max-h-80 overflow-auto">
                    {clientsLoading ? (
                      <div className="px-3 py-4 text-sm text-gray-500 text-center">Cargando clientes...</div>
                    ) : clients.length === 0 ? (
                      <div className="px-3 py-4 text-sm text-gray-500 text-center">
                        No hay clientes disponibles
                      </div>
                    ) : filteredClients.length === 0 ? (
                      <div className="px-3 py-4 text-sm text-gray-500 text-center">
                        {clientSearch ? `No se encontraron clientes para "${clientSearch}"` : 'Escribe para buscar clientes'}
                      </div>
                    ) : (
                      filteredClients.slice(0, 10).map((client) => (
                        <div
                          key={client._id}
                          onClick={() => handleSelectClient(client)}
                          className="px-3 py-2 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-0"
                        >
                          <div className="text-sm font-medium text-gray-900">
                            {getClientDisplayName(client)}
                          </div>
                          {getClientSecondaryInfo(client).length > 0 && (
                            <div className="text-xs text-gray-400">
                              {getClientSecondaryInfo(client).join(' • ')}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
              {selectedClient && (
                <button 
                  type="button"
                  onClick={() => {
                    setSelectedClient(null);
                    setClientSearch('');
                    setForm((prev) => ({
                      ...prev,
                      clientId: '',
                      clientName: '',
                      clientEmail: '',
                      clientPhone: '',
                      locationId: '',
                      locationName: '',
                      locationAddress: '',
                      locationCity: '',
                      locationProvince: '',
                      locationPostalCode: '',
                      locationLat: '',
                      locationLng: '',
                      locationPlaceId: '',
                      locationReference: '',
                    }));
                  }}
                  className="text-xs text-brand-600 hover:text-brand-700 mt-1"
                >
                  ✕ Limpiar selección
                </button>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre <span className="text-danger-500">*</span>
              </label>
              <input type="text" name="clientName" value={form.clientName} onChange={handleChange}
                className={inputClass} placeholder="Cliente" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" name="clientEmail" value={form.clientEmail} onChange={handleChange}
                className={inputClass} placeholder="cliente@ejemplo.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input type="tel" name="clientPhone" value={form.clientPhone} onChange={handleChange}
                className={inputClass} placeholder="+54 9 11 1234 5678" />
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Ubicación</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre/Lugar</label>
              <input type="text" name="locationName" value={form.locationName} onChange={handleChange}
                className={inputClass} placeholder="Ej: Domicilio cliente, Oficina..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
              <AddressAutocomplete 
                value={form.locationAddress} 
                onChange={handleAddressChange}
                placeholder="Av. Principal 123"
              />
              {/* Link a Google Maps */}
              {form.locationAddress && (
                <Link 
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([form.locationAddress, form.locationCity, form.locationProvince].filter(Boolean).join(', '))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-800 underline"
                >
                  📍 Ver en Google Maps
                </Link>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Localidad/Ciudad</label>
              <input type="text" name="locationCity" value={form.locationCity} onChange={handleChange}
                className={inputClass} placeholder="Buenos Aires" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Provincia</label>
              <input type="text" name="locationProvince" value={form.locationProvince} onChange={handleChange}
                className={inputClass} placeholder="CABA" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Código Postal</label>
              <input type="text" name="locationPostalCode" value={form.locationPostalCode} onChange={handleChange}
                className={inputClass} placeholder="C1428" />
            </div>
            
            {/* Link para obtener coordenadas */}
            {form.locationAddress && form.locationCity && (
              <div className="sm:col-span-2">
                <Link 
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([form.locationAddress, form.locationCity, form.locationProvince].filter(Boolean).join(', '))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-800 underline"
                >
                  📍 Abrir en Google Maps para obtener coordenadas
                </Link>
              </div>
            )}

            {/* Referencias de ubicación */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Referencias / Observaciones</label>
              <textarea name="locationReference" value={form.locationReference} onChange={handleChange}
                className={inputClass} rows={2}
                placeholder="Ej: Portón gris, timbre 4, casa del fondo..." />
            </div>

            {/* Coordenadas */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Coordenadas <span className="text-gray-400">(lat, lng)</span>
              </label>
              <input 
                type="text" 
                value={form.locationLat && form.locationLng ? `${form.locationLat}, ${form.locationLng}` : ''}
                onChange={(e) => handleCoordinatesChange(e.target.value)}
                className={inputClass}
                placeholder="Ej: -33.4489, -70.6693"
              />
              {(form.locationLat || form.locationLng) && (
                <div className="mt-2 text-xs text-gray-500">
                  📍 Coordenadas cargadas: {form.locationLat}, {form.locationLng}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Técnico Asignado */}
        <div className="space-y-5">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Técnico Asignado</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Seleccionar técnico</label>
              <select
                value={selectedTechnicians[0] || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value) {
                    setSelectedTechnicians([value]);
                  } else {
                    setSelectedTechnicians([]);
                  }
                }}
                className={inputClass}
              >
                <option value="">Seleccionar técnico...</option>
                {technicians.map((tech) => (
                  <option key={tech._id} value={tech._id}>
                    {tech.name}
                  </option>
                ))}
              </select>
              {selectedTechnicians.length > 0 && (
                <div className="mt-2 text-xs text-brand-600">
                  Técnico seleccionado: {technicians.find(t => t._id === selectedTechnicians[0])?.name}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Equipo</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <input type="text" name="equipmentType" value={form.equipmentType} onChange={handleChange}
                className={inputClass} placeholder="Ej: Split, Central..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
              <input type="text" name="equipmentBrand" value={form.equipmentBrand} onChange={handleChange}
                className={inputClass} placeholder="Ej: Daikin, Carrier..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
              <input type="text" name="equipmentModel" value={form.equipmentModel} onChange={handleChange}
                className={inputClass} placeholder="Modelo" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">N° Serie</label>
              <input type="text" name="equipmentSerial" value={form.equipmentSerial} onChange={handleChange}
                className={inputClass} placeholder="Serial" />
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Programación</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha programada</label>
              <input type="date" name="scheduledDate" value={form.scheduledDate} onChange={handleChange}
                className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duración estimada (min)</label>
              <input type="number" name="estimatedDuration" value={form.estimatedDuration} onChange={handleChange}
                className={inputClass} placeholder="120" min="1" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora inicio</label>
              <input type="time" name="startTime" value={form.startTime} onChange={handleChange}
                className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora término</label>
              <input type="time" name="endTime" value={form.endTime} onChange={handleChange}
                className={inputClass} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={loading}
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors">
            {loading ? 'Creando...' : 'Crear OT'}
          </button>
          <button type="button" onClick={() => router.push('/work-orders')}
            className="rounded-lg border border-gray-200 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
