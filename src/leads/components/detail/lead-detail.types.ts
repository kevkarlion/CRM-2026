import type { QuoteStatus } from '@/quotes/types/quote';

/** Active Gestion info for lead detail */
export interface ActiveGestionInfo {
  _id: string;
  status: string;
  name: string;
  createdAt: string;
}

/** Lead as returned by GET /api/crm/leads/:id (populated assignedTo). */
export interface LeadDetail {
  _id: string;
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  source: string;
  status: string;
  estimatedValue?: number;
  notes?: string;
  profileName?: string;
  address?: string;
  locality?: string;
  province?: string;
  adminNotes?: string;
  assignedTo?: AssignedUser | string | null;
  convertedToClient?: string;
  convertedToWorkOrder?: string;
  convertedAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  activeGestion?: ActiveGestionInfo | null;
}

/** Quote item from GET /api/crm/leads/:id/quotes. */
export interface QuoteListItem {
  _id: string;
  number: string;
  title: string;
  total: number;
  status: QuoteStatus | string;
  validUntil?: string | null;
  createdAt?: string;
}

/** Technical visit from GET /api/crm/leads/:id/visits. */
export interface VisitListItem {
  _id: string;
  visitNumber: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  category?: string;
  scheduledDate?: string | null;
  scheduledStart?: string | null;
  clientSnapshot?: { name?: string; email?: string; phone?: string };
  locationSnapshot?: { address?: string; city?: string; province?: string };
}

/** Work order summary (available via sale-detail for converted leads). */
export interface WorkOrderListItem {
  _id: string;
  workOrderNumber: string;
  title?: string;
  status: string;
  scheduledDate?: string | null;
  priority?: string;
}

/** Sale detail from GET /api/crm/leads/:id/sale-detail. */
export interface SaleDetail {
  hasSale: boolean;
  workOrder?: WorkOrderListItem;
  quote?: {
    _id: string;
    number: string;
    title: string;
    status: string;
    total: number;
    description?: string;
  };
}

/** Bot conversation from GET /api/crm/conversations/by-lead/:id. */
export interface ConversationDetail {
  _id: string;
  lifecycleState: string;
  owner: string;
  resolvedAt: string | null;
  waitingMessageCount: number;
  waitingPriority?: string;
}
