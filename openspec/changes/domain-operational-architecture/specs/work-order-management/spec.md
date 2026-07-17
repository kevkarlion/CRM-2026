# Delta for Work Order Management

## MODIFIED Requirements

### Requirement: Work Order Status Flow

The system MUST enforce the Operative domain workflow: Confirm Sale → WorkOrder → Asignación → Agenda → Ejecución → Informe Técnico → Cierre

(Previously: WorkOrder status could be set arbitrarily)

#### Scenario: Status transitions follow domain flow

- GIVEN WorkOrder with status = 'confirmed' (from Commercial)
- WHEN WorkOrder enters Operative domain
- THEN status can transition: assigned → en_route → on_site → paused → completed → closed
- AND certain transitions require WorkAssignment (e.g., en_route requires assigned technician)

#### Scenario: Invalid status transition blocked

- GIVEN WorkOrder status = 'draft'
- WHEN attempting to set status = 'completed'
- THEN transition blocked
- AND validation error returned

### Requirement: Work Order Integration with Commercial

When a Commercial deal is confirmed (Confirm Sale), the system MUST automatically create a WorkOrder.

(Previously: WorkOrder created manually)

#### Scenario: Auto-create from Confirm Sale

- GIVEN Commercial has Quote accepted and deal confirmed
- WHEN Confirm Sale event triggers
- THEN WorkOrder created automatically
- AND client/location/equipment snapshots captured
- AND WorkOrder status = 'scheduled' (ready for assignment)

### Requirement: Scheduling Integration

The system MUST support scheduled dates for WorkOrder execution.

(Previously: No scheduling support)

#### Scenario: Schedule WorkOrder

- GIVEN WorkOrder in scheduled status
- WHEN dispatcher sets scheduledDate and scheduledStart/End
- THEN dates stored
- AND WorkOrder appears in Agenda view
- AND reminder notifications sent before scheduled time