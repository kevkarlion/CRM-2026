# SDD Spec: Fase 3.1 — Operaciones Services, APIs, OCC, Tests

> **Change name**: `fase-3-1-operaciones`
> **Topic key**: `sdd/fase-3-1-operaciones/spec`
> **Stack**: Next.js, TypeScript, MongoDB Atlas, Mongoose
> **Basado en**: Fase 3 data layer (types, schemas, models, helpers)

---

## 1. Intent

Implement services with business logic, REST APIs, Optimistic Concurrency Control, and tests on top of the existing Operations data layer.

---

## 2. Specifications

### 2.1 work-order-lifecycle

**WO-CRUD**: System MUST support create, read, list, update of WorkOrders. List MUST filter by `status`, `tenantId`, `technicianId`, `scheduledDate` range. Create MUST validate referenced `clientId`, `locationId`, `equipmentId` exist, populate snapshots, and auto-generate `workOrderNumber`.

- Given valid references → work order created with `draft` status
- Given non-existent `clientId` → 422 validation error
- Given no matching WorkOrders → empty array

**WO-STATE-MACHINE**: System MUST enforce 10-state workflow: `draft→scheduled→confirmed→assigned→en_route→on_site⇄paused→completed→closed`. Cancel from any non-terminal state.

- Given `draft` with schedule info → status updates, `WorkOrderEvent` created
- Given `scheduled→draft` (regression) → 422 rejected
- Given transition from `closed` (terminal) → 422 rejected

**WO-GUARDS**: System MUST validate 4 guards:
1. `draft→scheduled`: `scheduledDate` + `scheduledStart` + `scheduledEnd` MUST be set
2. `*→assigned`: at least one technician in `assignedTechnicians`
3. `assigned→en_route`: `PreVisitChecklist` complete → `validateChecklist()` returns `true`
4. `on_site→completed`: `VisitReport` exists

- Given complete checklist → `assigned→en_route` allowed
- Given incomplete checklist → 422 blocked

**WO-OCC**: System MUST implement OCC via `version` field. Every transition MUST validate `version` + `status` atomically in the MongoDB filter. On success, increment `version`.

- Given correct `version` → update succeeds, version incremented
- Given stale `version` → 409 Conflict, no changes

**WO-AUDIT**: Every transition MUST log via `core/audit/activity-logger.ts` with `entityType: 'workOrder'`.

- Given `draft→scheduled` → `ActivityLog` entry created

**WO-SOFT-DELETE**: Only allowed when status is `draft` or `cancelled` AND no `VisitReport` or `WorkOrderEvent` exists.

- Given `draft` with no events → `deletedAt` set
- Given existing `VisitReport` → 422 rejected

### 2.2 technician-assignment

**ASSIGN-CREATE**: `assignTechnician()` MUST create `WorkOrderAssignment` + sync denormalized `assignedTechnicians` array on WorkOrder.

- Given valid WorkOrder → assignment created, array updated
- Given same technician twice → rejected (unique index)

**ASSIGN-REPLACE**: `reassignTechnician()` MUST mark existing as `replaced`, create new, sync array.

- Given replace A with B → A's marked `replaced`, B created, array reflects B

**ASSIGN-AUDIT**: Every assignment MUST generate `ActivityLog`.

- Given assignment → `ActivityLog` created

### 2.3 pre-visit-checklist

**CHECKLIST-GUARD**: `assigned→en_route` blocked unless all 6 booleans `true` + `completedAt` set.

- Given complete checklist → transition allowed
- Given incomplete → 422 blocked

**CHECKLIST-CRUD**: System MUST support create, update, complete. `validateChecklist()` returns boolean.

- Given valid WorkOrder → checklist created with 6 booleans default `false`
- Given duplicate per `workOrderId` → rejected (unique constraint)

### 2.4 visit-report

**REPORT-GUARD**: `on_site→completed` blocked unless `VisitReport` exists.

- Given existing report → transition allowed
- Given no report → 422 blocked

**REPORT-CRUD**: System MUST support create, update, get. `customerSignature`, `customerName`, `signedAt` are declared but SHALL NOT be implemented.

- Given valid data → report created with audit fields
- Given non-existent report → 404

### 2.5 scheduling-conflict-detection

**SCHEDULE-CONFLICT**: Overlap = `startA < endB AND startB < endA`. Same technician cannot overlap.

- Given 09:00-10:00 and 10:00-11:00 → no conflict
- Given 09:00-10:01 and 10:00-11:00 → conflict
- Given 09:00-11:00 and 09:30-10:00 → conflict
- Given 09:00-10:00 and 09:00-10:00 → conflict

**SCHEDULE-RESCHEDULE**: Any reschedule MUST create `WorkOrderEvent` (`eventType: 'rescheduled'` with `before`/`after` metadata) + `ActivityLog`.

- Given reschedule → event + audit created

---

## 3. API Routes

REST endpoints prefixed `/api/operations/work-orders`: CRUD (`GET`, `POST`, `PATCH` + `DELETE` with soft-delete), `[id]/status` (state transitions with OCC), `[id]/assign` and `[id]/reassign`, `[id]/checklist` (CRUD), `[id]/report` (CRUD).

---

## 4. Files (New/Modified)

5 services in `src/operations/services/`, `work-order.ts` schema adds `version`, REST handlers in `src/operations/api/work-orders/`, tests in `tests/operations/`.

---

> **Próximo paso**: SDD Design.
