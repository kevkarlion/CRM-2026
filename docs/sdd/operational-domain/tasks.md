# Tasks: Operational Domain Evolution

## Phase 1 — Schema & Tech Debt (Foundation)

### T1: Extract ITechician to types/technician.ts
**Phase**: 1 | **Deps**: none
**Files**: `src/operations/types/technician.ts` (create), `src/operations/types/index.ts` (modify), `src/operations/schemas/technician.ts` (modify)
**Description**: Extract the `ITechician` interface from `schemas/technician.ts` to its own `types/technician.ts` file. Update `schemas/technician.ts` to import from types. Export from `types/index.ts`.
**~lines**: 30

---

### T2: Consolidate Technician schema — single source of truth
**Phase**: 1 | **Deps**: T1
**Files**: `src/operations/schemas/technician.ts` (modify), `src/operations/models/technician.ts` (modify)
**Description**: `models/technician.ts` duplicates the schema definition from `schemas/technician.ts`. Refactor so `models/technician.ts` imports `technicianSchema` from `schemas/technician.ts` instead of re-declaring it. Both files currently define the schema independently — consolidate to one.
**~lines**: 15

---

### T3: Centralize STATUS_VARIANT / PRIORITY_VARIANT maps
**Phase**: 1 | **Deps**: none
**Files**: `src/operations/constants/status-colors.ts` (create)
**Description**: Create `src/operations/constants/status-colors.ts` exporting `WORK_ORDER_STATUS_VARIANT`, `WORK_ORDER_PRIORITY_VARIANT`, and helper `getStatusVariant(status)` / `getPriorityVariant(priority)`. Extract canonical values from `work-orders/page.tsx:53-72`. This is the source of truth — all other consumers will import from here (done in later tasks).
**~lines**: 40

---

### T4: Extract shared WorkOrder types used by UI pages
**Phase**: 1 | **Deps**: none
**Files**: `src/operations/types/work-order-list.ts` (create), `src/operations/types/index.ts` (modify)
**Description**: UI pages (`work-orders/page.tsx`, `work-orders/[id]/page.tsx`) re-define `WorkOrder` interface inline with subset fields. Extract a `WorkOrderListItem` type to `types/work-order-list.ts` covering the list-view shape (`_id, workOrderNumber, title, status, priority, source, scheduledDate, clientSnapshot, assignedTechnicians`). Export from index.
**~lines**: 25

---

### T5: Enrich VisitReport types
**Phase**: 1 | **Deps**: none
**Files**: `src/operations/types/visit-report.ts` (modify)
**Description**: Add to `IVisitReport`: `materialsUsed?: string` (free text), `materialsItems?: Array<{ item: string; quantity: number; unit: string }>`, `needsNextVisit?: boolean`, `internalComments?: string`, `attachments?: Array<{ filename: string; url: string; type: string; uploadedAt: Date }>`. Update `CreateVisitReportInput` to include the new optional fields.
**~lines**: 20

---

### T6: Enrich VisitReport schema
**Phase**: 1 | **Deps**: T5
**Files**: `src/operations/schemas/visit-report.ts` (modify)
**Description**: Add Mongoose schema fields matching T5 types: `materialsUsed: String`, `materialsItems: [{ item: String, quantity: Number, unit: String }]`, `needsNextVisit: { type: Boolean, default: false }`, `internalComments: String`, `attachments: [{ filename: String, url: String, type: String, uploadedAt: Date }]`. All optional, backward-compatible.
**~lines**: 18

---

### T7: Consolidate AssignmentService → WorkAssignmentService
**Phase**: 1 | **Deps**: none
**Files**: `src/operations/services/assignment.service.ts` (delete after migration), `src/operations/services/work-assignment.service.ts` (modify), `src/operations/services/index.ts` (modify), `src/app/api/operations/work-orders/[id]/assign/route.ts` (modify)
**Description**: Migrate `/assign` route to use `WorkAssignmentService` instead of `AssignmentService`. Map: `assignTechnician` → `createAssignment({ assignmentType: 'manual' })`, `unassignTechnician` → `createAssignment` with status declined, `reassignTechnician` → `replaceTechnician()`. Update `getCurrentAssignments` → use `WorkAssignmentService.getCurrentAssignment()`. Remove `AssignmentService` from services/index.ts. Delete `assignment.service.ts`. Export `WorkAssignmentService` from index.
**~lines**: 60

