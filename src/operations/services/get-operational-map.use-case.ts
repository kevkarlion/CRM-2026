import { Types } from 'mongoose';
import WorkOrderModel from '../models/work-order';
import { TechnicalVisitModel } from '../models/technical-visit';
import { TechnicianModel } from '../models/technician';
import { MapMarker, MapFilters, MapApiResponse } from '../types/map-marker';

/**
 * GetOperationalMapUseCase fetches WorkOrders and TechnicalVisits
 * and transforms them into MapMarker ViewModels for display on the map
 */
export class GetOperationalMapUseCase {
  /**
   * Execute the use case to get map markers
   */
  async execute(tenantId: string, filters: MapFilters): Promise<MapApiResponse> {
    const tenantObjectId = new Types.ObjectId(tenantId);
    
    // Build queries based on filters
    const workOrderQuery = this.buildWorkOrderQuery(tenantObjectId, filters);
    const visitQuery = this.buildVisitQuery(tenantObjectId, filters);
    
    // Execute parallel queries
    const [workOrders, technicalVisits] = await Promise.all([
      this.fetchWorkOrders(workOrderQuery),
      this.fetchTechnicalVisits(visitQuery),
    ]);
    
    // Transform to MapMarker format
    const markers: MapMarker[] = [
      ...workOrders.map(wo => this.transformWorkOrder(wo)),
      ...technicalVisits.map(tv => this.transformTechnicalVisit(tv)),
    ];
    
    // Apply in-memory filters that couldn't be done at DB level
    const filteredMarkers = this.applyInMemoryFilters(markers, filters);
    
    return { markers: filteredMarkers };
  }
  
  /**
   * Build WorkOrder query based on filters
   */
  private buildWorkOrderQuery(tenantId: Types.ObjectId, filters: MapFilters): Record<string, unknown> {
    const query: Record<string, unknown> = {
      tenantId,
      deletedAt: null,
    };
    
    // Entity type filter
    if (filters.entityType && filters.entityType !== 'ALL' && filters.entityType !== 'WorkOrder') {
      // Skip WorkOrders if entityType is not 'WorkOrder' or 'ALL'
      return { ...query, _id: null };
    }
    
    // Status filter
    if (filters.status && filters.status.length > 0) {
      query.status = { $in: filters.status };
    }
    
    // Service type (category) filter
    if (filters.serviceType) {
      query.category = filters.serviceType;
    }
    
    // Date range filter (scheduledDate is stored as YYYY-MM-DD string)
    if (filters.dateFrom || filters.dateTo) {
      query.scheduledDate = {};
      if (filters.dateFrom) {
        (query.scheduledDate as Record<string, string>).$gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        (query.scheduledDate as Record<string, string>).$lte = filters.dateTo;
      }
    }
    
    // Technician filter
    if (filters.technicianId) {
      query.assignedTechnicians = new Types.ObjectId(filters.technicianId);
    }
    
    // Note: We don't require coordinates in query - we'll filter during transformation
    // This allows us to see what data exists and debug coordinate issues
    
    return query;
  }
  
  /**
   * Build TechnicalVisit query based on filters
   */
  private buildVisitQuery(tenantId: Types.ObjectId, filters: MapFilters): Record<string, unknown> {
    const query: Record<string, unknown> = {
      tenantId,
      deletedAt: null,
    };
    
    // Entity type filter
    if (filters.entityType && filters.entityType !== 'ALL' && filters.entityType !== 'TechnicalVisit') {
      // Skip TechnicalVisits if entityType is not 'TechnicalVisit' or 'ALL'
      return { ...query, _id: null };
    }
    
    // Status filter
    if (filters.status && filters.status.length > 0) {
      query.status = { $in: filters.status };
    }
    
    // Category (service type) filter
    if (filters.serviceType) {
      query.category = filters.serviceType;
    }
    
    // Date range filter
    if (filters.dateFrom || filters.dateTo) {
      query.scheduledDate = {};
      if (filters.dateFrom) {
        (query.scheduledDate as Record<string, Date>).$gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        (query.scheduledDate as Record<string, Date>).$lte = new Date(filters.dateTo);
      }
    }
    
    // Technician filter
    if (filters.technicianId) {
      query.assignedTechnicianId = new Types.ObjectId(filters.technicianId);
    }
    
    return query;
  }
  
