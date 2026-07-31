'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { LeafletMap, MapFilters } from '@/components/map';
import type { MapMarker, MapFilters as MapFiltersType, MapApiResponse } from '@/operations/types/map-marker';

interface Technician {
  _id: string;
  name: string;
}

// Dynamically import LeafletMap to avoid SSR issues
const Map = dynamic(() => import('@/components/map/LeafletMap').then((mod) => mod.LeafletMap), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-100 animate-pulse rounded-lg flex items-center justify-center">
      <span className="text-gray-400">Cargando mapa...</span>
    </div>
  ),
});

// Default filters
const DEFAULT_FILTERS: MapFiltersType = {
  entityType: 'ALL',
};

export default function MapaOperativoPage() {
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [filters, setFilters] = useState<MapFiltersType>(DEFAULT_FILTERS);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const mountedRef = useRef(false);

  // Get user location
  const getUserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Tu navegador no soporta geolocalización');
      return;
    }

    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationLoading(false);
      },
      (err) => {
        setError('No se pudo obtener tu ubicación. Verifica los permisos.');
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const fetchMarkers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query params
      const params = new URLSearchParams();
      if (filters.entityType && filters.entityType !== 'ALL') {
        params.set('entityType', filters.entityType);
      }
      if (filters.status && filters.status.length > 0) {
        params.set('status', filters.status.join(','));
      }
      if (filters.dateFrom) {
        params.set('dateFrom', filters.dateFrom);
      }
      if (filters.dateTo) {
        params.set('dateTo', filters.dateTo);
      }
      if (filters.technicianId) {
        params.set('technicianId', filters.technicianId);
      }
      if (filters.serviceType) {
        params.set('serviceType', filters.serviceType);
      }

      const response = await fetch(`/api/operations/map?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Error al cargar los datos del mapa');
      }

      const data: MapApiResponse = await response.json();
      setMarkers(data.markers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchTechnicians = useCallback(async () => {
    try {
      const response = await fetch('/api/operations/technicians');
      if (!response.ok) return;
      
      const data = await response.json();
      setTechnicians(data.data || []);
    } catch (err) {
      console.error('Error loading technicians:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      fetchMarkers();
      fetchTechnicians();
    }
  }, [fetchMarkers, fetchTechnicians]);

  // Handle filter changes
  const handleFiltersChange = useCallback((newFilters: MapFiltersType) => {
    setFilters(newFilters);
  }, []);

  // Fetch when filters change (debounced in MapFilters component)
  useEffect(() => {
    if (mountedRef.current) {
      fetchMarkers();
    }
  }, [filters, fetchMarkers]);

  const handleMarkerClick = useCallback((marker: MapMarker) => {
    console.log('Marker clicked:', marker);
  }, []);

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mapa Operativo</h1>
        <p className="text-gray-500 mt-1">
          Vista geográfica de órdenes de trabajo y visitas técnicas
        </p>
      </div>

      {/* Filters */}
      <MapFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        technicians={technicians}
      />

      {/* My Location Button */}
      <button
        onClick={getUserLocation}
        disabled={locationLoading}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors text-sm font-medium"
      >
        {locationLoading ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        )}
        {locationLoading ? 'Obteniendo...' : 'Mi ubicación'}
      </button>

      {/* Error Message */}
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        </div>
      )}

      {/* Map Container */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden" style={{ height: 'calc(100vh - 320px)', minHeight: '400px' }}>
        {loading ? (
          <div className="w-full h-full flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-500">Cargando mapa...</p>
            </div>
          </div>
        ) : markers.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <p className="text-sm font-medium text-gray-900">No hay datos para mostrar</p>
              <p className="text-sm text-gray-500 mt-1">
                Prueba ajustar los filtros o selecciona otro rango de fechas
              </p>
            </div>
          </div>
        ) : (
          <Map markers={markers} onMarkerClick={handleMarkerClick} userLocation={userLocation} />
        )}
      </div>

      {/* Legend */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Leyenda</h3>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-violet-600 border-2 border-red-600" />
            <span className="text-xs text-gray-600">Orden de Trabajo</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-cyan-600 border-2 border-red-600" />
            <span className="text-xs text-gray-600">Visita Técnica</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-600" />
            <span className="text-xs text-gray-600">Urgente</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-600" />
            <span className="text-xs text-gray-600">Alta</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-600" />
            <span className="text-xs text-gray-600">Normal</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-500" />
            <span className="text-xs text-gray-600">Baja</span>
          </div>
        </div>
      </div>
    </div>
  );
}