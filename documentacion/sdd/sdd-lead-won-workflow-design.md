# Design: lead-won-workflow

## Architecture Overview

Four change areas (A-D) modify 3 files and touch 1 schema. All changes are backwards-compatible — no migrations required.

| Area | Type | File | Summary |
|------|------|------|---------|
| A | Modification | `lead-state-machine.ts` | Add `contacted → won` transition, remove dead `hasClient` block |
| B | Modification | `lead.service.ts` | Early guard blocks `changeStatus(→ won)` with clear message |
| C1-C3 | Bugfix/Addition | `confirm-sale/route.ts` | Fix quote filter, add status update, add lead status validation |
| D | Addition | `confirm-sale/route.ts` + `work-order.ts` schema | Create WorkOrder inside confirm-sale transaction |

### Interaction Model

Areas A and B decouple: A makes `contacted → won` valid in the state machine, while B blocks all `→ won` via `changeStatus` so it can only happen through confirm-sale or convertToClient. C fixes the confirm-sale route bugs. D adds WorkOrder creation inside the same transaction.

```
confirm-sale/route.ts
  ├─ C3: validate lead.status ∈ ALLOWED_FOR_SALE  (before tx)
  ├─ C1: find quotes where status='sent'           (before tx)
  ├─ session.startTransaction()
  │   ├─ C2: updateMany quotes → status='approved'
  │   ├─ create Client (existing)
  │   ├─ update lead → status='won'                (existing)
  │   └─ D:  create WorkOrder                       (NEW)
  ├─ commitTransaction()
  └─ CommercialProcessService.onConfirmSale()      (existing)
```

### New Imports in confirm-sale/route.ts

```typescript
import WorkOrderModel from '@/operations/models/work-order';
import { getNextWorkOrderNumber } from '@/operations/helpers/counter';
import type { LeadStatus } from '@/leads/constants/lead-status.constants';
```

## Detailed Design per Change Area

### A. State Machine — `src/leads/helpers/lead-state-machine.ts`

**Edit 1** (line 5): Add `'won'` to `contacted` transitions.

```diff
-  contacted: ['quote_sent', 'technical_visit', 'lost'],
+  contacted: ['quote_sent', 'technical_visit', 'won', 'lost'],
```

**Edit 2** (lines 52-54): Remove dead `hasClient` validation block.

```diff
-  if ((from === 'quote_sent' && to === 'won' || from === 'negotiation' && to === 'won') && context && !context.hasClient) {
-    throw new TransitionError(from, to, 'Cannot mark as won without converting to Client first');
-  }
```

`TERMINAL_STATUSES` and `CONVERTIBLE_STATUSES` remain unchanged (spec FR-A02, FR-A03).

### B. changeStatus Guard — `src/leads/services/lead.service.ts`

**Edit 1**: Add early guard at top of `changeStatus` method (after lead fetch, line ~421).

```typescript
if (newStatus === 'won') {
  throw new ValidationError(
    'Use "Confirmar venta" o "Convertir a cliente" para marcar el lead como ganado'
  );
}
```

This fires BEFORE any DB queries (ActivityModel, ClientModel, validateTransition) — per spec FR-B02.

**Edit 2** (lines 443-445): Remove dead `hasClient` computation.

```diff
-    if ((currentStatus === 'quote_sent' && newStatus === 'won') || (currentStatus === 'negotiation' && newStatus === 'won')) {
-      hasClient = !!lead.convertedToClient;
-    }
```

The `hasClient` variable declaration (line 425) can remain — it's still part of the object passed to `validateTransition`, just always `undefined` now.

### C. confirm-sale Route Fixes — `src/app/api/crm/leads/[id]/confirm-sale/route.ts`

**C1** (line 68): Fix quote filter.

```diff
-        status: 'approved',
+        status: 'sent',
```

**C2** (lines 94-98): Add `status: 'approved'` to `$set`.

```diff
             $set: {
+              status: 'approved',
               approvedAt: new Date(),
               updatedBy: new Types.ObjectId(userId),
             },
```

**C3** (after line 56): Add allowed status validation.

```typescript
const ALLOWED_FOR_SALE: LeadStatus[] = ['contacted', 'technical_visit', 'quote_sent', 'negotiation'];
if (!ALLOWED_FOR_SALE.includes(lead.status as LeadStatus)) {
  return NextResponse.json(
    { error: `Lead en estado '${lead.status}' no puede confirmar venta. Estados permitidos: contactado, visita técnica, presupuesto enviado, negociación` },
    { status: 400 },
  );
}
```

Runs AFTER lead fetch (confirms existence) and BEFORE `session.startTransaction()` (no rollback needed).

### D. WorkOrder Creation — `confirm-sale/route.ts` + schema

**Schema changes** — `src/operations/schemas/work-order.ts`:

```diff
-  locationId: { type: Schema.Types.ObjectId, ref: 'Location', required: true },
+  locationId: { type: Schema.Types.ObjectId, ref: 'Location', required: false },
...
-  locationSnapshot: { type: locationSnapshotSchema, required: true },
+  locationSnapshot: { type: locationSnapshotSchema, required: false },
```

