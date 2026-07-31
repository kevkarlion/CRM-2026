# Design: Flujo de Ejecución del Técnico

## Technical Approach

Implement a mobile-first work execution flow where technicians can start and complete WorkOrders (OT) and Technical Visits (VT) via simplified actions. The solution adds a new `WorkReport` entity to store completion data, extends the WorkOrder/TechnicalVisit models with execution timestamps, and exposes REST endpoints for the start/complete workflow.

## Architecture Decisions

### Decision: WorkReport Entity Location

**Choice**: Create as new model in `src/operations/models/work-report.ts`
**Alternatives considered**: Extend existing VisitReport | Use generic attachment table
**Rationale**: VisitReport is tied to a different workflow (commercial visits). WorkReport needs distinct fields for technician execution (result, workPerformed, additionalIssues). New model provides clean separation and matches the spec requirements.

### Decision: API Route Structure

**Choice**: Nested routes under work-orders/{id}/start, work-orders/{id}/complete
**Alternatives considered**: POST /api/operations/work-execution | Query parameters
**Rationale**: Follows existing project conventions (see work-orders/[id]/status, work-orders/[id]/assign). RESTful and intuitive for mobile consumption.

### Decision: Technician Availability Rollback

**Choice**: Revert technician.availability to 'available' if WorkReport save fails
**Alternatives considered**: Keep technician busy | Use distributed locks
**Rationale**: Simple failure recovery that matches spec. No distributed locking needed since single-session atomic update.

### Decision: Component Architecture

**Choice**: Separate mobile-optimized form component with conditional logic
**Alternatives considered**: Reuse existing VisitReportForm | Single large form
**Rationale**: WorkReport fields differ significantly (multi-select workPerformed, conditional additionalIssues). Mobile form needs large touch targets, minimal typing. Reusing core UI components ensures consistency.

## Data Flow

```
┌─────────────┐     POST /start      ┌─────────────┐
│ Mobile App  │ ──────────────────▶  │  WorkOrder  │
└─────────────┘                      │  API Route  │
                                     └─────────────┘
                                            │
                                            ▼
┌─────────────┐     POST /complete    ┌─────────────┐
│ Mobile App  │ ──────────────────▶  │  WorkReport │
│   (form)    │                      │  API Route  │
└─────────────┘                      └─────────────┘
                                            │
                                            ▼
                                     ┌─────────────┐
                                     │ WorkOrder   │
                                     │ + workReportId
                                     │ + finishedAt
                                     └─────────────┘
                                            │
                                            ▼
                                     ┌─────────────┐
                                     │ Technician  │
                                     │ availability │
                                     │ → 'available'│
                                     └─────────────┘
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/operations/models/work-report.ts` | Create | Mongoose model for WorkReport entity |
| `src/operations/types/work-report.ts` | Create | TypeScript interface and input types |
| `src/operations/schemas/work-report.ts` | Create | Mongoose schema with validations |
| `src/operations/services/work-report.service.ts` | Create | Business logic for WorkReport CRUD |
| `src/operations/models/index.ts` | Modify | Export new WorkReportModel |
| `src/operations/types/work-order.ts` | Modify | Add startedAt, startedBy, finishedAt, workReportId |
| `src/operations/schemas/work-order.ts` | Modify | Add new fields to schema |
| `src/operations/types/technical-visit.ts` | Modify | Add startedAt, startedBy, finishedAt, workReportId |
| `src/operations/schemas/technical-visit.ts` | Modify | Add new fields to schema |
| `src/app/api/operations/work-orders/[id]/start/route.ts` | Create | Start work execution endpoint |
| `src/app/api/operations/work-orders/[id]/complete/route.ts` | Create | Complete work with WorkReport |
| `src/app/api/operations/work-orders/[id]/work-report/route.ts` | Create | Get WorkReport by WorkOrder |
| `src/app/api/operations/technical-visits/[id]/start/route.ts` | Create | Start work on VT |
| `src/app/api/operations/technical-visits/[id]/complete/route.ts` | Create | Complete work on VT |
| `src/app/api/operations/technical-visits/[id]/work-report/route.ts` | Create | Get WorkReport by VT |
| `src/operations/components/mobile/WorkCompletionForm.tsx` | Create | Mobile-optimized completion form |
| `src/operations/components/mobile/WorkExecutionActions.tsx` | Create | Start/Complete action buttons |
| `src/core/models/activity-log.ts` | Modify | Add activity types for work_started, work_completed, work_report_created |

## Interfaces / Contracts

### WorkReport Type

```typescript
interface IWorkReport extends Document, IAuditFields {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  workOrderId: Types.ObjectId;
  technicalVisitId?: Types.ObjectId;
  technicianId: Types.ObjectId;
  result: 'completado' | 'parcial' | 'pendiente_materiales' | 'no_se_pudo_completar' | 'cancelado' | 'requiere_seguimiento';
  workPerformed?: string[];
  workPerformedOther?: string;
  hasObservations?: boolean;
  observationsText?: string;
  hasAdditionalIssues?: boolean;
  additionalIssues?: string[];
  additionalIssuesText?: string;
  nextVisitRecommendation?: 'no_se_requiere' | 'rutinario' | 'urgente' | 'pendiente_aprobacion' | 'garantia' | 'verificacion';
  startedAt: Date;
  finishedAt: Date;
  version: number;
}
```

### WorkOrder Extended Fields

```typescript
interface IWorkOrder {
  // ... existing fields
  startedAt?: Date;
  startedBy?: Types.ObjectId;
  finishedAt?: Date;
  workReportId?: Types.ObjectId;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | WorkReport validation, service methods | Jest with mocked mongoose |
| Integration | Start/Complete API endpoints, status transitions | Integration tests with test DB |
| E2E | Full technician flow: assign → start → complete | Playwright mobile viewport |
| Manual | Mobile form UX, offline handling | Device testing |

Key test scenarios:
- Start work changes status to in_progress and technician.availability to busy
- Complete without result returns 400
- Complete with result changes status to completed, saves WorkReport, sets technician available
- Save failure rolls back technician availability
- Non-assigned technician cannot start/complete (403)

## Migration / Rollback

No database migration required for WorkReport (new collection). WorkOrder/TechnicalVisit schema modifications add nullable fields:
- `startedAt`, `startedBy`, `finishedAt` (Date, optional)
- `workReportId` (ObjectId, optional)

These additions are backward-compatible. No data migration needed.

**Rollback Plan**: 
1. Revert API routes
2. Remove WorkReport model files
3. Schema fields remain but unused (harmless)

## Open Questions

- [ ] Should work execution be allowed to "pause" (status paused) mid-work? Spec uses simplified flow only.
- [ ] Are photos/attachments required in WorkReport? Not in current spec.
- [ ] Retry logic for failed saves: spec says rollback, but should we retry once?