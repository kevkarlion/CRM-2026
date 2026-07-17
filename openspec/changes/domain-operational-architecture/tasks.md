# Tasks: Domain Operational Architecture

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1100 lines |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 |
| Delivery strategy | single-pr |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Backend: Types, Schemas, Services | PR 1 | Base infrastructure — all other work depends on this |
| 2 | Backend: API Routes & Commercial Integration | PR 2 | Depends on PR 1; endpoints and hooks |
| 3 | Frontend: Dashboard & UI Components | PR 3 | Depends on PR 2; mobile-first components |

## Phase 1: Backend Infrastructure (Types, Schemas, Services)

- [ ] 1.1 Update `src/operations/types/work-order-assignment.ts` — add audit fields (previousTechnicianId, assignmentType, reason, replacedByAssignmentId)
- [ ] 1.2 Update `src/operations/schemas/work-order-assignment.ts` — add new fields, indexes for replacement chain
- [ ] 1.3 Create `src/operations/services/work-assignment.service.ts` — assignment CRUD with audit logic
- [ ] 1.4 Create `src/operations/services/operative-dashboard.service.ts` — aggregation pipelines for metrics

## Phase 2: Backend API Routes & Commercial Integration

- [ ] 2.1 Create `src/app/api/operations/work-orders/[id]/assignments/route.ts` — assignment history endpoint
- [ ] 2.2 Create `src/app/api/operations/work-orders/[id]/replace/route.ts` — technician replacement endpoint
- [ ] 2.3 Create `src/app/api/operations/dashboard/route.ts` — operative dashboard metrics endpoint
- [ ] 2.4 Create `src/app/api/operations/agenda/route.ts` — calendar view endpoint
- [ ] 2.5 Create `src/app/api/crm/quotes/[id]/convert/hooks/confirm-sale.ts` — trigger WorkOrder creation on Confirm Sale

## Phase 3: Frontend Dashboard & UI Components

- [ ] 3.1 Create `src/components/operations/dashboard/metrics-card.tsx` — mobile-first metric display
- [ ] 3.2 Create `src/components/operations/dashboard/technician-list.tsx` — workload view component
- [ ] 3.3 Create `src/components/operations/agenda/calendar-view.tsx` — calendar/agenda component
- [ ] 3.4 Create `src/components/operations/work-order/assignment-history.tsx` — audit trail display

## Phase 4: Testing

- [ ] 4.1 Write unit tests for work-assignment.service.ts — audit logic, replacement chain
- [ ] 4.2 Write unit tests for operative-dashboard.service.ts — aggregation pipelines
- [ ] 4.3 Write API integration tests for assignment endpoints
- [ ] 4.4 Verify end-to-end: Confirm Sale → WorkOrder → Assignment → Report flow

## Phase 5: Cleanup

- [ ] 5.1 Add JSDoc comments to new services
- [ ] 5.2 Verify TypeScript compilation: `npx tsc --noEmit`
- [ ] 5.3 Run existing test suite to ensure no regressions