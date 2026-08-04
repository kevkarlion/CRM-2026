# Client History Change Proposal

## Overview

Add client service history tracking and improve client data freshness in the bot conversation flow.

## Capabilities

### New Capabilities

1. **Client Service History Model**
   - New `ClientServiceHistory` model to track all services per client
   - Fields: tenantId, clientId, serviceType, address, locality, province, description, status, timestamps, createdBy

2. **Create History on Service Completion**
   - In `waiting-operator` state, when service is confirmed
   - Create `ClientServiceHistory` record with context data

### Modified Capabilities

3. **Client Address Update**
   - In `address-confirm` state, when customer selects "another address"
   - Update Client: address, locality, province fields
   - Return updated address for conversation context

4. **Fresh Client Data Retrieval**
   - Add `getFreshClientData(phone, tenantId)` to `ConversationContext`
   - Always query database directly (bypass cache)
   - Return current client data for accuracy

## Affected Areas

- Bot conversation flow (address-confirm, waiting-operator states)
- Client model (address fields update)
- ConversationContext (new method)
- New ClientServiceHistory collection

## Approach

- New model: ClientServiceHistory Mongoose schema
- Address update: ClientModel.findOneAndUpdate in address-confirm handler
- Fresh data: ConversationContext.getFreshClientData method
- History creation: ServiceHistoryModel.create in confirmation handler

## Rollback Plan

- Remove ClientServiceHistory model if unused
- Revert address-confirm to return existing address without update
- Remove fresh data method if not needed
