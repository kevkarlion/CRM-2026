# Delta Spec — Operational Domain Evolution

## Phase 1: Schema & Tech Debt

### Requirement: Consolidate Assignment Services

The system SHALL remove `AssignmentService` (`assignment.service.ts`) and consolidate all assignment logic into `WorkAssignmentService` (`work-assignment.service.ts`). All call sites currently importing `AssignmentService` SHALL be migrated.

#### Scenario: All assignment operations use WorkAssignmentService

- GIVEN a developer creates a new WorkOrder assignment
- WHEN they call the assignment service
- THEN they MUST use `WorkAssignmentService.createAssignment()` exclusively
- AND `AssignmentService` module does not exist

#### Scenario: Legacy assignTechnician call migrated

- GIVEN existing code calls `AssignmentService.assignTechnician(workOrderId, technicianId, tenantId, userId)`
- WHEN migrated
- THEN the equivalent call is `WorkAssignmentService.createAssignment(workOrderId, technicianId, userId, tenantId, { assignmentType: 'manual', reason: 'customer_request' })`

### Requirement: Extract Shared WorkOrder Types

The system SHALL export `IWorkOrder`, `WorkOrderStatus`, `WorkOrderPriority`, `WorkOrderCategory`, and snapshot interfaces from `src/operations/types/work-order.ts`. UI pages SHALL NOT redefine these interfaces locally.

#### Scenario: UI page imports shared type

- GIVEN a work-orders list page needs the WorkOrder type
- WHEN it imports the type
- THEN it imports from `@/operations/types/work-order` not a local definition

#### Scenario: WorkOrderDetailDrawer uses shared type

- GIVEN `WorkOrderDetailDrawer.tsx` defines a local `WorkOrder` interface (line 8)
- WHEN refactored
- THEN the local interface is removed and replaced with a DTO type exported from `types/work-order.ts`

### Requirement: Centralize Status/Priority Color Maps

The system SHALL export `WORK_ORDER_STATUS_VARIANT` and `WORK_ORDER_PRIORITY_VARIANT` from `src/operations/constants/status-colors.ts`. All UI files currently defining `STATUS_VARIANT`/`PRIORITY_VARIANT` for work orders SHALL import from this single source.

#### Scenario: Single source of truth for colors

- GIVEN WorkOrderDetailDrawer, work-orders/[id]/page, and work-orders/page all define STATUS_CONFIG/STATUS_VARIANT
- WHEN refactored
- THEN all three import from `@/operations/constants/status-colors`
- AND no local STATUS_VARIANT/STATUS_CONFIG definitions exist for work orders

### Requirement: Remove Duplicate Technician Interface

The system SHALL consolidate the `ITechnician` interface. Currently `ITechnician` is defined inline in `schemas/technician.ts` (line 4). A proper type file `types/technician.ts` SHALL export `ITechnician` and the schema file SHALL import it.

#### Scenario: Technician types are canonical

- GIVEN `src/operations/types/technician.ts` does not exist
- WHEN created
- THEN it exports `ITechnician` interface
- AND `schemas/technician.ts` imports `ITechnician` from `types/technician.ts` instead of defining it inline

### Requirement: Enrich VisitReport Schema

The system SHALL add the following optional fields to `IVisitReport`:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `materialsUsed` | `String` | `undefined` | Free-text material description |
| `materialsItems` | `Array<{item: String, quantity: Number, unit: String}>` | `[]` | Structured materials list |
| `needsNextVisit` | `Boolean` | `false` | Whether follow-up visit required |
| `internalComments` | `String` | `undefined` | Internal notes not visible to client |
| `tasksCompleted` | `[String]` | `[]` | Checklist of completed tasks |

All new fields SHALL be optional. Existing VisitReport documents remain valid without changes.

#### Scenario: Create VisitReport with new fields

- GIVEN a technician completes a work order
- WHEN they submit a VisitReport with `materialsUsed: "Replaced fuse box"`, `materialsItems: [{item: "Fuse box", quantity: 1, unit: "pcs"}]`, `needsNextVisit: true`
- THEN the VisitReport is persisted with all new fields
- AND backward compatibility is maintained (old fields still required)

#### Scenario: Create VisitReport without new fields

- GIVEN a VisitReport is created without any new fields
- WHEN saved
- THEN `materialsItems` defaults to `[]`, `needsNextVisit` defaults to `false`
- AND the document is valid

---

## Phase 2: Self-Assignment

### Requirement: Self-Assignment UI Variant

The system SHALL present a "Self-assign" button on WorkOrder cards when the current user is a Technician and the WorkOrder is in status `scheduled` or `confirmed`. This is a UI concern — the backend `auto_assignment` type in `WorkAssignmentService` already handles the data.

#### Scenario: Technician sees self-assign button

