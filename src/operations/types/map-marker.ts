/**
 * MapMarker ViewModel for the Mapa Operativo module
 * Represents a single marker on the operational map
 */
export interface MapMarker {
  id: string;
  entityType: 'WorkOrder' | 'TechnicalVisit';
  latitude: number;
  longitude: number;
  title: string;
  subtitle: string;
  status: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  technician?: string;
  technicianId?: string;
  scheduledAt: string;
  serviceType: string;
  clientName: string;
  locationName: string;
}

/**
 * Input filters for the operational map query
 */
export interface MapFilters {
  dateFrom?: string;
  dateTo?: string;
  technicianId?: string;
  status?: string[];
  serviceType?: string;
  entityType: 'WorkOrder' | 'TechnicalVisit' | 'ALL';
}

/**
 * API response for the map endpoint
 */
export interface MapApiResponse {
  markers: MapMarker[];
}