**WorkOrder creation** — inside the transaction, AFTER lead status update (line 167), BEFORE `commitTransaction` (line 169):

```typescript
const workOrderNumber = await getNextWorkOrderNumber(tenantId);
await WorkOrderModel.create([{
  tenantId: new Types.ObjectId(tenantId),
  clientId,
  locationId: null,
  leadId: lead._id,
  clientSnapshot: {
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    customerType: resolvedCustomerType,
    status: 'active',
  },
  locationSnapshot: {},
  source: 'manual',
  workOrderNumber,
  title: `Venta: ${lead.companyName || lead.name}`,
  description: notes || `Venta generada desde lead #${lead._id}`,
  priority: 'normal',
  category: 'installation',
  status: 'draft',
  createdBy: new Types.ObjectId(userId),
  updatedBy: new Types.ObjectId(userId),
}], { session });
```

## Transaction Flow (Sequence)

```
1.  Validate input (saleMode, quoteIds/directSale)
2.  Fetch lead, validate existence
3.  [NEW] Validate lead.status ∈ ALLOWED_FOR_SALE → 400 if not
4.  Find quotes where status='sent' (C1 fix)
5.  session.startTransaction()
6.  Quote updateMany: set status='approved', approvedAt, updatedBy (C2 fix)
7.  Create client from lead if !lead.convertedToClient
8.  Update lead: status=won, convertedToClient, convertedAt, updatedBy
9.  [NEW] getNextWorkOrderNumber → WorkOrderModel.create({ ... }, { session })
10. commitTransaction()
11. CommercialProcessService.onConfirmSale (post-commit)
```

## Error Handling & Rollback

| Failure Point | Behavior | Rollback? |
|---------------|----------|-----------|
| Lead status not in ALLOWED_FOR_SALE | 400 response before tx | No (no tx started) |
| Quote not found (sent filter) | 400 response before tx | No |
| Quote update fails | abortTransaction in catch | Yes (all rolled back) |
| Client creation fails | abortTransaction in catch | Yes |
| Lead update fails | abortTransaction in catch | Yes |
| WorkOrder creation fails | abortTransaction in catch | Yes (same try/catch) |

All transaction failures are already handled by the existing `try/catch → abortTransaction` block. WorkOrder creation simply runs inside it — no new error handling needed.

## Data Model Changes

### WorkOrder Schema

```json
{
  "locationId": {
    "type": "ObjectId",
    "ref": "Location",
-   "required": true
+   "required": false
  },
  "locationSnapshot": {
    "type": "LocationSnapshotSchema",
-   "required": true
+   "required": false
  }
}
```

All other WorkOrder fields unchanged. Existing documents are unaffected — `locationId` and `locationSnapshot` are already present on all current records.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| **Unit** | State machine: `canTransition('contacted', 'won')` returns true; existing transitions preserved; `TERMINAL_STATUSES`/`CONVERTIBLE_STATUSES` unchanged | Direct function calls, no DB |
| **Unit** | changeStatus: `changeStatus(leadId, 'won', ...)` throws `ValidationError` with exact message; non-`won` transitions unaffected | Mock LeadModel.findOne, assert throws before any DB call |
| **Unit** | validateTransition: `hasClient` check removed for `won` transitions; no throws when `hasClient` is undefined | Direct function calls |
| **Integration** | confirm-sale: full happy path with `saleMode='quotes'` — verify WorkOrder created with correct fields | Real MongoDB (test DB), seed lead+quotes, assert WorkOrder exists |
| **Integration** | confirm-sale: C1 — query finds `sent` quotes, not `approved` | Seed lead with 1 sent + 1 approved quote, verify only sent found |
| **Integration** | confirm-sale: C2 — after tx, quote.status === 'approved' | Seed sent quote, confirm-sale, read back |
| **Integration** | confirm-sale: C3 — lead with status `new` returns 400 | Seed lead with status `new`, assert 400 response |
| **Integration** | confirm-sale: C3 — lead with status `won` returns 400 | Seed lead already `won`, assert 400 |
| **Integration** | confirm-sale: D — WorkOrder without location (locationId=null, locationSnapshot={}) | Seed lead with no location data |
| **Integration** | confirm-sale: D — rollback on WorkOrder failure → lead NOT `won`, no orphan client | Mock WorkOrderModel.create to throw |
| **Integration** | confirm-sale: D — unique workOrderNumber per tenant | Two confirm-sales in same tenant, assert different numbers |

**Mock vs Real DB**: Unit tests mock all models. Integration tests use real MongoDB test database. WorkOrder creation tested against real DB to validate schema changes (locationId/locationSnapshot optional).

## Migration / Rollout

No migration required. Schema changes (`required: true → false`) are backwards-compatible — existing documents already have these fields populated. No feature flags needed — the change is safe to deploy as-is.

## Open Questions

None. All decisions resolved in proposal phase.
