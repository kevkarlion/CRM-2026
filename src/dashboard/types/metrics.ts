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
