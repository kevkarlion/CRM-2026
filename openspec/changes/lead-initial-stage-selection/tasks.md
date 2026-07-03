# Tasks: lead-initial-stage-selection

> Estimated: ~485 lines total across 2 chained PRs

## T1 — Data model + types
- [x] Add `LostReason` type (enum: not_interested, no_budget, wrong_timing, competitor, uncontactable, other)
- [x] Extend `LeadStatus` with `quote_sent`, `technical_visit`
- [x] Add `status`, `lostReason`, `lostDescription`, `qualificationStatus` to `ILead` and `CreateLeadInput`
- [x] Add `qualificationStatus`, `lostReason`, `lostDescription` to Mongoose schema
- [x] Add empty transition arrays for `quote_sent`/`technical_visit` in state machine

## T2 — Service layer
- [x] Add `nextAction` field to `CreateLeadResult`
- [x] Revise `createLead()` to accept `status` (default `'new'`)
- [x] Status branching: `won` → auto-create client+contact in transaction
- [x] Status branching: `lost` → store loss metadata + set `not_qualified`
- [x] Status branching: `quote_sent`/`technical_visit` → auto-qualify + set `nextAction`
- [x] `lostReason` required validation when `status='lost'`
- [x] Duplicate detection still runs before status branching
- [x] Extract `createClientFromLead()` helper; add `createClientFromLeadAndMarkWon()`

## T3 — API route
- [x] POST returns `{ lead, warnings, nextAction }` with 201
- [x] Handle `ConflictError` → 409, `ValidationError` → 400

## T4 — UI page
- [x] Stage selector (6 options) on creation form
- [x] Conditional lost fields (`lostReason` selector, `lostDescription` textarea)
- [x] `lost` path makes `companyName`/`email` optional
- [x] Dispatch `CreateQuoteModal` when `nextAction=create_quote`
- [x] Dispatch `ScheduleVisitModal` when `nextAction=schedule_visit`
- [x] Redirect when no `nextAction`

## T5 — Tests
- [x] Default `status='new'` when omitted
- [x] Create with `status='won'` → client+contact created
- [x] Create with `status='lost'` + valid `lostReason`
- [x] Create with `status='lost'` → ValidationError if `lostReason` missing
- [x] Create with `status='lost'` → ValidationError if invalid `lostReason`
- [x] Create with `status='quote_sent'` → returns `nextAction=create_quote`
- [x] Create with `status='technical_visit'` → returns `nextAction=schedule_visit`
- [x] Duplicate detection for all statuses
- [x] All 32 tests pass (9 new + 23 existing)
