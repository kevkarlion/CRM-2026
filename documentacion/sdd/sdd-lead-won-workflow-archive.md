# SDD Archive: lead-won-workflow

**Archived**: 2026-07-09
**Artifacts**:
- `documentacion/sdd/sdd-lead-won-workflow-proposal.md`
- `documentacion/sdd/sdd-lead-won-workflow-spec.md`
- `documentacion/sdd/sdd-lead-won-workflow-design.md`
- `documentacion/sdd/sdd-lead-won-workflow-tasks.md`

---

## Change Summary

- **Name**: lead-won-workflow
- **Goal**: Fix lead-to-won flow, add WorkOrder creation after sale
- **Files modified**: 4
  - `src/leads/helpers/lead-state-machine.ts`
  - `src/leads/services/lead.service.ts`
  - `src/app/api/crm/leads/[id]/confirm-sale/route.ts`
  - `src/operations/schemas/work-order.ts`
- **New files**: 0

## What was implemented

### A — State machine: `contacted → won`
- Added `'won'` to `VALID_TRANSITIONS.contacted`
- Removed dead `hasClient` validation block for `quote_sent/negotiation → won` in `validateTransition`
- `TERMINAL_STATUSES` and `CONVERTIBLE_STATUSES` unchanged

### B — changeStatus: block `→ won` explicitly
- Early guard: `if (newStatus === 'won')` throws `ValidationError` with message directing to "Confirmar venta"
- Removed dead `hasClient` computation block for `quote_sent/negotiation → won`
- Validation occurs before any database queries

### C1 — Quote filter: `approved` → `sent`
- `QuoteModel.find` filter changed from `status: 'approved'` to `status: 'sent'`

### C2 — Quote status update in transaction
- Added `status: 'approved'` to the `$set` object of `updateMany` inside the transaction

### C3 — Lead status validation before sale
- Added `ALLOWED_FOR_SALE` check after fetching lead, before starting transaction
- Allowed statuses: `contacted`, `technical_visit`, `quote_sent`, `negotiation`
- Returns 400 for invalid states

### D — WorkOrder creation after won
- Created WorkOrder inside the confirm-sale transaction via `WorkOrderModel.create([...], { session })`
- Made `locationId` and `locationSnapshot` optional in WorkOrder schema
- WorkOrder created with `status: 'draft'`, `source: 'manual'`
- `clientSnapshot` populated from lead data

## Verification Results

| Area | Result |
|------|--------|
| Requirements | 27/27 PASS (FR-A01 through FR-D14) |
| Compilation | PASS (only pre-existing unrelated issue) |
| Unit tests | PASS |
| Integration tests | PASS |

## State after change

- `contacted` leads can transition to `won` (state machine)
- `changeStatus` rejects `→ won` with clear message directing to "Confirmar venta"
- confirm-sale route: finds `sent` quotes, marks them `approved`, validates lead status
- WorkOrder created in same transaction when confirming sale (atomic with lead update)
- WorkOrder schema: `locationId` and `locationSnapshot` optional
- Dead `hasClient` code removed from both `lead-state-machine.ts` and `lead.service.ts`

## Key Decisions

1. **`won` stays terminal** for lead lifecycle — WorkOrder is a side-effect, not a lifecycle extension
2. **`contacted` NOT added to `CONVERTIBLE_STATUSES`** — conversion to client happens via confirm-sale
3. **`locationId`/`locationSnapshot` made optional** — not defaulted; allows leads without addresses
4. **WorkOrder inside confirm-sale transaction** — atomicity prevents orphan data on failure
5. **Dead `hasClient` code removed** — unreachable after B guard, removed from both files

## SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived.
