# Tasks: Client History

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~400-500 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | All tasks in single PR | PR 1 | self-contained feature |

## Phase 1: Model (Foundation)

- [ ] 1.1 Create types: `src/clients/types/client-service-history.ts` — IClientServiceHistory interface with all fields from spec
- [ ] 1.2 Create schema: `src/clients/schemas/client-service-history.ts` — Mongoose schema with validation and enums
- [ ] 1.3 Create model: `src/clients/models/client-service-history.ts` — Mongoose model export
- [ ] 1.4 Update `src/clients/index.ts` — Export new model

## Phase 2: Context Enhancement

- [ ] 2.1 Add `getFreshClientData(phone, tenantId)` to `src/conversation/context.ts` — Query ClientModel directly, bypass cache
- [ ] 2.2 Add `updateClientAddress(clientId, tenantId, address, locality, province)` to context — Update client address fields

## Phase 3: Address Update Logic

- [ ] 3.1 Modify `src/conversation/states/customer/address_confirm.ts` — When customer selects "another address", call context.updateClientAddress() and return updated data
- [ ] 3.2 Ensure `whatsapp.service.ts` passes tenantId to engine for address operations

## Phase 4: History Creation

- [ ] 4.1 Modify `src/conversation/states/customer/waiting_operator.ts` — When `context.complete === true` && `context.isCustomer === true`, create ClientServiceHistory with status 'pending'

## Phase 5: Testing

- [ ] 5.1 Unit test: ClientServiceHistory schema validation — required fields, enum values
- [ ] 5.2 Unit test: address_confirm state — verify address update intent when customer rejects
- [ ] 5.3 Unit test: waiting_operator history creation — verify all context fields mapped to history record