  /**
   * Fetch WorkOrders from database
   */
  private async fetchWorkOrders(query: Record<string, unknown>) {
    if (!query || (query._id as unknown) === null) {
      return [];
    }
    
    return WorkOrderModel.find(query)
      .populate('assignedTechnicians', 'name')
      .lean();
  }
  
  /**
   * Fetch TechnicalVisits from database
   */
  private async fetchTechnicalVisits(query: Record<string, unknown>) {
    if (!query || (query._id as unknown) === null) {
      return [];
    }
    
    return TechnicalVisitModel.find(query)
      .populate('assignedTechnicianId', 'name')
      .lean();
  }
  
  /**
   * Transform WorkOrder to MapMarker
   */
  private transformWorkOrder(wo: any): MapMarker {
    const technicianNames = wo.assignedTechnicians?.map((t: any) => t.name).join(', ') || undefined;
    const technicianIds = wo.assignedTechnicians?.map((t: any) => String(t._id)) || [];
    
    // Check both locationSnapshot and root level for coordinates
    const lat = wo.locationSnapshot?.latitude ?? wo.latitude ?? 0;
    const lng = wo.locationSnapshot?.longitude ?? wo.longitude ?? 0;
    
    return {
      id: String(wo._id),
      entityType: 'WorkOrder',
      latitude: lat,
      longitude: lng,
      title: wo.title,
      subtitle: `WO #${wo.workOrderNumber}`,
      status: wo.status,
      priority: wo.priority,
      technician: technicianNames,
      technicianId: technicianIds[0] || undefined,
      // Use scheduledStart if available (has date+time), otherwise scheduledDate (date only)
      // This fixes the timezone issue where scheduledDate alone was interpreted as UTC midnight
      scheduledAt: wo.scheduledStart 
        ? (typeof wo.scheduledStart === 'string' ? wo.scheduledStart : wo.scheduledStart.toISOString())
        : wo.scheduledDate || '',
      serviceType: wo.category,
      clientName: wo.clientSnapshot?.name || '',
      locationName: wo.locationSnapshot?.name || wo.locationSnapshot?.address || '',
    };
  }
  
  /**
   * Transform TechnicalVisit to MapMarker
   */
  private transformTechnicalVisit(tv: any): MapMarker {
    const technician = tv.assignedTechnicianId;
    const technicianName = technician && typeof technician === 'object' 
      ? (technician as any).name 
      : undefined;
    const technicianId = technician && typeof technician === 'object'
      ? String((technician as any)._id)
      : undefined;
    
    // Check locationSnapshot and root level for coordinates
    const lat = tv.locationSnapshot?.latitude ?? tv.latitude ?? 0;
    const lng = tv.locationSnapshot?.longitude ?? tv.longitude ?? 0;
    
    return {
      id: String(tv._id),
      entityType: 'TechnicalVisit',
      latitude: lat,
      longitude: lng,
      title: tv.title,
      subtitle: `VT #${tv.visitNumber}`,
      status: tv.status,
      priority: tv.priority,
      technician: technicianName,
      technicianId: technicianId,
      // Use scheduledStart if available (has date+time), otherwise scheduledDate (date only)
      scheduledAt: tv.scheduledStart 
        ? (typeof tv.scheduledStart === 'string' ? tv.scheduledStart : tv.scheduledStart.toISOString())
        : (tv.scheduledDate ? (typeof tv.scheduledDate === 'string' ? tv.scheduledDate : tv.scheduledDate.toISOString()) : ''),
      serviceType: tv.category,
      clientName: tv.clientSnapshot?.name || '',
      locationName: tv.locationSnapshot?.name || tv.locationSnapshot?.address || '',
    };
  }
  
  /**
   * Apply in-memory filters that couldn't be done at DB level
   */
  private applyInMemoryFilters(markers: MapMarker[], filters: MapFilters): MapMarker[] {
    let result = markers;
    
    // Filter out markers without valid coordinates
    result = result.filter(marker => 
      marker.latitude != null && 
      marker.longitude != null && 
      !isNaN(marker.latitude) && 
      !isNaN(marker.longitude) &&
      marker.latitude !== 0 && 
      marker.longitude !== 0
    );
    
    return result;
  }
}

export const getOperationalMapUseCase = new GetOperationalMapUseCase();