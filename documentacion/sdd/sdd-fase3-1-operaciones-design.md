# SDD Design: Fase 3.1 — Services, APIs, OCC & Tests

> **Change name**: `fase-3-1-operaciones`
> **Stack**: Next.js, TypeScript, MongoDB Atlas, Mongoose
> **Based on**: SDD Spec (fase-3-1-operaciones), existing data layer (phase 3)

---

## 1. Technical Approach

Build 5 services in `src/operations/services/` following the existing CRM service pattern (class-based with `create`, `findById`, `findByTenant`, `update`, `softDelete`). Add REST API routes under `src/app/api/operations/` using Next.js App Router. Add a `version` field to WorkOrder for OCC. Reuse cursor pagination from `src/crm/helpers/cursor-pagination.ts` for event timelines.

**Dependency unidireccional**: Operations → CRM (reads Client, Location, Equipment). Operations → Core (reads User, writes ActivityLog). Sin dependencia inversa.

---

## 2. Architecture Decisions

### 2.1 Service Pattern
**Choice**: Class-based services matching `src/crm/services/client.service.ts` pattern.
**Evidence**: Each service has `create(data, tenantId, userId)`, `findById(id, tenantId)`, `findByTenant(tenantId, filter)`, `update(id, data, tenantId, userId)`, `softDelete(id, tenantId, userId)`. Uses `.lean().exec()`, `findOneAndUpdate` with `{ new: true }`.
**Rationale**: Consistency with existing codebase.

### 2.2 Optimistic Concurrency Control
**Choice**: `version: Number` field (default 0) in WorkOrder schema. Every mutation includes `version` in `findOneAndUpdate` filter and `$inc: { version: 1 }`. If `matchedCount === 0`, return 409 Conflict.
**Alternatives**: MongoDB transactions (session overhead), `updatedAt` comparison (race on same millisecond).
**Rationale**: Document-level atomicity with no session overhead, proven in existing codebase (status-based lock already used).

### 2.3 State Machine Integration
**Choice**: Services call `validateTransition(from, to, context)` from `helpers/state-machine.ts` before any status change. Guards enforced at service layer — not schema or route.
**Rationale**: Business logic belongs in services. State machine helper already has access to `TransitionContext` (checklist, visit report, technicians, schedule).

### 2.4 Assignment Consistency
**Choice**: `AssignmentService` is the single write path. Writes to `WorkOrderAssignment` collection (canonical), then syncs `WorkOrder.assignedTechnicians` denormalized array via `findOneAndUpdate` in the same service method.
**Pattern**: Canonical + denormalized (exactly as designed in phase 3, now implemented).
**Rationale**: No external consumer can corrupt the denormalized field.

### 2.5 Audit Integration
**Choice**: Explicit `logActivity()` calls from `src/audit/activity-logger.ts` at the end of every state transition and assignment mutation. No decorators, no wrapping.
**Rationale**: Clarity, no magic. Existing `logActivity()` already handles `ActivityLogInput` with `entityType: "workOrder"`.

### 2.6 API Route Structure
**Choice**: Next.js App Router under `src/app/api/operations/work-orders/[...]`. Route handlers call services, return JSON. Error handling via try/catch with HTTP status codes.
**Rationale**: Standard Next.js conventions.

### 2.7 Scheduling Conflict Detection
**Choice**: `SchedulingService` wraps existing `overlap-detection.ts` helpers (`checkTechnicianConflict`, `hasNoConflicts`) with full business logic (validation, audit, events).
**Rationale**: Existing helper already does the overlap math — service adds orchestration.

### 2.8 Version Field
**Choice**: Add to WorkOrder schema: `version: { type: Number, default: 0 }`. Increment via `$inc: { version: 1 }` on every mutation. Filter always includes version. Conflict → 409.
**Rationale**: Lightweight OCC, no session/transaction overhead.

---

## 3. Data Flow

```
Client → API Route → Service → State Machine Helper → Schema/Model → MongoDB
                              → Audit (activity-logger.ts)
                              → Event (WorkOrderEvent model)
```

### Status transition flow (PATCH /work-orders/:id/status):
```
validateTransition(currentStatus, targetStatus, context)  // state-machine
findOneAndUpdate({ _id, status, version }, { status, $inc: { version: 1 } })
if matchedCount === 0 → 409 Conflict
WorkOrderEvent.create({ workOrderId, from, to, metadata })
logActivity(entityType: "workOrder", action: "status.change", ...)
Return updated WorkOrder
```

---

## 4. Service Signatures

### WorkOrderService
- `create(input, tenantId, userId)` — populates snapshots from CRM refs, generates WO number via counter, sets status=draft
- `findById(id, tenantId)` — returns WO with lean
- `findByTenant(tenantId, filter)` — list with lean
- `update(id, data, version, tenantId, userId)` — OCC update
- `softDelete(id, tenantId, userId)` — guard: only draft/cancelled, no evidence
- `changeStatus(id, targetStatus, context, version, tenantId, userId)` — state machine + OCC + event + audit

