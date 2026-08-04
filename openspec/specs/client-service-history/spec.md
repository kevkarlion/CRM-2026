# Client Service History Specification

## Purpose

Track all service interactions per client for audit, continuity, and customer relationship management.

## Requirements

### Requirement: ClientServiceHistory Model

The system MUST provide a `ClientServiceHistory` model to persist service records.

The model MUST include:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | ObjectId | Yes | Auto-generated unique identifier |
| `tenantId` | ObjectId | Yes | Tenant/organization reference |
| `clientId` | ObjectId | Yes | Reference to Client |
| `serviceType` | Enum | Yes | One of: repair, maintenance, installation, budget, other |
| `address` | String | Yes | Service location address |
| `locality` | String | Yes | Locality/neighborhood |
| `province` | String | Yes | Province/region |
| `description` | String | No | Service description/notes |
| `status` | Enum | Yes | pending, in_progress, completed, cancelled |
| `createdAt` | Date | Yes | Auto-managed creation timestamp |
| `updatedAt` | Date | Yes | Auto-managed update timestamp |
| `createdBy` | String | Yes | User or system that created the record |

#### Scenario: Create Service History Record

- GIVEN a confirmed service in waiting-operator state
- WHEN the bot creates a ClientServiceHistory record with service data from context
- THEN the record is saved with status 'pending'
- AND clientId, address, serviceType, and createdBy are populated

#### Scenario: Query Client Service History

- GIVEN a client with existing service history
- WHEN querying ClientServiceHistory by clientId and tenantId
- THEN return all history records ordered by createdAt descending

---

### Requirement: Fresh Client Data Retrieval

The system MUST provide a method to retrieve current client data directly from the database.

The `ConversationContext` class MUST implement:

```typescript
async getFreshClientData(phone: string, tenantId: string): Promise<IClient | null>
```

The method MUST:
- Always query the database directly (bypass any cache)
- Match client by phone number and tenantId
- Return the current client document or null if not found

#### Scenario: Get Fresh Client Data

- GIVEN a phone number and tenantId
- WHEN calling getFreshClientData()
- THEN query ClientModel.findOne({ phone, tenantId })
- AND return the current client document

#### Scenario: Client Not Found

- GIVEN a phone number with no matching client
- WHEN calling getFreshClientData()
- THEN return null

---

### Requirement: Client Address Update

The system MUST allow updating client address during the address-confirm conversation state.

When the customer chooses "another address" option:

- The system MUST update the Client document with new address, locality, and province
- The updated address MUST be returned for conversation context

#### Scenario: Update Client Address

- GIVEN a client in address-confirm state
- WHEN customer selects "another address" and provides new address details
- THEN update Client: address, locality, province fields
- AND return the updated client for context

#### Scenario: Keep Existing Address

- GIVEN a client in address-confirm state
- WHEN customer confirms current address
- THEN do not modify the Client record
- AND proceed with existing address

---

### Requirement: Create History on Service Confirmation

The system MUST create a ClientServiceHistory record when a service is confirmed in waiting-operator state.

The creation MUST occur after:
- Service details are confirmed by the customer
- Operator assignment is pending

The history record MUST capture:
- Current clientId from context
- Service type and description from conversation
- Address from client or conversation context
- Status: 'pending' (awaiting operator)

#### Scenario: Create History on Confirmation

- GIVEN a service in waiting-operator state
- WHEN customer confirms service details
- THEN create ClientServiceHistory with data from context
- AND set status to 'pending'
- AND proceed to operator assignment

#### Scenario: No Duplicate History on Reconfirmation

- GIVEN a service that was already confirmed
- WHEN customer reconfirms the same service
- THEN do not create a duplicate ClientServiceHistory record