# Follow-up Marking System Specification

## Purpose

Allow administrators to mark leads or clients for follow-up by a specific user, creating a visible indicator on pipeline cards and a dedicated attention page.

## Requirements

### Requirement: FollowUpMark Data Model

The system MUST provide a `FollowUpMark` model to persist marked items for follow-up.

The model MUST include:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | ObjectId | Yes | Auto-generated unique identifier |
| `tenantId` | ObjectId | Yes | Tenant/organization reference |
| `targetType` | Enum | Yes | 'lead' or 'client' |
| `targetId` | ObjectId | Yes | Reference to lead or client |
| `assignedTo` | ObjectId | Yes | User designated for follow-up |
| `markedBy` | ObjectId | Yes | User who created the mark |
| `note` | String | No | Optional note for context |
| `markedAt` | Date | Yes | Auto-managed creation timestamp |

The model MUST implement a compound unique index on `[tenantId, targetType, targetId]` to prevent duplicate marks per entity.

#### Scenario: Create Follow-up Mark

- GIVEN an admin viewing a lead card in the pipeline
- WHEN clicking "Marcar para seguimiento" and selecting a user
- THEN create a FollowUpMark record with targetType='lead', targetId, assignedTo, and markedBy
- AND display yellow indicator on the card

#### Scenario: Prevent Duplicate Marks

- GIVEN a lead already marked for follow-up
- WHEN an admin attempts to mark the same lead again
- THEN return an error indicating the lead is already marked
- AND do not create a duplicate record

---

### Requirement: Follow-up Mark API

The system MUST provide REST API endpoints for follow-up mark operations.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/follow-up-marks` | POST | Create a new follow-up mark |
| `/api/follow-up-marks` | GET | List marks (filtered by userId query param) |
| `/api/follow-up-marks/:id` | DELETE | Remove a follow-up mark |

The GET endpoint MUST support query parameter `userId` to filter marks assigned to a specific user.

All endpoints MUST enforce tenant isolation by validating the user's tenantId from session.

#### Scenario: Get User's Marked Items

- GIVEN a user with follow-up marks assigned
- WHEN calling GET /api/follow-up-marks?userId=xxx
- THEN return all marks where assignedTo matches the userId
- AND include populated target (lead or client) data in response

#### Scenario: Delete Follow-up Mark

- GIVEN a follow-up mark exists in the system
- WHEN calling DELETE /api/follow-up-marks/:id
- THEN remove the mark from the database
- AND return success status

---

### Requirement: Pipeline Card Indicator

The system MUST display a visual indicator on pipeline cards that have an active follow-up mark.

The indicator MUST:
- Be a yellow/amber badge or icon (🟡)
- Appear on both lead and client cards in pipeline views
- Show only for marks where the current user is the assigned user

The system SHOULD display the indicator for all users regardless of assignment (for visibility).

#### Scenario: Card Shows Follow-up Indicator

- GIVEN a lead has an active FollowUpMark
- WHEN rendering the lead card in pipeline view
- THEN display yellow indicator icon on the card
- AND clicking the indicator shows mark details

---

### Requirement: Attention Page (/atencion)

The system MUST provide a dedicated page at `/atencion` to display items assigned to the current user for follow-up.

The page MUST:
- List all leads and clients where the current user is the assignedTo
- Group or filter by target type (leads/clients)
- Display entity name, status, and markedBy information
- Provide action to view entity details
- Provide action to unmark (remove follow-up)

#### Scenario: View Attention Page

- GIVEN a user with follow-up items assigned
- WHEN navigating to /atencion
- THEN display a list of all marked leads and clients
- AND show filter tabs for "All", "Leads", "Clients"

#### Scenario: Unmark from Attention Page

- GIVEN a user viewing their attention list
- WHEN clicking "Desmarcar" on an item
- THEN call DELETE /api/follow-up-marks/:id
- AND remove the item from the list
- AND update the indicator on the pipeline card

---

### Requirement: Tenant Isolation

All follow-up mark operations MUST be scoped to the user's tenant.

The system MUST:
- Filter all queries by tenantId from the user's session
- Prevent users from viewing marks from other tenants
- Prevent users from assigning follows to users outside their tenant

#### Scenario: Tenant Isolation

- GIVEN a user from tenant A
- WHEN accessing follow-up marks
- THEN only return marks where tenantId matches the user's tenant
- AND reject any operations with mismatched tenant
