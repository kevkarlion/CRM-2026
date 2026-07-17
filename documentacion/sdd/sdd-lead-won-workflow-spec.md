# SDD Specification: lead-won-workflow

## Change Areas Overview

| ID | Area | Type |
|----|------|------|
| A | State machine: `contacted → won` | Modification |
| B | `changeStatus` block `→ won` | Modification |
| C1 | Quote filter: `approved` → `sent` | Bugfix |
| C2 | Quote status update in transaction | Bugfix |
| C3 | Lead status validation before sale | Addition |
| D | Work Order creation after WON | Addition |

## Requirements

### A. State Machine — Add `contacted → won`

**FR-A01**: `VALID_TRANSITIONS.contacted` MUST include `'won'`.

**FR-A02**: `TERMINAL_STATUSES` MUST remain unchanged (`won`, `lost`, `disqualified`). `won` is terminal for the lead lifecycle even though a WorkOrder is created as a side-effect.

**FR-A03**: `CONVERTIBLE_STATUSES` MUST remain unchanged (`technical_visit`, `quote_sent`, `negotiation`). `contacted` MUST NOT be added — conversion to client happens via confirm-sale, not direct status change.

**FR-A04**: The `hasClient` validation block for `→ won` transitions in `validateTransition` (lead-state-machine.ts:52-54) MUST be removed as dead code. The `changeStatus` method (requirement B) now blocks all `→ won` transitions before reaching `validateTransition`, making these lines unreachable.

**FR-A05**: The `hasClient` computation block for `→ won` in `changeStatus` (lead.service.ts:443-445) MUST be removed as dead code — same reason as FR-A04.

#### Scenario A1: contacted → won becomes valid

- GIVEN the `VALID_TRANSITIONS` map
- WHEN `canTransition('contacted', 'won')` is called
- THEN it MUST return `true`

#### Scenario A2: Existing transitions preserved

- GIVEN the `VALID_TRANSITIONS` map
- WHEN transitions from `contacted` to `quote_sent`, `technical_visit`, or `lost` are checked
- THEN they MUST all remain valid

#### Scenario A3: Terminal statuses unchanged

- GIVEN `TERMINAL_STATUSES`
- WHEN inspected
- THEN `won`, `lost`, and `disqualified` MUST be present with no additions or removals

#### Scenario A4: Convertible statuses unchanged

- GIVEN `CONVERTIBLE_STATUSES`
- WHEN inspected
- THEN it MUST contain exactly `technical_visit`, `quote_sent`, `negotiation`
- AND `contacted` MUST NOT be present

#### Scenario A5: Dead hasClient code removed

- GIVEN the source files after changes
- WHEN searching for `hasClient` references related to `won` transitions
- THEN there MUST be no `hasClient` check in `validateTransition` for `won` transitions
- AND there MUST be no `hasClient` computation in `changeStatus` for `newStatus === 'won'`

### B. changeStatus — Block `→ won` Explicitly

**FR-B01**: `changeStatus` MUST throw `ValidationError` when `newStatus === 'won'`.

**FR-B02**: The validation MUST occur at the method entry, before any database queries (activity/required-fields/client lookups) or transition validation.

**FR-B03**: The error message MUST be: `'Use "Confirmar venta" o "Convertir a cliente" para marcar el lead como ganado'`.

#### Scenario B1: Early rejection on won

- GIVEN a lead with status `quote_sent`
- WHEN `changeStatus(leadId, 'won', userId, tenantId)` is called
- THEN a `ValidationError` MUST be thrown
- AND no `ActivityModel.exists`, `ClientModel` check, or `validateTransition` call MUST execute

#### Scenario B2: All other transitions unaffected

- GIVEN a lead with status `new`
- WHEN `changeStatus(leadId, 'contacted', userId, tenantId)` is called
- THEN the method MUST execute normally without throwing the `won` guard

### C1. Quote Filter — `approved` → `sent`

**FR-C01**: The `QuoteModel.find` query in `confirm-sale/route.ts` MUST filter by `status: 'sent'` instead of `status: 'approved'`.

#### Scenario C1: sent quotes are found

- GIVEN 3 quotes for a lead: 1 with `status: 'sent'`, 2 with `status: 'approved'`
- WHEN confirm-sale executes with `saleMode: 'quotes'` and only the `sent` quote's ID
- THEN the query MUST return exactly 1 quote (the `sent` one)
- AND the route MUST proceed successfully

### C2. Quote Status Update in Transaction

**FR-C02**: The `updateMany` inside the transaction MUST include `status: 'approved'` in the `$set` object, alongside `approvedAt` and `updatedBy`.

#### Scenario C2: Quotes set to approved

- GIVEN quote IDs passed to confirm-sale
- AFTER the transaction commits
- WHEN each quote is read from the database
- THEN `status` MUST be `'approved'`
- AND `approvedAt` MUST be set to a valid timestamp

### C3. Lead Status Validation Before Sale

**FR-C03**: The route MUST validate `lead.status` is in the allowed set: `['contacted', 'technical_visit', 'quote_sent', 'negotiation']`.

**FR-C04**: If validation fails, the route MUST return `400` with message: `"Lead en estado '{status}' no puede confirmar venta. Estados permitidos: contactado, visita técnica, presupuesto enviado, negociación"`.

