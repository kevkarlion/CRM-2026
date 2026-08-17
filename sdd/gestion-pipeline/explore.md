# Exploration: Gestión Entity (NEW separate entity)

## Current State

The codebase has:
- **Lead** entity in `src/leads/schemas/lead.ts` with full pipeline lifecycle
- **Client** entity in `src/crm/schemas/client.ts` with `operationStatus` field
- **ConversationResolver** that detects client vs lead and routes to different flows
- **PipelineBoard** that displays leads grouped by pipeline stages

### Lead Schema Fields to Replicate

The Lead schema has these fields that Gestión needs:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `tenantId` | ObjectId | Yes | Reference to Tenant |
| `name` | String | Yes | Contact name |
| `phone` | String | No | Normalized phone |
| `companyName` | String | No | Business name |
| `email` | String | No | Contact email |
| `source` | Enum | Default: whatsapp | whatsapp, call, form, referral, walk_in, other |
| `status` | Enum | Yes | new, contacted, quote_sent, technical_visit, negotiation, won, lost, disqualified |
| `qualificationStatus` | Enum | Yes | qualified, not_qualified, pending |
| `assignedTo` | ObjectId | No | Reference to User |
| `lostReason` | Enum | No | price, competitor, budget, not_interested, timing, no_response, other |
| `lostDescription` | String | No | Details when lost |
| `previousLeadId` | ObjectId | No | For follow-up chains |
| `estimatedValue` | Number | No | Potential deal value |
| `notes` | String | No | General notes |
| `inquiryReason` | Enum | No | repair, maintenance, installation, budget, other, spare_parts |
| `customerType` | Enum | No | residential, commercial |
| `temperature` | Enum | No | hot, warm, cold |
| `profileName` | String | No | WhatsApp profile name |
| `address`, `locality`, `province` | String | No | Location |
| `priority` | Enum | No | high, medium, low |
| `adminNotes` | String | No | Private admin notes |
| `score` | Number | No | Calculated score (0-100) |
| `isB2B` | Boolean | No | B2B flag |
| `scoringBreakdown` | Object | No | buttons, property, keywords, b2B |
| `convertedToClient` | ObjectId | No | Reference when converted |
| `convertedToWorkOrder` | ObjectId | No | Reference to work order |
| `convertedAt` | Date | No | Conversion timestamp |
| `createdBy`, `updatedBy` | String | Yes | Audit |
| `deletedAt`, `deletedBy` | Date/String | No | Soft delete |

### Required New Field for Gestión

**`clientId`** - ObjectId reference to Client (NEW - not in Lead)

## Affected Areas