---

### T8: Update work-orders page to use centralized constants + shared types
**Phase**: 1 | **Deps**: T3, T4
**Files**: `src/app/(dashboard)/work-orders/page.tsx` (modify)
**Description**: Replace inline `STATUS_VARIANT` and `PRIORITY_VARIANT` maps with imports from `constants/status-colors.ts`. Replace inline `WorkOrder` interface with `WorkOrderListItem` from types. Delete the local constant definitions (lines 53-72). Net negative lines.
**~lines**: -15

---

### T9: Update work-orders/[id] page to use centralized constants
**Phase**: 1 | **Deps**: T3
**Files**: `src/app/(dashboard)/work-orders/[id]/page.tsx` (modify)
**Description**: Replace inline `STATUS_VARIANT` and `PRIORITY_VARIANT` maps (lines 55-68) with imports from `constants/status-colors.ts`. Delete local definitions.
**~lines**: -12

---

### T10: Update WorkOrderDetailDrawer to use centralized constants
**Phase**: 1 | **Deps**: T3
**Files**: `src/operations/components/WorkOrderDetailDrawer.tsx` (modify)
**Description**: Replace inline `STATUS_CONFIG` map (lines 44-55) with import from `constants/status-colors.ts`. Use the `getStatusVariant()` helper.
**~lines**: -10

---

## Phase 2 — Self-Assignment

### T11: Add selfAssign method to WorkAssignmentService
**Phase**: 2 | **Deps**: T7
**Files**: `src/operations/services/work-assignment.service.ts` (modify)
**Description**: Add `selfAssign(workOrderId, technicianId, tenantId, userId, { reason, reasonDetail?, notes? })` method. Validates: WO status is `scheduled` or `assigned` (not already to this tech), tech is active + available, daily capacity not exceeded. Delegates to `createAssignment({ assignmentType: 'auto_assignment' })`. Publishes `WORK_ORDER_SELF_ASSIGNED` event via eventBus in try-catch. Logs activity `technician.self_assigned`.
**~lines**: 50

---

### T12: Add WORK_ORDER_SELF_ASSIGNED and WORK_ORDER_ASSIGNED events
**Phase**: 2 | **Deps**: none
**Files**: `src/infrastructure/events/event.types.ts` (modify)
**Description**: Add `WORK_ORDER_SELF_ASSIGNED: 'WORK_ORDER_SELF_ASSIGNED'` and `WORK_ORDER_ASSIGNED: 'WORK_ORDER_ASSIGNED'` to `DOMAIN_EVENTS`. Add `WorkOrderSelfAssignedPayload` and `WorkOrderAssignedPayload` interfaces.
**~lines**: 20

---

### T13: Create self-assign API route
**Phase**: 2 | **Deps**: T11, T12
**Files**: `src/app/api/operations/work-orders/[id]/self-assign/route.ts` (create)
**Description**: POST endpoint. Extracts `tenantId`, `userId` from headers. Parses body `{ reason, reasonDetail?, notes? }`. Validates reason is one of: proximity, availability, priority, schedule_change, other. Calls `workAssignmentService.selfAssign()`. Returns 201 with assignment + workOrder.
**~lines**: 45

---

### T14: Create SelfAssignmentDrawer component
**Phase**: 2 | **Deps**: T12
**Files**: `src/operations/components/SelfAssignmentDrawer.tsx` (create)
**Description**: Drawer with: (1) reason dropdown (proximity, availability, priority, schedule_change, other), (2) reasonDetail text input (conditional on reason), (3) observations textarea. Footer with Cancel + "Auto-asignar" button. Calls POST `/api/operations/work-orders/[id]/self-assign`. Handles loading/error/success states. Follows Drawer pattern from UX skill: header with title + X, scrollable content, sticky footer.
**~lines**: 120

---