- GIVEN a logged-in Technician views a WorkOrder in `scheduled` status
- WHEN the WorkOrder is unassigned to them
- THEN they see a "Self-assign" button

#### Scenario: Admin does not see self-assign button

- GIVEN a logged-in Admin views a WorkOrder
- WHEN they view any WorkOrder
- THEN no "Self-assign" button is shown (admin uses manual assignment)

### Requirement: SelfAssignmentDrawer Component

The system SHALL create `SelfAssignmentDrawer` component at `src/operations/components/SelfAssignmentDrawer.tsx`. It SHALL display:
- WorkOrder summary (number, title, client, location, scheduled date)
- Required dropdown: reason (from `AssignmentReason` type — customer_request, proximity, availability, coverage, specialty, priority)
- Optional textarea: observations/notes
- Confirm button → calls `WorkAssignmentService.createAssignment` with `assignmentType: 'auto_assignment'`

#### Scenario: Successful self-assignment

- GIVEN a Technician opens SelfAssignmentDrawer for WorkOrder WO-001
- WHEN they select reason "proximity", add note "I'm in the area", and confirm
- THEN `WorkAssignmentService.createAssignment` is called with `assignmentType: 'auto_assignment'`
- AND a TimelineActivity event `technician.self_assigned` is logged
- AND the WorkOrder status transitions to `assigned` (if it was `scheduled` or `confirmed`)

#### Scenario: Concurrent self-assignment rejected

- GIVEN two Technicians simultaneously self-assign to the same WorkOrder
- WHEN the second request arrives
- THEN a clear error message is returned: "This WorkOrder has already been assigned to another technician"

### Requirement: Activity Log for Self-Assignment

The system SHALL log a `technician.self_assigned` activity event when a self-assignment occurs. The event metadata SHALL include `technicianId`, `assignmentId`, `reason`, and `observations`.

#### Scenario: Self-assignment creates activity entry

- GIVEN a Technician self-assigns to WorkOrder WO-002
- WHEN the assignment is created
- THEN a TimelineActivity with action `technician.self_assigned` is persisted
- AND the activity is visible in the WorkOrder's timeline

---

## Phase 3: Centro Operativo (Admin Dashboard)

### Requirement: Centro Operativo Route

The system SHALL provide an admin dashboard at `/centro-operativo` (or evolve existing `/work-orders` page with operational view). The page SHALL be accessible only to users with `operations.view` or `admin` role.

#### Scenario: Admin accesses Centro Operativo

- GIVEN a user with `admin` role
- WHEN they navigate to `/centro-operativo`
- THEN they see the operational dashboard
- AND the page loads summary metrics and work order list

### Requirement: Operational Summary Cards

The system SHALL display summary cards answering operational questions:

| Card | Data | Source |
|------|------|--------|
| Unassigned | Count of WOs in draft/scheduled/confirmed with no technicians | `operativeDashboardService` |
| Overdue | Count of WOs past `scheduledDate` not completed/cancelled | `operativeDashboardService` |
| Today's Work | Count of WOs with `scheduledDate = today` | `operativeDashboardService` |
| In Execution | Count of WOs in assigned/en_route/on_site | `operativeDashboardService` |
| Technician Availability | Available / Busy / Unavailable counts | `operativeDashboardService.getTechnicianWorkload` |

#### Scenario: Summary cards load on dashboard

- GIVEN an admin opens Centro Operativo
- WHEN the page loads
- THEN 5 summary cards display current counts
- AND counts refresh on page focus/refresh

### Requirement: Work Order List Sort

The system SHALL sort the work order list by: urgency priority → scheduled date ascending. Emergency and urgent WOs appear first regardless of date.

#### Scenario: Urgent WOs appear before normal WOs

- GIVEN WO-001 (priority: urgent, scheduled: 2026-07-22) and WO-002 (priority: normal, scheduled: 2026-07-21)
- WHEN the list is rendered
- THEN WO-001 appears before WO-002

#### Scenario: Same priority sorted by date

- GIVEN WO-003 (priority: normal, scheduled: 2026-07-20) and WO-004 (priority: normal, scheduled: 2026-07-22)
- WHEN the list is rendered
- THEN WO-003 appears before WO-004

### Requirement: Calendar View Component

The system SHALL provide an `OperationalCalendar` component with three view modes: daily, weekly, monthly. Admin view SHALL show all WorkOrders and all technicians. Each calendar cell/day SHALL show WO cards with status badge, priority indicator, assigned technician name, and time slot.

#### Scenario: Daily view shows today's WOs

- GIVEN admin switches to daily view on 2026-07-20
- WHEN the calendar renders
- THEN all WOs scheduled for 2026-07-20 are displayed in time slots

#### Scenario: Weekly view shows week overview

