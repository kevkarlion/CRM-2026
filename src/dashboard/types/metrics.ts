// ── Metric response types for dashboard API ───────────────

export interface ClientMetrics {
  total: number;
  newThisMonth: number;
  activeWithContracts: number;
}

export interface WorkOrderMetrics {
  pending: number;
  inProgress: number;
  completedThisMonth: number;
  avgCompletionTimeHours: number | null;
}

export interface LeadMetrics {
  new: number;
  qualified: number;
  conversionRate: number;
}

export interface QuoteMetrics {
  sent: number;
  approved: number;
  rejected: number;
  totalEstimatedValue: number;
}

export interface EmployeeMetrics {
  total: number;
  active: number;
}

export interface ContractMetrics {
  active: number;
  expiringSoon: number;
  upcomingMaintenance: number;
}

export interface SummaryResponse {
  clients: ClientMetrics;
  workOrders: WorkOrderMetrics;
  leads: LeadMetrics;
  quotes: QuoteMetrics;
  contracts: ContractMetrics;
  employees: EmployeeMetrics;
  generatedAt: string;
}

// ── Operations ─────────────────────────────────────────────

export interface SLAMetrics {
  onTime: number;
  delayed: number;
  avgResponseTimeHours: number | null;
}

export interface TechnicianLoad {
  techId: string;
  name: string;
  assignedCount: number;
  maxDailyLoad?: number; // Límite diario desde la DB
}

export interface OperationsResponse {
  pendingOrders: number;
  inProgressOrders: number;
  completedToday: number;
  upcomingSevenDays: number;
  sla: SLAMetrics;
  technicianLoad: TechnicianLoad[];
  generatedAt: string;
}

// ── Commercial ─────────────────────────────────────────────

export interface LeadByStage {
  stage: string;
  count: number;
}

export interface QuoteByStatus {
  status: string;
  count: number;
}

export interface TopClient {
  clientId: string;
  name: string;
  totalQuoted: number;
}

export interface CommercialResponse {
  leadsByStage: LeadByStage[];
  newLeadsThisMonth: number;
  totalActiveLeads: number;
  convertedThisMonth: number;
  conversionRate: number;
  quotesByStatus: QuoteByStatus[];
  topClients: TopClient[];
  generatedAt: string;
}

// ── Contracts ──────────────────────────────────────────────

export interface ContractsResponse {
  activeContracts: number;
  expiringNextMonth: number;
  upcomingMaintenance: number;
  equipmentUnderContract: number;
  generatedAt: string;
}

// ── Technician Dashboard ───────────────────────────────────

export interface TechnicianWorkOrder {
  _id: string;
  workOrderNumber: string;
  title: string;
  status: string;
  priority: string;
  category: string;
  scheduledDate?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  clientSnapshot?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  locationSnapshot?: {
    name?: string;
    address?: string;
    city?: string;
  };
  technicians: Array<{
    _id: string;
    name: string;
    email: string;
    phone: string;
  }>;
}

export interface TechnicianDashboardResponse {
  assignedCount: number;
  completedToday: number;
  pendingOrders: number;
  inProgressOrders: number;
  upcomingSevenDays: number;
  maxDailyLoad: number; // Límite diario de tareas desde la DB
  // Datos globales para el técnico
  globalStats?: {
    totalUnassignedOrders: number;
    totalUnassignedVisits: number;
    ordersExpiringSoon: number;
    urgentOrders: number;
    // Vencidas y por vencer
    expiredOrders: number;
    expiredVisits: number;
    ordersDueSoon: number;
    visitsDueSoon: number;
  };
  sla: SLAMetrics;
  technicianLoad: TechnicianLoad[];
  workOrders: TechnicianWorkOrder[];
  generatedAt: string;
}
