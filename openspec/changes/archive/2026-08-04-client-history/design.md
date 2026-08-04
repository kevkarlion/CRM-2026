# Design: Client Service History

## Technical Approach

This change introduces service history tracking for existing clients in the customer-service WhatsApp flow. When a client contacts via WhatsApp, the system will:
1. Load fresh client data from DB during conversation initialization
2. Update client address when they confirm a different address
3. Create a service history record when the conversation completes and is handed to an operator

## Architecture Decisions

### Decision: ClientServiceHistory Model Location

**Choice**: Create new model in `src/clients/models/client-service-history.ts` (matching existing `client.ts` location pattern)

**Alternatives considered**: Extending existing `ServiceHistory` model in `src/crm/models/service-history.ts`

**Rationale**: The existing `ServiceHistory` is equipment-centric (tracks equipment maintenance/repairs). `ClientServiceHistory` tracks client service requests independently of equipment. Separate models maintain single responsibility and align with domain separation.

### Decision: Fresh Client Data Loading

**Choice**: Add `getFreshClientData()` method to `ConversationContext` class

**Alternatives considered**: Loading in whatsapp.service.ts before engine start

**Rationale**: Keeping data fetching in the context layer maintains separation of concerns. The engine shouldn't know about data loading specifics. This allows the context to refresh client data when needed (e.g., after address confirmation).

### Decision: Address Update Timing

**Choice**: Update Client address after user confirms new address in `address_confirm` state

**Alternatives considered**: Update only at conversation completion

**Rationale**: User explicitly confirmed the new address is correct. Updating immediately ensures the client record stays current and avoids losing the update if the conversation doesn't complete.

### Decision: History Creation Trigger

**Choice**: Create history record in `waiting_operator` state when `context.complete === true` AND `context.isCustomer === true`

**Alternatives considered**: Create in whatsapp.service.ts after conversation completes

**Rationale**: State-based triggering is more explicit and maintainable. The state knows what data it has available. The condition ensures only existing customers (not new leads) get history records.

## Data Flow

```
User sends message
       │
       ▼
WhatsAppService.processWithEngine()
       │
       ▼
ConversationEngine.process()
       │
       ▼
[address_confirm state] ──user rejects address──▶ getFreshClientData()
       │                                              │
       │                                              ▼
       │                                      Update Client.address
       ▼
[waiting_operator state] ──context.complete=true + isCustomer=true
       │
       ▼
Create ClientServiceHistory with:
  - tenantId, clientId
  - serviceType (from context)
  - address, locality, province (from context)
  - description (from context)
  - status: 'pending'
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/clients/models/client-service-history.ts` | Create | New Mongoose model for service history |
| `src/clients/types/client-service-history.ts` | Create | TypeScript interface |
| `src/clients/schemas/client-service-history.ts` | Create | Mongoose schema |
| `src/clients/index.ts` | Modify | Export new model |
| `src/conversation/context.ts` | Modify | Add `getFreshClientData()` method |
| `src/conversation/states/customer/address_confirm.ts` | Modify | Call address update after confirmation |
| `src/conversation/states/customer/waiting_operator.ts` | Modify | Create history record on completion |
| `src/crm/services/whatsapp.service.ts` | Modify | Pass tenantId to engine for data operations |

## Interfaces / Contracts

### ClientServiceHistory

```typescript
interface IClientServiceHistory {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  clientId: Types.ObjectId;
  serviceType: 'repair' | 'maintenance' | 'installation' | 'budget' | 'other';
  address: string;
  locality?: string;
  province?: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  createdBy: string; // 'whatsapp-bot'
  createdAt: Date;
  updatedAt: Date;
}
```

### ConversationContext Extension

```typescript
class ConversationContext {
  // ... existing methods ...

  /**
   * Get fresh client data from database
   * Use after address confirmation to ensure latest data
   */
  async getFreshClientData(phone: string, tenantId: string): Promise<IClient | null>;

  /**
   * Update client address after confirmation
   */
  async updateClientAddress(clientId: string, tenantId: string, address: string, locality?: string, province?: string): Promise<void>;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `ClientServiceHistorySchema` validation | Test required fields, enum values |
| Unit | `address_confirm` state logic with new address | Mock context, verify intent data |
| Unit | `waiting_operator` history creation | Verify all context fields mapped |
| Integration | End-to-end customer flow | Full WhatsApp message flow |

## Migration / Rollout

No migration required. New model is created alongside existing code. The feature is additive:
- Existing flows continue unchanged
- Only customer-service flow triggers new behavior
- History records are created for new conversations only

### Feature Flag Considerations

The implementation can be guarded by checking `process.env.ENABLE_CLIENT_HISTORY === 'true'` if gradual rollout is needed.

## Open Questions

- [ ] Should we also track lead service history, or only confirmed clients?
- [ ] Should address updates be logged as a separate activity record?
- [ ] Do we need to handle the case where client is not found during address update?
