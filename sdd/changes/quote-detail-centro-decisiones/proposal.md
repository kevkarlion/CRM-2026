# SDD Proposal — Quote Detail "Centro de Decisiones Comerciales"

## Intent

Build an intelligent Quote Detail view that functions as a "Commercial Decision Center" — a state-aware interface that surfaces the right actions, warnings, and context at the right time based on the combined state of the Quote, its Lead, its Negotiation, and its WorkOrder status. The current detail page is a passive data display with a fixed status-based action bar; the new version proactively guides the user through the commercial workflow by showing only what's relevant to the current situation.

## Scope

### In scope

- **QuoteDecisionEngine** — Pure logic layer that inputs (quote status, lead status, negotiation state, work order existence, expiry dates) and outputs (available actions, priority indicators, warnings, suggested next action)
- **Enhanced API** — The quote detail endpoint (`GET /api/crm/quotes/:id`) enriched to return lead context, negotiation reference, and conversion status in a single response, eliminating waterfalls
- **Layout redesign** — Decision-centric layout with executive summary header, smart action bar, financial summary, services as independent cards, commercial info block, negotiation summary, timeline, and entity relationship visualization
- **Smart action bar** — Replaces `DetailActionBar`; actions driven by `QuoteDecisionEngine` output rather than `quote.status` alone
- **Confirm Sale integration** — "Confirmar Venta" action surfaced on the quote detail when conditions are met, reusing the existing `ConfirmSaleDrawer` via `leadId`
- **Priority and expiry indicators** — Visual indicators for: waiting for response, expiring soon, expired, negotiation active, ready to confirm
- **Negotiation visibility** — Summary block showing negotiation status, counteroffers count, last update, next follow-up
- **Breadcrumb navigation** — Updated to `Comercial > Cotizaciones > Cotización #Q-000245`
- **Mobile-first responsive design** — Single column on mobile, two/three columns on desktop
- **Side panel** — Quick links to related entities (Lead, Client, Negotiation, Activity)
- **Timeline via Activity entity** — Uses the existing `ActivityTimeline` component with proper quote-scoped activity loading
- **Entity relationship visualization** — Visual map of Lead → Quote → Negotiation → Client flow

### Out of scope

- **WorkOrder creation** — Not available from this screen (operational flow only); the existing `/convert` endpoint is NOT surfaced
- **AI-powered recommendations** — Suggested next action is pure logic, no AI/ML
- **Negotiation creation from quote detail** — Navigation to existing negotiation only; creation stays in Lead detail
- **Quote editing** — Edit action navigates to existing edit page; no inline editing
- **New API routes** — Reuse existing endpoints; only the GET quote detail response is enhanced
- **Negotiation detail** — No negotiation detail implemented here; link navigates to Negotiation module

## Approach

### 1. QuoteDecisionEngine (pure function module)

New file at `src/quotes/helpers/decision-engine.ts`. A pure function:

```typescript
interface DecisionEngineInput {
  quote: { status: QuoteStatus; validUntil: Date | null; sentAt: Date | null };
  lead: { status: string; pipelineStage?: string } | null;
  negotiation: { status: string; counterofferCount: number; updatedAt: Date; followUp?: Date } | null;
  hasWorkOrder: boolean;
}

interface DecisionEngineOutput {
  availableActions: DecisionAction[];
  priority: PriorityIndicator | null;
  suggestedNextAction: { type: NextActionType; label: string };
  warnings: WarningBadge[];
}

function evaluate(input: DecisionEngineInput): DecisionEngineOutput
```

This replaces the current `getAvailableActions()` inside `detail-action-bar.tsx` and enhances the existing `getNextAction()` from `next-action-badge.tsx`. The engine is framework-agnostic and testable in isolation.

### 2. Enhanced API (`GET /api/crm/quotes/:id`)

Currently returns `{ quote, currentVersion }`. Enhanced to return:

```typescript
interface QuoteDetailResponse {
  quote: IQuote;
  currentVersion: IQuoteVersion | null;
  lead: { _id: string; status: string; pipelineStage: string; origin: string; responsible: string; createdAt: Date } | null;
  negotiation: { _id: string; status: string; counterofferCount: number; updatedAt: Date; nextFollowUp?: Date } | null;
  hasWorkOrder: boolean;
}
```

