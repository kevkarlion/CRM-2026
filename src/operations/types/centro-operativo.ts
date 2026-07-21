export interface DashboardSummary {
  totalWorkOrders: number;
  pending: number;
  urgent: number;
  overdue: number;
  withoutTechnician: number;
  inExecution: number;
  pendingReport: number;
}

export interface TechnicianWorkload {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  status: string;
  availability: string;
  specialties: string[];
  maxDailyWorkOrders: number;
  activeAssignments: number;
  todayAssignments: number;
  completedToday: number;
  utilization: number;
}

export interface CalendarEvent {
  _id: string;
  workOrderNumber: string;
  title: string;
  status: string;
  priority: string;
  category: string;
  scheduledDate: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  clientSnapshot?: { name?: string; email?: string; phone?: string };
  locationSnapshot?: { name?: string; address?: string; city?: string };
  technicians: { _id: string; name: string; email?: string; phone?: string }[];
}

export interface WorkOrderRow {
  _id: string;
  workOrderNumber: string;
  title: string;
  description?: string;
  priority: string;
  category: string;
  status: string;
  source: string;
  scheduledDate?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  clientSnapshot?: { name?: string; email?: string; phone?: string; customerType?: string };
  locationSnapshot?: { name?: string; address?: string; city?: string; province?: string };
  assignedTechnicians: string[];
  technicianNames?: string[];
  version: number;
}

export interface CentroOperativoDashboardResponse {
  summary: DashboardSummary;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  technicians: TechnicianWorkload[];
  nextActions: {
    unassigned: number;
    unscheduled: number;
    pendingApproval: number;
    awaitingExecution: number;
    pendingReport: number;
  };
}
