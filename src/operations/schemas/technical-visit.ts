import { Schema } from 'mongoose';

export interface ITechnicalVisit {
  _id: import('mongoose').Types.ObjectId;
  tenantId: import('mongoose').Types.ObjectId;
  
  // References
  leadId?: import('mongoose').Types.ObjectId;
  clientId?: import('mongoose').Types.ObjectId;
  
  // Client data (snapshot)
  clientSnapshot: {
    name: string;
    email?: string;
    phone?: string;
  };
  
  // Location data (snapshot)
  locationSnapshot?: {
    name?: string;
    address?: string;
    city?: string;
    province?: string;
  };
  
  // Visit details
  visitNumber: string;
  title: string;
  description?: string;
  
  // Scheduling
  scheduledDate?: Date;
  scheduledStart?: Date;
  scheduledEnd?: Date;
  
  // Status
  status: 'draft' | 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'converted_to_work_order';
  
  // Priority
  priority: 'low' | 'normal' | 'high' | 'urgent';
  
  // Category (type of visit)
  category: 'inspection' | 'budget' | 'assessment' | 'emergency' | 'other';
  
  // Result after visit
  result?: {
    findings?: string;
    recommendation?: string;
    estimatedBudget?: number;
    nextSteps?: string;
  };
  
  // Conversion to Work Order
  convertedToWorkOrderId?: import('mongoose').Types.ObjectId;
  convertedAt?: Date;
  
  // Assigned technician
  assignedTechnicianId?: import('mongoose').Types.ObjectId;
  
  // Audit
  createdBy: import('mongoose').Types.ObjectId;
  updatedBy: import('mongoose').Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateTechnicalVisitInput = Omit<
  ITechnicalVisit,
  '_id' | 'tenantId' | 'visitNumber' | 'status' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'
>;