- GIVEN admin switches to weekly view for week of 2026-07-20 to 2026-07-26
- WHEN the calendar renders
- THEN each day column shows WOs scheduled for that day
- AND unassigned WOs are visually distinguished (e.g., gray border)

#### Scenario: Monthly view shows month overview

- GIVEN admin switches to monthly view for July 2026
- WHEN the calendar renders
- THEN each day cell shows WO count and priority distribution summary
- AND clicking a day navigates to daily view

### Requirement: Mobile-First Responsive Design

The Centro Operativo SHALL render mobile-first. On viewports < 640px, the calendar SHALL default to daily view. Summary cards SHALL stack vertically. Work order list SHALL use card layout (not table).

#### Scenario: Mobile viewport renders correctly

- GIVEN a user opens Centro Operativo on a 375px viewport
- WHEN the page loads
- THEN summary cards are stacked vertically
- AND calendar defaults to daily view
- AND WO list uses card layout

---

## Phase 4: Technician Calendar

### Requirement: Technician Calendar Route

The system SHALL provide a personal calendar view at `/technician/calendar` for logged-in Technicians. The view SHALL show only WorkOrders assigned to the current technician (via `WorkAssignmentService.getAssignmentsByTechnician`).

#### Scenario: Technician sees only their WOs

- GIVEN Technician T-001 is logged in
- WHEN they open `/technician/calendar`
- THEN only WOs where T-001 is the current assignee are shown

#### Scenario: Admin redirected or denied

- GIVEN an Admin navigates to `/technician/calendar`
- WHEN the page loads
- THEN they are redirected to `/centro-operativo` or shown an access denied message

### Requirement: Technician Calendar Views

The system SHALL provide daily, weekly, and monthly views for the technician calendar. Each WO card SHALL show: workOrderNumber, title, client name, scheduled time, status badge, priority badge.

#### Scenario: Daily view with WO cards

- GIVEN T-001 has 3 WOs scheduled for today
- WHEN daily view is rendered
- THEN 3 WO cards appear in time-slot order
- AND each card shows self-assign button if WO is unassigned to T-001

#### Scenario: Self-assign from calendar card

- GIVEN T-001 views a WO card in their calendar that is in `scheduled` status
- WHEN they click "Self-assign" on the card
- THEN `SelfAssignmentDrawer` opens pre-filled with that WO
- AND after confirmation the card updates to show assigned status

### Requirement: Mobile-First Technician Calendar

The technician calendar SHALL default to daily view on mobile (< 640px). WO cards SHALL be full-width. Swipe gestures MAY be supported for day navigation.

#### Scenario: Mobile daily view

- GIVEN T-001 opens calendar on mobile
- WHEN the page loads
- THEN daily view is shown by default
- AND WO cards are full-width with touch-friendly targets (min 44px height)

---

## Phase 5: VisitReport → WorkReport Evolution

### Requirement: VisitReport Form Enrichment

The system SHALL extend the VisitReport form UI to include new sections for the Phase 1 schema additions:
- Materials section (free text + dynamic structured items list with add/remove row)
- Tasks completed (checkbox list or tag input)
- Internal comments (visible only to admin, not to client)
- "Needs next visit" toggle

All form sections SHALL be backward compatible (new fields optional).

#### Scenario: Submit VisitReport with materials

- GIVEN a technician opens the VisitReport form for a completed work order
- WHEN they add materials "Replaced filter" with quantity 2, unit "pcs"
- AND they check "Needs next visit"
- THEN the VisitReport is saved with both `materialsUsed` text and `materialsItems` array populated

#### Scenario: Submit VisitReport without new fields

- GIVEN a technician submits a VisitReport without filling new sections
- WHEN the form is submitted
- THEN new fields are omitted or default (`materialsItems: []`, `needsNextVisit: false`)
- AND the submission succeeds

### Requirement: WorkOrder Status Actions Update

The system SHALL update `STATUS_ACTIONS` in `WorkOrderDetailDrawer` to include proper forward transitions through the complete state machine. Current actions are incomplete (confirmed, assigned, en_route, on_site all have empty action arrays).

#### Scenario: Confirmed WO can be assigned

- GIVEN a WorkOrder in `confirmed` status
- WHEN the admin views actions
- THEN they see "Assign Technician" action

#### Scenario: Assigned WO can transition to en_route

- GIVEN a WorkOrder in `assigned` status with completed checklist
- WHEN the technician views actions
- THEN they see "Start Route" action

#### Scenario: On-site WO can be completed

- GIVEN a WorkOrder in `on_site` status with VisitReport submitted
- WHEN the technician views actions
- THEN they see "Complete" action

---

## State Machine Changes

### Requirement: Complete State Transitions