### T15: Wire SelfAssignmentDrawer into WorkOrderListPage
**Phase**: 2 | **Deps**: T14, T8
**Files**: `src/app/(dashboard)/work-orders/page.tsx` (modify)
**Description**: Add "Auto-asignar" button to each WO row when user is a technician. State: `selectedWOForSelfAssign`. Opens `SelfAssignmentDrawer`. On success, refetch list. Conditional rendering based on user role (technician vs admin).
**~lines**: 25

---

## Phase 3 — Centro Operativo Admin Dashboard

### T16: Add getUnassignedWorkOrders to OperativeDashboardService
**Phase**: 3 | **Deps**: none
**Files**: `src/operations/services/operative-dashboard.service.ts` (modify)
**Description**: Add method `getUnassignedWorkOrders(tenantId, { limit?, scheduledBefore? })` that queries WOs with status in `['scheduled', 'confirmed']` and empty `assignedTechnicians`. Sorts by priority DESC, scheduledDate ASC.
**~lines**: 25

---

### T17: Add unassigned view to dashboard API route
**Phase**: 3 | **Deps**: T16
**Files**: `src/app/api/operations/dashboard/route.ts` (modify)
**Description**: Add `view=unassigned` query param handler. Calls `getUnassignedWorkOrders()`. Returns `{ data: workOrders, count }`.
**~lines**: 12

---

### T18: Create MetricsCards component
**Phase**: 3 | **Deps**: none
**Files**: `src/operations/components/CentroOperativo/MetricsCards.tsx` (create)
**Description**: 4-card grid: Unassigned (amber), Overdue (red), Today's Workload (blue), Available Technicians (green). Each card: icon, label, count, onClick handler. Mobile: 2x2 grid. Desktop: 4-column. Uses `OperativeDashboardMetrics` type.
**~lines**: 65

---

### T19: Create WorkOrderListView component
**Phase**: 3 | **Deps**: T3, T4
**Files**: `src/operations/components/CentroOperativo/WorkOrderListView.tsx` (create)
**Description**: Sortable list of WOs. Sort options: urgency (priority DESC), scheduledDate ASC, createdAt DESC. Each row: WO number, title, client, status badge, priority badge, scheduled date, assigned tech. Click opens WO detail. "Auto-asignar" button for technicians. Uses centralized status/priority color maps. Cursor-based pagination.
**~lines**: 100

---

### T20: Create TechnicianWorkloadPanel component
**Phase**: 3 | **Deps**: none
**Files**: `src/operations/components/CentroOperativo/TechnicianWorkloadPanel.tsx` (create)
**Description**: Sidebar panel listing technicians with: name, availability badge, utilization bar (todayAssignments / maxDailyWorkOrders), active assignments count, completed today count. Click opens technician detail. Mobile: collapsible/hidden by default. Desktop: always visible sidebar.
**~lines**: 70

---

### T21: Create CalendarView component
**Phase**: 3 | **Deps**: T3
**Files**: `src/operations/components/CentroOperativo/CalendarView.tsx` (create)
**Description**: Calendar with daily/weekly/monthly views. Toggle buttons for view mode. Navigation: prev/next + today button. Monthly: grid of days, each showing WO count + priority dots. Weekly: horizontal day columns with WO cards. Daily: vertical timeline with WO cards. Click WO → detail. `technicianFilter` prop for filtering. Mobile: day view only, swipe nav.
**~lines**: 140

---

### T22: Create CentroOperativoPage
**Phase**: 3 | **Deps**: T18, T19, T20, T21, T8
**Files**: `src/operations/components/CentroOperativo/CentroOperativoPage.tsx` (create)
**Description**: Main dashboard page. Tabs: Dashboard | Calendar | Technicians. Dashboard tab: MetricsCards + WorkOrderListView. Calendar tab: CalendarView with agenda data. Technicians tab: TechnicianWorkloadPanel full-width. Fetches from existing `/api/operations/dashboard` endpoints. Mobile-first responsive grid: `grid-cols-1 lg:grid-cols-3`. Replaces old `work-orders/page.tsx`.
**~lines**: 110

---

### T23: Replace work-orders page with CentroOperativoPage
**Phase**: 3 | **Deps**: T22
**Files**: `src/app/(dashboard)/work-orders/page.tsx` (replace)
**Description**: Replace the current page content with a simple wrapper that renders `CentroOperativoPage`. Keep existing URL `/work-orders` as the Centro Operativo home.
**~lines**: 15