### AssignmentService
- `assign(workOrderId, technicianIds, tenantId, userId)` — creates Assignment docs, syncs denormalized, conflicts check
- `reassign(workOrderId, oldTechnicianId, newTechnicianId, tenantId, userId)` — protocol: mark old replaced, create new, sync
- `unassign(workOrderId, technicianId, tenantId, userId)` — decline protocol
- `findByWorkOrder(workOrderId, tenantId)` — history

### SchedulingService
- `checkAndSchedule(workOrderId, slot, technicianIds, tenantId, userId)` — validates no conflicts, updates WO schedule
- `detectConflicts(slot, technicianIds, tenantId, excludeWO?)` — wraps overlap-detection

### ChecklistService
- `create(input, tenantId, userId)` — sets completedBy/completedAt
- `findByWorkOrder(workOrderId, tenantId)` — single checklist per WO (unique constraint)
- `update(id, data, tenantId, userId)` — partial update

### VisitReportService
- `create(input, tenantId, userId)` — sets createdBy/updatedBy
- `findByWorkOrder(workOrderId, tenantId)` — single report per WO
- `update(id, data, tenantId, userId)` — OCC update
- `sign(id, customerName, signature, tenantId, userId)` — future: digital signature capture

---

## 5. Services Barrel

```typescript
// src/operations/services/index.ts
export { WorkOrderService } from './work-order.service';
export { AssignmentService } from './assignment.service';
export { SchedulingService } from './scheduling.service';
export { ChecklistService } from './checklist.service';
export { VisitReportService } from './visit-report.service';
```

Module barrel update (`src/operations/index.ts`):
```typescript
export * from './services';  // add this line
```

---

## 6. File Changes

| File | Action | Description |
|---|---|---|
| `src/operations/schemas/work-order.ts` | Modify | Add `version: { type: Number, default: 0 }` |
| `src/operations/services/work-order.service.ts` | Create | WorkOrder CRUD + state machine + OCC + audit |
| `src/operations/services/assignment.service.ts` | Create | Technician assignment canonical writes |
| `src/operations/services/scheduling.service.ts` | Create | Scheduling with conflict detection |
| `src/operations/services/checklist.service.ts` | Create | Pre-visit checklist + guard support |
| `src/operations/services/visit-report.service.ts` | Create | Visit report + guard support |
| `src/operations/services/index.ts` | Create | Barrel export |
| `src/operations/index.ts` | Modify | Add `export * from './services'` |
| `src/app/api/operations/work-orders/route.ts` | Create | GET list + POST create |
| `src/app/api/operations/work-orders/[id]/route.ts` | Create | GET/UPDATE/DELETE single WO |
| `src/app/api/operations/work-orders/[id]/status/route.ts` | Create | PATCH status transition |
| `src/app/api/operations/work-orders/[id]/assign/route.ts` | Create | POST assign + reassign |
| `src/app/api/operations/work-orders/[id]/checklist/route.ts` | Create | GET/POST checklist |
| `src/app/api/operations/work-orders/[id]/report/route.ts` | Create | GET/POST/PATCH report |
| `tests/operations/work-order.test.ts` | Create | Integration tests |

**Total**: 13 new files, 2 modified.

---

## 7. Testing Strategy

| Scope | Scenarios |
|---|---|
| State machine | All 18 valid transitions (happy paths), invalid transitions to terminal, regression guards |
| Checklist guard | `assigned → en_route` without checklist → TransitionError |
| VisitReport guard | `on_site → completed` without report → TransitionError |
| Scheduling | Overlap with existing WO → conflict error, no overlap → success |
| Assignments | assign technician, reassign protocol (old marked replaced, new created, denormalized synced), unassign |
| OCC | Version mismatch → 409 Conflict, matching version → success |
| Snapshot | Create WO with valid/invalid Client ref → snapshot populated/empty |
| Audit | After transition/assignment → `logActivity` called with correct params |

---

## 8. Open Questions

None — all design decisions confirmed in spec and proposal.

---

## 9. Reused Components

| Component | Location | Usage |
|---|---|---|
| Cursor pagination | `src/crm/helpers/cursor-pagination.ts` | WorkOrderEvent timeline |
| State machine | `src/operations/helpers/state-machine.ts` | Transition validation |
| Overlap detection | `src/operations/helpers/overlap-detection.ts` | Scheduling conflict check |
| Counter | `src/operations/helpers/counter.ts` | Work order number generation |
| ActivityLogger | `src/audit/activity-logger.ts` | Cross-entity audit |
| Audit fields | `src/crm/types/audit-fields.ts` | IAuditFields in WorkOrder, VisitReport |
| Cursor types | `src/crm/types/common.ts` | CursorPage, CursorOptions |
| CRM models | `src/crm/models/` | Snapshot population on create |
| Snapshots | Embedded sub-docs in WorkOrder | Historical evidence |

---

> **End of SDD Design: Fase 3.1 — Services, APIs, OCC & Tests**
>
> Próximo paso: SDD Tasks (sdd-tasks).
