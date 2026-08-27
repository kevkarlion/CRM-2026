# Tasks: Follow-up Marking System

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~715 lines |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (DB Layer) → PR 2 (Service) → PR 3 (API) → PR 4 (UI + Page) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Database layer (schema + model) | PR 1 | Base: main; includes schema, model, index export |
| 2 | Service layer | PR 2 | Base: PR 1; CRUD methods, tenant isolation |
| 3 | API routes | PR 3 | Base: PR 2; POST/GET/DELETE endpoints |
| 4 | UI integration | PR 4 | Base: PR 3; cards, modal, hook, attention page |

## Phase 1: Database Layer

- [ ] 1.1 Create `src/crm/schemas/follow-up-mark.ts` with Mongoose schema (tenantId, targetType, targetId, assignedTo, markedBy, note, markedAt)
- [ ] 1.2 Create `src/crm/models/follow-up-mark.ts` with Mongoose model and compound unique index [tenantId, targetType, targetId]
- [ ] 1.3 Modify `src/crm/models/index.ts` to export FollowUpMarkModel

## Phase 2: Service Layer

- [ ] 2.1 Create `src/crm/services/follow-up-mark.service.ts` with CRUD: create, findById, findByTarget, findByUser, delete, isMarked
- [ ] 2.2 Add tenant isolation to all service methods

## Phase 3: API Routes

- [ ] 3.1 Create `src/app/api/follow-up-marks/route.ts` with POST (create) and GET (list) endpoints
- [ ] 3.2 Create `src/app/api/follow-up-marks/[id]/route.ts` with DELETE endpoint
- [ ] 3.3 Implement x-tenant-id header validation for all endpoints

## Phase 4: UI Integration

- [ ] 4.1 Modify `src/leads/pipeline-board/components/LeadCard.tsx` to add followUpMark prop and yellow indicator
- [ ] 4.2 Modify `src/leads/pipeline-board/components/ClientCard.tsx` to add followUpMark prop and yellow indicator
- [ ] 4.3 Create `src/leads/pipeline-board/components/MarkForFollowUpModal.tsx` with user dropdown
- [ ] 4.4 Create `src/leads/pipeline-board/hooks/useFollowUpMarks.ts` hook for fetching marks

## Phase 5: Attention Page

- [ ] 5.1 Create `src/app/(dashboard)/atencion/page.tsx` listing user's marked leads/clients

## Phase 6: Testing

- [ ] 6.1 Write unit tests for FollowUpMarkService CRUD methods
- [ ] 6.2 Test API endpoints with tenant isolation verification
- [ ] 6.3 Verify indicator displays correctly on LeadCard/ClientCard