**FR-C05**: Validation MUST occur after fetching the lead and before starting the MongoDB transaction.

#### Scenario C3a: Allowed status proceeds

- GIVEN a lead with status `contacted`
- WHEN POST `/api/crm/leads/{id}/confirm-sale` is sent
- THEN the route MUST pass validation and continue

#### Scenario C3b: New status rejected

- GIVEN a lead with status `new`
- WHEN POST `/api/crm/leads/{id}/confirm-sale` is sent
- THEN the route MUST return `400`

#### Scenario C3c: Already won rejected

- GIVEN a lead with status `won`
- WHEN POST `/api/crm/leads/{id}/confirm-sale` is sent
- THEN the route MUST return `400`

#### Scenario C3d: Lost/disqualified rejected

- GIVEN a lead with status `lost`
- WHEN POST `/api/crm/leads/{id}/confirm-sale` is sent
- THEN the route MUST return `400`

### D. Work Order Creation After WON

**FR-D01**: After marking the lead as `won` and before `commitTransaction`, the route MUST create a `WorkOrder` document using `WorkOrderModel.create([...], { session })`.

**FR-D02**: `WorkOrderSchema.locationId` SHALL change from `required: true` to `required: false` in `work-order.ts`.

**FR-D03**: `WorkOrderSchema.locationSnapshot` SHALL change from `required: true` to `required: false`.

**FR-D04**: WorkOrder MUST be created with `status: 'draft'`.

**FR-D05**: `workOrderNumber` MUST be generated via `getNextWorkOrderNumber(tenantId)` imported from `@/operations/helpers/counter`.

**FR-D06**: `source` MUST be `'manual'`.

**FR-D07**: `clientSnapshot` MUST be populated from lead data: `name`, `email`, `phone`, `customerType`, `status: 'active'`.

**FR-D08**: `leadId` MUST reference `lead._id`.

**FR-D09**: `priority` SHALL default to `'normal'`.

**FR-D10**: `category` SHALL default to `'installation'` (new sales imply installation work).

**FR-D11**: `title` MUST be `` `Venta: ${lead.companyName || lead.name}` ``.

**FR-D12**: `description` SHOULD use `notes` from the request body if present, otherwise `` `Venta generada desde lead #${lead._id}` ``.

**FR-D13**: Existing fields (`locationId`, `locationSnapshot`, `equipmentSnapshot`, `contractSnapshot`, `assignedTechnicians`, `quoteId`, `equipmentId`) MUST accept null/default values when not provided.

**FR-D14**: The existing MongoDB session (`require('mongoose').startSession()`) pattern MUST be preserved — WorkOrder creation runs inside the same session as client creation and lead update.

#### Scenario D1: WorkOrder created in same transaction

- GIVEN a successful confirm-sale transaction
- AFTER `commitTransaction`
- WHEN querying WorkOrders by `leadId`
- THEN exactly 1 WorkOrder MUST exist
- AND `status` MUST be `'draft'`
- AND `clientId` MUST match the newly created client
- AND `leadId` MUST match the original lead
- AND `workOrderNumber` MUST match the `getNextWorkOrderNumber` format

#### Scenario D2: Rollback on WorkOrder failure

- GIVEN a confirm-sale transaction in progress
- AND the WorkOrder `create` call throws (e.g., MongoDB validation error)
- WHEN the error propagates
- THEN `abortTransaction` MUST be called
- AND the lead MUST NOT have status `won`
- AND no orphan client MUST exist

#### Scenario D3: WorkOrder without location

- GIVEN a lead with no location data
- WHEN confirm-sale creates the WorkOrder
- THEN `locationId` MUST be `null`
- AND `locationSnapshot` MUST be `{}`

#### Scenario D4: Duplicate work order number prevented

- GIVEN `getNextWorkOrderNumber` returns a unique number per tenant-date-sequence
- WHEN two WorkOrders are created in the same tenant on the same day
- THEN both MUST have different `workOrderNumber` values

#### Scenario D5: WorkOrder runs before CommercialProcessService

- GIVEN the transaction block in confirm-sale
- WHEN the code executes
- THEN WorkOrder creation MUST occur before `commitTransaction`
- AND `CommercialProcessService.onConfirmSale` MUST run AFTER `commitTransaction`

## Data Contracts

### Modified: WorkOrder Schema

| Field | Current | New |
|-------|---------|-----|
| `locationId.required` | `true` | `false` |
| `locationSnapshot.required` | `true` | `false` |

### New Imports in confirm-sale/route.ts

```typescript
import WorkOrderModel from '@/operations/models/work-order';
import { getNextWorkOrderNumber } from '@/operations/helpers/counter';
import type { LeadStatus } from '@/leads/constants/lead-status.constants';
```

## Dead Code Removed

| File | Lines | Code | Reason |
|------|-------|------|--------|
| `lead.service.ts` | 443-445 | `hasClient` computation for `quote_sent/negotiation → won` | Unreachable after FR-B01 |
| `lead-state-machine.ts` | 52-54 | `hasClient` validation for `quote_sent/negotiation → won` | Unreachable after FR-B01 |
