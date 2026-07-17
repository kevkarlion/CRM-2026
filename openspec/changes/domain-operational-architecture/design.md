# Design: Domain Operational Architecture

## Technical Approach

Implement domain-driven architecture for the Operativo domain using existing Next.js patterns. Mobile-first React components with API routes following the established service-layer pattern. Enhance WorkAssignment for audit trail and integrate WorkOrder creation with Commercial's Confirm Sale flow.

## Architecture Decisions

### Decision: WorkAssignment Audit Strategy

**Choice**: Append-only assignment records with replacement chain
**Alternatives considered**: Single record with JSON history, event sourcing
**Rationale**: Maintains query performance, simple joins, follows existing EventModel pattern in codebase

### Decision: Dashboard Data Aggregation

**Choice**: Server-side aggregation pipelines with caching
**Alternatives considered**: Client-side aggregation, separate analytics DB
**Rationale**: Leverages MongoDB aggregation, keeps data consistency, existing dashboard service pattern

### Decision: Mobile-First Component Strategy

**Choice**: Single responsive component set with Tailwind breakpoints
**Alternatives considered**: Separate mobile/desktop codebases, PWA with separate views
**Rationale**: Matches existing component patterns, Tailwind 4 breakpoints already configured

### Decision: Commercial Domain Integration

**Choice**: Event-driven via Confirm Sale hook in quotes convert API
**Alternatives considered**: Direct service call, shared database transaction
**Rationale**: Loose coupling, follows existing event/activity logging pattern

## Data Flow

```
Commercial Domain          Operative Domain
┌─────────────┐           ┌──────────────────┐
│ Quote       │           │ WorkOrder        │
│ accept      │──trigger──│ create           │
└─────────────┘           └────────┬─────────┘
                                   │
                    ┌──────────────┴──────────┐
                    │                         │
              ┌─────▼──────┐           ┌──────▼─────┐
              │ WorkAssign │           │ Dashboard  │
              │ - audit    │           │ - metrics  │
              │ - history  │           │ - agenda   │
              └────────────┘           └────────────┘
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/operations/types/work-order-assignment.ts` | Modify | Add audit fields: previousTechnicianId, type, reason, replacedByAssignmentId |
| `src/operations/schemas/work-order-assignment.ts` | Modify | Add new fields, indexes for replacement chain |
| `src/operations/services/work-assignment.service.ts` | Create | Assignment CRUD with audit logic |
| `src/operations/services/operative-dashboard.service.ts` | Create | Aggregation pipelines for metrics |
| `src/app/api/operations/work-orders/[id]/assignments/route.ts` | Create | Assignment history endpoint |
| `src/app/api/operations/work-orders/[id]/replace/route.ts` | Create | Technician replacement endpoint |
| `src/app/api/operations/dashboard/route.ts` | Create | Operative dashboard metrics endpoint |
| `src/app/api/operations/agenda/route.ts` | Create | Calendar view endpoint |
| `src/app/api/crm/quotes/[id]/convert/hooks/confirm-sale.ts` | Create | Trigger WorkOrder creation on Confirm Sale |
| `src/components/operations/dashboard/metrics-card.tsx` | Create | Mobile-first metric display |
| `src/components/operations/dashboard/technician-list.tsx` | Create | Workload view component |
| `src/components/operations/agenda/calendar-view.tsx` | Create | Calendar/agenda component |
| `src/components/operations/work-order/assignment-history.tsx` | Create | Audit trail display |

## Interfaces / Contracts

```typescript
// New fields in WorkOrderAssignment
interface IWorkOrderAssignment {
  previousTechnicianId: Types.ObjectId | null;
  assignmentType: 'initial' | 'replacement' | 'emergency';
  reason: string;
  replacedByAssignmentId: Types.ObjectId | null;
}

// Dashboard Metrics
interface OperativeMetrics {
  pending: number;
  urgent: number;
  delayed: number;
  unassigned: number;
  inProgress: number;
  pendingReport: number;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | WorkAssignment audit logic, status transitions | Vitest with mocked mongoose |
| Integration | API routes, service methods | @testing-library with test DB |
| E2E | Full flow: Confirm Sale → WorkOrder → Assignment | Not in scope (per proposal) |

## Migration / Rollback

- **Data migration**: Add nullable audit fields to WorkOrderAssignment collection
- **No feature flags**: Direct implementation with proper testing
- **Rollback**: Git revert removes files; database migration drops new indexes only

## Open Questions

- [ ] Should WorkOrder auto-creation on Confirm Sale be configurable per tenant?
- [ ] Do we need real-time updates (WebSocket) for dashboard, or 60-second polling is acceptable?
- [ ] Is supervisor approval workflow for work reports required in V1?