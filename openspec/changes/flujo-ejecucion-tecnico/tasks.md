# Tasks: Flujo de Ejecución del Técnico

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 800-1200 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Foundation) → PR 2 (API + Service) → PR 3 (UI) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Database schema + Types + Service layer | PR 1 | Base for everything; includes WorkReport model, types, schemas, service. No API/UI yet. |
| 2 | API endpoints + Activity logging | PR 2 | Start/Complete for WO and VT; activity events; builds on PR 1 |
| 3 | UI Components + Integration | PR 3 | Mobile form, action buttons in WO detail; depends on PR 2 |

---

## Phase 1: Foundation (Database + Types + Service)

- [x] 1.1 Create `src/operations/schemas/work-report.ts` — Mongoose schema with all fields (result enum, workPerformed[], hasObservations, observationsText, hasAdditionalIssues, additionalIssues[], nextVisitRecommendation, startedAt, finishedAt, version)
- [x] 1.2 Create `src/operations/types/work-report.ts` — TypeScript interfaces (IWorkReport, WorkReportInput, WorkReportResponse) with all type exports
- [x] 1.3 Create `src/operations/models/work-report.ts` — Mongoose model using the schema
- [x] 1.4 Update `src/operations/models/index.ts` — Export WorkReportModel
- [x] 1.5 Modify `src/operations/schemas/work-order.ts` — Add nullable fields: startedAt (Date), startedBy (ObjectId), finishedAt (Date), workReportId (ObjectId)
- [x] 1.6 Modify `src/operations/types/work-order.ts` — Add same fields to IWorkOrder interface
- [x] 1.7 Modify `src/operations/schemas/technical-visit.ts` — Add startedAt, startedBy, finishedAt, workReportId fields
- [x] 1.8 Modify `src/operations/types/technical-visit.ts` — Add same fields to ITechnicalVisit interface
- [x] 1.9 Create `src/operations/services/work-report.service.ts` — Service with createWorkReport, getByWorkOrderId, getByTechnicalVisitId, validateWorkReportInput methods

---

## Phase 2: API Endpoints

- [x] 2.1 Create `src/app/api/operations/work-orders/[id]/start/route.ts` — POST endpoint: validate assigned technician, change status to in_progress, set startedAt/startedBy, set technician.availability='busy', log activity 'work_started'
- [x] 2.2 Create `src/app/api/operations/work-orders/[id]/complete/route.ts` — POST endpoint: validate in_progress status, validate result required, create WorkReport, set status='completed', set finishedAt/workReportId, set technician.availability='available', wrap in try-catch with rollback on failure, log 'work_completed' and 'work_report_created'
- [x] 2.3 Create `src/app/api/operations/work-orders/[id]/work-report/route.ts` — GET endpoint: return WorkReport by workOrderId
- [x] 2.4 Create `src/app/api/operations/technical-visits/[id]/start/route.ts` — Same as work-orders start, for TechnicalVisit
- [x] 2.5 Create `src/app/api/operations/technical-visits/[id]/complete/route.ts` — Same as work-orders complete, for TechnicalVisit
- [x] 2.6 Create `src/app/api/operations/technical-visits/[id]/work-report/route.ts` — GET endpoint: return WorkReport by technicalVisitId
- [x] 2.7 Modify `src/core/models/activity-log.ts` — Add activity types: work_started, work_completed, work_report_created

---

## Phase 3: UI Components

- [ ] 3.1 Create `src/operations/components/mobile/WorkCompletionForm.tsx` — Mobile-optimized form with: result dropdown (required), workPerformed multi-select checkboxes (11 options), hasObservations toggle + observationsText textarea (conditional), hasAdditionalIssues toggle + additionalIssues multi-select (conditional), nextVisitRecommendation dropdown. Use large touch targets, minimal typing
- [ ] 3.2 Create `src/operations/components/mobile/WorkExecutionActions.tsx` — Component with "Iniciar trabajo" button (shows when status='assigned' and user is technician) and "Finalizar servicio" button (shows when status='in_progress')
- [ ] 3.3 Locate WorkOrder detail page component (likely in `src/operations/components/` or `src/app/operations/work-orders/[id]/`) and integrate WorkExecutionActions
- [ ] 3.4 For "Finalizar servicio" button, open modal/drawer with WorkCompletionForm. On submit, call POST /complete endpoint and handle success/error
- [ ] 3.5 For "Iniciar trabajo" button, call POST /start endpoint on click, handle success/error

---

## Phase 4: Testing

- [ ] 4.1 Write unit tests for WorkReport schema validation (required fields, enum values)
- [ ] 4.2 Write unit tests for work-report.service.ts methods (create, getByWorkOrderId)
- [ ] 4.3 Write integration tests for POST /work-orders/{id}/start endpoint (success, non-assigned technician, wrong status)
- [ ] 4.4 Write integration tests for POST /work-orders/{id}/complete endpoint (success, missing result, save failure rollback)
- [ ] 4.5 Write integration tests for GET /work-orders/{id}/work-report endpoint
- [ ] 4.6 Write integration tests for technical-visits endpoints
- [ ] 4.7 Test UI components: form validation, button visibility based on status, modal open/close

---

## Implementation Order

1. **PR 1 (Foundation)**: Tasks 1.1–1.9 — Schema, types, service layer. This is the foundation everything else builds on.
2. **PR 2 (API)**: Tasks 2.1–2.7 — All REST endpoints and activity logging. Builds on PR 1 model/service.
3. **PR 3 (UI)**: Tasks 3.1–3.5 — Mobile form and detail page buttons. Builds on PR 2 endpoints.
4. **Test parallel**: Tasks 4.1–4.7 can run alongside PR 2-3 implementation.

### Why stacked-to-main?
- PR 1 is pure foundation with no risk of breaking existing functionality
- Each subsequent PR is smaller and focused, keeping diffs reviewable
- If UI is delayed, API still works for mobile integration later