The controller fetches the quote, then parallel-fetches lead and negotiation from existing services. No new API routes.

### 3. Layout Redesign

The current `3fr/2fr` two-column layout is replaced with a decision-centric structure:

**Mobile (single column):**
1. Breadcrumb
2. Executive summary header (number, client, lead, status badge, amount, dates, responsible)
3. Priority/warning badges
4. Suggested next action card
5. Financial summary (subtotal → discounts → taxes → total)
6. Services cards (independent cards per item)
7. Commercial info from Lead
8. Negotiation summary
9. Activity timeline
10. Entity relationship map
11. Side panel links (bottom)

**Desktop (two/three column):**
- Left: Executive summary + Financial summary + Services cards
- Right: Commercial info + Negotiation summary + Timeline
- Or 3-column: summary left, services center, context right (design phase decision)

Fixed bottom smart action bar persists across all breakpoints.

### 4. Smart Action Bar

Replaces `DetailActionBar`. Driven entirely by `QuoteDecisionEngine`. Example action matrix:

| Quote Status | Lead Status | Has Negotiation | Has WO | Available Actions |
|---|---|---|---|---|
| draft | any | any | any | Edit, Send, Delete |
| sent | quote_sent | no | no | Start Negotiation, Download PDF, Duplicate |
| sent | negotiation | active | no | View Negotiation |
| approved | any | any | no | Confirm Sale, Duplicate |
| approved | any | any | yes | Duplicate |
| expired | any | any | any | Duplicate (new quote) |
| rejected | any | any | any | Duplicate |
| cancelled | any | any | any | — |

"Confirm Sale" button calls the existing `ConfirmSaleDrawer` passing `leadId` — fully reuses existing component and API.

### 5. Existing Component Reuse

| Component | Status | Action |
|---|---|---|
| `Breadcrumb` | Exists | Update trail to `Comercial > Cotizaciones > #Q-000245` |
| `DetailInfoPanel` | Exists | Split into financial summary + services cards; keep version history |
| `ActivityTimeline` | Exists | Keep; fix to load quote-scoped activities |
| `DetailActionBar` | Exists | **Replace entirely** with smart action bar |
| `ConfirmSaleDrawer` | Exists (Lead module) | Reuse via import |
| `NextActionBadge` | Exists | Keep for list page; detail uses richer version |
| `ExpiryBadge` | Exists | Reuse for expiry warnings |
| `Drawer` | Exists (lib) | Used by Confirm Sale flow |
| `StatusColor` utilities | Exists | Reuse |

## Business Rules

### Action availability

- **Edit**: Only when `quote.status === 'draft'`
- **Send**: Only when `quote.status === 'draft'` AND quote has items AND has clientId/leadId
- **Delete**: Only when `quote.status === 'draft'`
- **Start Negotiation**: When `quote.status === 'sent'` AND no negotiation exists for this quote
- **View Negotiation**: When `quote.status === 'sent'` AND negotiation exists AND negotiation is not closed (won/lost)
- **Download PDF**: When `quote.status === 'sent'` OR `quote.status === 'approved'`
- **Duplicate**: Always available (creates new draft from current version)
- **Confirm Sale**: When (`quote.status === 'approved'`) OR (negotiation exists AND `negotiation.status === 'accepted'`) AND no WorkOrder exists (`convertedToWorkOrder === null`)

### Priority indicators

- **Waiting for response**: `status === 'sent'`, sent > 3 days ago, no negotiation counteroffer
- **Expiring soon**: `status === 'sent'` (or `draft` with validUntil), validUntil within 7 days
- **Expired**: `status === 'expired'` OR validUntil < today
- **Negotiation active**: negotiation exists with status !== 'won' | 'lost'
- **Ready to confirm**: quote approved OR negotiation accepted, AND no work order

### Confirm Sale conditions (explicit)

1. Quote is `approved`, OR Negotiation was accepted (`negotiation.status === 'accepted'` or similar terminal win state)
2. Quote has NOT been converted to WorkOrder (`convertedToWorkOrder === null`)
3. Lead is in an active state (not `won`, `lost`, or `disqualified`)

### Suggested next action logic

