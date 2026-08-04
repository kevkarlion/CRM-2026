# Tasks: Multi-Flow Engine

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 660-810 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: FlowSelector + Flow Configs / PR 2: Context + States / PR 3: Integration |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main|feature-branch-chain|size-exception|pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | FlowSelector component + flow configs | PR 1 | Base: main; includes FlowSelector and both flow configs |
| 2 | Context enhancement + customer flow states | PR 2 | Base: PR 1; initializeFromCustomer + 6 new states |
| 3 | WhatsApp service integration | PR 3 | Base: PR 2; wire FlowSelector into whatsapp.service.ts |

## Phase 1: Flow Configuration Infrastructure

- [ ] 1.1 Create `src/conversation/flow-selector.ts` — FlowSelector class with `selectFlow(phone, tenantId)` method
- [ ] 1.2 Create `src/conversation/configs/lead-qualification.ts` — Lead qualification flow config (reuse existing from flow.ts)
- [ ] 1.3 Create `src/conversation/configs/customer-service.ts` — Customer service flow config with 6 states

## Phase 2: Context Enhancement

- [ ] 2.1 Add `initializeFromCustomer(customer: Customer)` method to `ConversationContext` class

## Phase 3: Customer Flow States

- [ ] 3.1 Create `greeting_personalized` state in customer-service flow
- [ ] 3.2 Create `service_type` state in customer-service flow
- [ ] 3.3 Create `address_confirm` state in customer-service flow
- [ ] 3.4 Reuse/verify `description` state works for customer flow
- [ ] 3.5 Reuse/verify `summary` state works for customer flow
- [ ] 3.6 Create `waiting_operator` terminal state in customer-service flow

## Phase 4: Integration

- [ ] 4.1 Update `src/whatsapp/whatsapp.service.ts` to use FlowSelector before creating ConversationEngine
- [ ] 4.2 Pass selected flow config to engine; call `initializeFromCustomer` when customer data exists