1. **`src/leads/schemas/lead.ts`** — Reference for schema structure (don't modify)
2. **`src/crm/schemas/client.ts`** — Need to understand operationStatus field
3. **`src/conversation/application/conversation-resolver.ts`** — Logic to detect client and create/continue Gestión
4. **`src/leads/pipeline-board/hooks/usePipelineLeads.ts`** — Fetch logic for pipeline
5. **`src/leads/pipeline-board/components/PipelineBoard.tsx`** — UI rendering leads

## Approaches

### Option A: Full Replica of Lead Structure
Create exact copy of all Lead files (`types/gestion.ts`, `schemas/gestion.ts`, `models/gestion.ts`, `services/gestion.service.ts`, `routes/gestion.ts`) with added `clientId` field.

- **Pros**: Complete separation, clear ownership, can have different workflows
- **Cons**: Duplicated code (~90% similarity with Lead), maintenance burden
- **Effort**: High

### Option B: Shared Base with Inheritance
Create a shared `LeadBase` type/schema and extend for both Lead and Gestión, adding `clientId` only to Gestión.

- **Pros**: DRY principle, shared logic, easier maintenance
- **Cons**: More complex schema design, potential coupling
- **Effort**: Medium-High

### Option C: Lean Gestión (Recommended)
Create minimal Gestión entity with only pipeline-relevant fields + `clientId`. Reuse Lead's pipeline infrastructure but own its own data.

- **Pros**: Focused scope, simpler than full replica, clear boundaries
- **Cons**: Some field duplication (status, priority, score, etc.)
- **Effort**: Medium

## Files to Create

Based on Option C (Lean Gestión):

```
src/gestion/
├── types/
│   ├── gestion.ts          # IGestion, GestionStatus, CreateGestionInput, UpdateGestionInput
│   └── index.ts
├── schemas/
│   ├── gestion.ts          # gestionSchema with clientId + lead fields
│   └── index.ts
├── models/
│   ├── gestion.ts          # GestionModel
│   └── index.ts
├── services/
│   ├── gestion.service.ts  # CRUD + status transitions + client operationStatus sync
│   └── index.ts
├── api/
│   ├── gestion/
│   │   ├── route.ts        # GET list, POST create
│   │   └── [id]/
│   │       ├── route.ts    # GET, PATCH, DELETE
│   │       └── route-status.ts  # PATCH status (with win→operationStatus logic)
```

## API Endpoint Structure

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/crm/gestiones` | List all Gestión (filter by clientId, status) |
| POST | `/api/crm/gestiones` | Create new Gestión |
| GET | `/api/crm/gestiones/[id]` | Get single Gestión |
| PATCH | `/api/crm/gestiones/[id]` | Update Gestión fields |
| DELETE | `/api/crm/gestiones/[id]` | Soft delete |
| PATCH | `/api/crm/gestiones/[id]/status` | Change status (special: won→client.operationStatus='sale_confirmed') |

## PipelineBoard Integration

### Changes Required

1. **API endpoint** `/api/crm/leads/grouped` → extend or create `/api/crm/gestiones/grouped`
2. **Hook** `usePipelineLeads` → add param to fetch both Leads AND Gestión
3. **PipelineBoard.tsx**:
   - Merge leads + gestión into columns
   - Add visual differentiation: 🟢 Gestión (green) vs 🔵 Lead (blue)
   - Add filter toggle: "Show Leads", "Show Gestión", "Show Both"
4. **Card component** → show client name for Gestión items

### Visual Differentiation

```tsx
// PipelineCard colors
const getCardStyles = (item: ILead | IGestion) => {
  if ('clientId' in item && item.clientId) {
    return 'border-l-4 border-l-green-500 bg-green-50'; // Gestión
  }
  return 'border-l-4 border-l-blue-500 bg-blue-50'; // Lead
};
```

## WhatsApp Integration (ConversationResolver)

When client sends WhatsApp message → check for existing Gestión with status NOT (won|lost|disqualified):

1. **If exists active Gestión**: Continue conversation linked to that Gestión
2. **If not exists**: Create new Gestión linked to that Client

### Code Change in ConversationResolver

```typescript
// In resolveConversation(), after detecting isClient
if (isClient) {
  // Find existing active Gestión for this client
  const gestion = await GestionModel.findOne({
    tenantId: new Types.ObjectId(tenantId),
    clientId: contact.clientId,
    status: { $nin: ['won', 'lost', 'disqualified'] },
    deletedAt: null,
  }).lean();
  
  if (gestion) {
    // Continue existing Gestión
    return this.continueGestion(gestion, ...);
  } else {
    // Create new Gestión
    return this.createNewGestion(clientId, ...);
  }
}
```

## Recommendation

**Option C (Lean Gestión)** is recommended because:
1. Gestión has distinct business purpose (post-sale follow-up) vs Lead (new prospect)
2. Simpler than full replica but still clear separation
3. Can share pipeline infrastructure (stages, board UI) without code coupling
4. Focuses on what's needed: status flow + client reference

## Risks

1. **Field duplication**: status, priority, score fields exist in both Lead and Gestion
2. **PipelineBoard complexity**: Need to handle two entity types in same UI
3. **ConversationResolver**: Must correctly route client messages to Gestion (not lead)
4. **Client operationStatus**: Must update correctly when Gestion is won

## Ready for Proposal

**Yes** - Enough information to create the SDD proposal. The orchestrator should tell the user:

- Confirm Option C (Lean Gestión) approach
- Confirm fields to include (minimal set from Lead + clientId)
- Confirm PipelineBoard integration: unified view with visual differentiation
- Confirm WhatsApp flow: client messages → Gestion (not Lead)
- Confirm status="won" → client.operationStatus="sale_confirmed" rule