Reuses and extends `getNextAction()` from `next-action-badge.tsx`:
- **Draft**: "Send quote to client"
- **Sent + no response > 3 days**: "Client hasn't responded — follow up"
- **Sent + expiring ≤ 7 days**: "Quote expires soon — contact client"
- **Sent + negotiation counteroffer**: "Respond to counteroffer"
- **Active negotiation**: "Continue negotiation — next follow-up on {date}"
- **Approved + no WO**: "Ready to confirm sale"
- **Approved + has WO**: "Sale completed"
- **Expired**: "Review and re-quote"
- **Rejected**: "Review and re-quote" (with different approach)

### Entity relationships shown

```
Lead ──→ Quote ──→ Negotiation
  │                  │
  └──→ Client ←──────┘
```

Each node is clickable and navigates to the corresponding detail page.

## Impact

### Files to modify

| File | Change |
|---|---|
| `src/app/(dashboard)/quotes/[id]/page.tsx` | Full rewrite — new layout, smart action bar, enriched data fetching |
| `src/components/quotes/detail-action-bar.tsx` | **Replace** — becomes thin wrapper over decision engine |
| `src/components/quotes/detail-info-panel.tsx` | **Split** — financial summary + services cards extracted |
| `src/quotes/types/client-quote-types.ts` | Add new types (DecisionEngineInput, DecisionEngineOutput, PriorityType) |
| `src/quotes/types/quote.ts` | Possibly add `ApiQuoteDetailResponse` type |
| Quote API controller (`GET /:id`) | Enrich response with lead + negotiation + work order status |

### Files to create

| File | Purpose |
|---|---|
| `src/quotes/helpers/decision-engine.ts` | Core intelligence — pure function |
| `src/components/quotes/smart-action-bar.tsx` | New action bar driven by decision engine |
| `src/components/quotes/executive-summary-header.tsx` | Header with number, client, status, amount, dates, responsible |
| `src/components/quotes/priority-indicator.tsx` | Visual priority badges |
| `src/components/quotes/services-cards.tsx` | Independent service item cards |
| `src/components/quotes/commercial-info-block.tsx` | Lead context card |
| `src/components/quotes/negotiation-summary.tsx` | Negotiation preview card |
| `src/components/quotes/entity-relationship-map.tsx` | Visual entity flow |
| `src/components/quotes/decision-side-panel.tsx` | Quick links sidebar |

### Dependencies on existing services

- **Quote service** (`quote.service.ts`): CRUD + state transitions — no changes needed
- **CommercialProcessService**: `onQuoteSent()` — already integrated
- **Conversion service** (`conversion.service.ts`): Not used from this screen (intentional)
- **Lead service**: Read-only — fetch lead context for quote's leadId
- **Negotiation service**: Read-only — find negotiation by quoteId
- **Activity service**: Timeline already uses it; needs proper quote-scoped loading fix
- **Confirm-sale API** (`POST /api/crm/leads/:id/confirm-sale`): Reused as-is via `ConfirmSaleDrawer`

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| **State explosion** in decision engine: combining 4 entity states into coherent actions creates combinatorial complexity | Medium | Keep engine as pure function with exhaustive test coverage per combination; use table-driven approach (action matrix as data, not nested if/else) |
| **ActivityTimeline broken** for quotes (currently passes quoteId instead of leadId) | High | Fix in this change: load activities by `entityType: 'quote'` and `entityId: quote._id`, or by leadId depending on how the Activity schema stores it — verify during implementation |
| **Negotiation reverse lookup** (find by quoteId) may not be indexed | Low | Add a sparse index on `quoteId` in Negotiation schema if not present |
| **ConfirmSaleDrawer assumes Lead page** — it's imported from `/leads/components/` but has no page dependency | Low | Component has no page coupling; it takes `leadId`, `leadName`, callbacks — fully portable |
| **Layout density** on mobile: too much info for one column | Medium | Progressive disclosure — expandable sections, collapsible cards; prioritize executive summary + smart actions above fold |

## Verification

- Decision engine unit tests: every (quoteStatus, leadStatus, hasNegotiation, hasWorkOrder) combination must produce expected actions
- Integration: enriched API returns all fields without breaking existing consumers
- Visual regression: mobile, tablet, desktop breakpoints render without overflow
- Flow: Confirm Sale opens drawer, submits, refreshes state
- Flow: timeline loads quote-scoped activities correctly
