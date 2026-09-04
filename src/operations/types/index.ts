export type {
  WorkOrderPriority,
  WorkOrderCategory,
  WorkOrderStatus,
  WorkStatus,
  IClientSnapshot,
  ILocationSnapshot,
  IEquipmentSnapshot,
  IWorkOrder,
  CreateWorkOrderInput,
  UpdateWorkOrderInput,
} from './work-order';

export type {
  AssignmentStatus,
  IWorkOrderAssignment,
  CreateWorkOrderAssignmentInput,
} from './work-order-assignment';

export type {
  IPreVisitChecklist,
  CreatePreVisitChecklistInput,
} from './pre-visit-checklist';

export type {
  WorkOrderEventType,
  IWorkOrderEvent,
  CreateWorkOrderEventInput,
} from './work-order-event';

export type {
  IWorkReport,
  WorkResult,
  WorkPerformed,
  AdditionalIssue,
  NextVisitRecommendation,
  CreateWorkReportInput,
  CreateWorkReportApiInput,
  UpdateWorkReportInput,
  WorkReportResponse,
} from './work-report';

export type { ITechnician } from './technician';

export type {
  DashboardSummary,
  TechnicianWorkload,
  CalendarEvent,
  WorkOrderRow,
  CentroOperativoDashboardResponse,
} from './centro-operativo';