---

## Phase 4 — Technician Calendar

### T24: Add technician filter to work-orders API route
**Phase**: 4 | **Deps**: none
**Files**: `src/app/api/operations/work-orders/route.ts` (modify)
**Description**: Add `technicianId` query param. When provided, filter WOs where `assignedTechnicians` includes that ID. Used by technician calendar to show "my WOs".
**~lines**: 15

---

### T25: Create CalendarDayView component
**Phase**: 4 | **Deps**: T3
**Files**: `src/operations/components/TechnicianCalendar/CalendarDayView.tsx` (create)
**Description**: Day detail view showing WO cards in time-slot layout. Each card: WO number, client, status badge, priority badge, time range, assigned tech. Click opens detail. "Auto-asignar" button on unassigned WOs. Empty state when no WOs.
**~lines**: 80

---

### T26: Create TechnicianCalendarPage
**Phase**: 4 | **Deps**: T25, T24, T14
**Files**: `src/operations/components/TechnicianCalendar/TechnicianCalendarPage.tsx` (create)
**Description**: Personal calendar view for technicians. Only shows WOs assigned to logged-in user. Daily/weekly/monthly toggle. Uses `CalendarView` (from T21) with `technicianFilter` set to current user. Integrates `SelfAssignmentDrawer` for self-assigning from calendar. Mobile-first.
**~lines**: 70

---

### T27: Create calendar page route
**Phase**: 4 | **Deps**: T26
**Files**: `src/app/(dashboard)/work-orders/calendar/page.tsx` (create)
**Description**: Page component that renders `TechnicianCalendarPage`. Add nav link from work-orders page to calendar view.
**~lines**: 20

---

## Phase 5 — VisitReport → WorkReport Evolution

### T28: Enrich VisitReport form UI
**Phase**: 5 | **Deps**: T5, T6
**Files**: `src/operations/components/WorkReportForm.tsx` (create or modify existing form)
**Description**: Extend the visit report form with new optional sections: (1) Materials Used — text area + dynamic list with item/quantity/unit inputs (add/remove rows), (2) Needs Next Visit — boolean toggle, (3) Internal Comments — textarea (admin-only visibility), (4) Attachments — file upload area with filename/type/preview (placeholder for actual upload logic). All fields optional for backward compatibility. Follow Drawer+Form pattern from UX skill.
**~lines**: 130

---

### T29: Update VisitReport API to accept new fields
**Phase**: 5 | **Deps**: T28
**Files**: `src/app/api/operations/work-orders/[id]/report/route.ts` (modify)
**Description**: Ensure POST/PUT handlers accept and persist the new optional fields (materialsUsed, materialsItems, needsNextVisit, internalComments, attachments). Validate attachments max 10 items. All new fields pass-through to service.
**~lines**: 20

---

## PR Split Recommendation

Total estimated lines: ~1,232. Exceeds 400-line review budget. Recommended PR split:

| PR | Scope | Tasks | Est. Lines |
|----|-------|-------|------------|
| PR 1 | Phase 1: Tech Debt | T1–T10 | ~196 |
| PR 2 | Phase 2: Self-Assignment | T11–T15 | ~260 |
| PR 3 | Phase 3: Centro Operativo | T16–T23 | ~537 → split below |
| PR 3a | Centro Operativo: Service + API | T16–T17 | ~37 |
| PR 3b | Centro Operativo: Components | T18–T22 | ~485 → still large |
| PR 3b-1 | MetricsCards + WorkOrderListView | T18–T19 | ~165 |
| PR 3b-2 | TechnicianWorkloadPanel + CalendarView | T20–T21 | ~210 |
| PR 3b-3 | CentroOperativoPage + routing | T22–T23 | ~125 |
| PR 4 | Phase 4: Technician Calendar | T24–T27 | ~185 |
| PR 5 | Phase 5: WorkReport Evolution | T28–T29 | ~150 |

**Total: 8 PRs** (PR 3 split into 4 sub-PRs to stay under ~200 lines each).