The existing state machine at `src/operations/helpers/state-machine.ts` SHALL be reviewed. Current transitions already include the full lifecycle. No new transitions are added. The `hasVisitReport` guard currently references VisitReport — this is correct as VisitReport IS the work report entity in this evolution (not a separate WorkReport).

#### Scenario: State machine unchanged

- GIVEN the current VALID_TRANSITIONS in state-machine.ts
- WHEN reviewed
- THEN all transitions remain valid: draft→scheduled→confirmed→assigned→en_route→on_site→completed→closed
- AND guards for hasChecklist, hasVisitReport, hasTechnicians, hasSchedule remain enforced

---

## API Changes

### Requirement: Self-Assignment Endpoint

The system SHALL expose `POST /api/operations/work-orders/{id}/self-assign` for technician self-assignment. Request body: `{ reason: AssignmentReason, reasonDetail?: string, notes?: string }`. Response: `{ assignment, workOrder }`. This endpoint calls `WorkAssignmentService.createAssignment` with `assignmentType: 'auto_assignment'` and `assignedBy = currentUserId`.

#### Scenario: Self-assign API call

- GIVEN a Technician calls `POST /api/operations/work-orders/WO-001/self-assign` with `{ reason: "proximity", notes: "Nearby" }`
- WHEN the request is processed
- THEN a WorkAssignment is created with `assignmentType: 'auto_assignment'`
- AND the WorkOrder status transitions to `assigned`
- AND the response contains the assignment and updated work order

### Requirement: Calendar Data Endpoint

The system SHALL expose `GET /api/operations/dashboard/calendar?view=daily|weekly|monthly&date=YYYY-MM-DD` for calendar data. For admin: returns all WOs in the date range. For technician: filters to assigned WOs only (based on current user's technician profile).

#### Scenario: Admin calendar request

- GIVEN admin calls `GET /api/operations/dashboard/calendar?view=weekly&date=2026-07-20`
- WHEN the request is processed
- THEN response contains all WOs with `scheduledDate` in the week range
- AND each WO includes technician assignment info

#### Scenario: Technician calendar request

- GIVEN Technician T-001 calls `GET /api/operations/dashboard/calendar?view=daily&date=2026-07-20`
- WHEN the request is processed
- THEN response contains only WOs where T-001 is the current assignee
- AND each WO includes self-assignment eligibility info

---

## Component Structure

### New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `SelfAssignmentDrawer` | `src/operations/components/SelfAssignmentDrawer.tsx` | Self-assignment modal with reason + notes |
| `OperationalCalendar` | `src/operations/components/OperationalCalendar.tsx` | Shared calendar with daily/weekly/monthly views |
| `OperationalSummaryCards` | `src/operations/components/OperationalSummaryCards.tsx` | Dashboard summary cards |
| `WorkOrderCalendarCard` | `src/operations/components/WorkOrderCalendarCard.tsx` | WO card for calendar views |
| `MaterialsSection` | `src/operations/components/MaterialsSection.tsx` | Hybrid materials input (text + structured) |

### Modified Components

| Component | Change |
|-----------|--------|
| `WorkOrderDetailDrawer` | Import shared types, import centralized colors, update STATUS_ACTIONS |
| `ScheduleVisitModal` | Import shared types, import centralized colors |

### New Pages

| Route | Role | Description |
|-------|------|-------------|
| `/centro-operativo` | Admin | Operational dashboard with summary + calendar + list |
| `/technician/calendar` | Technician | Personal calendar with assigned WOs only |

---

## Acceptance Criteria Summary

| Phase | Criterion | Testable? |
|-------|-----------|-----------|
| 1 | `AssignmentService` file removed, no imports remain | Yes |
| 1 | `WorkOrderDetailDrawer` imports shared types | Yes |
| 1 | `STATUS_VARIANT` for WOs defined in one file | Yes |
| 1 | `ITechnician` exported from `types/technician.ts` | Yes |
| 1 | VisitReport schema accepts new optional fields | Yes |
| 2 | Self-assign button visible to Technicians only | Yes |
| 2 | `SelfAssignmentDrawer` calls correct service method | Yes |
| 2 | Concurrent self-assignment returns error | Yes |
| 2 | Activity event logged on self-assignment | Yes |
| 3 | Centro Operativo renders for admin role | Yes |
| 3 | 5 summary cards display correct counts | Yes |
| 3 | WO list sorted by priority → date | Yes |
| 3 | Calendar shows daily/weekly/monthly views | Yes |
| 3 | Mobile-first layout at 375px | Yes |
| 4 | Technician calendar shows only assigned WOs | Yes |
| 4 | Self-assign from calendar card works | Yes |
| 4 | Mobile daily view as default | Yes |
| 5 | VisitReport form shows materials section | Yes |
| 5 | Structured materials items can be added/removed | Yes |
| 5 | STATUS_ACTIONS includes forward transitions | Yes |
