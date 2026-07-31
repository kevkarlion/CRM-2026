# Delta for Work Order Management

## MODIFIED Requirements

### Requirement: Work Order Status Flow

The system MUST enforce the Operative domain workflow: Confirm Sale → WorkOrder → Asignación → Agenda → Ejecución → Informe Técnico → Cierre

For Technician Work Execution, the status flow is simplified: assigned → in_progress → completed

(Previously: assigned → en_route → on_site → paused → completed → closed)

#### Scenario: Technician execution status transitions

- GIVEN WorkOrder with status = 'assigned'
- AND technician is assigned
- WHEN technician starts work
- THEN status can transition: assigned → in_progress → completed
- AND intermediate states (en_route, on_site, paused) are NOT used in this flow

#### Scenario: Complete work execution

- GIVEN WorkOrder with status = 'in_progress'
- AND technician submits WorkReport with result
- THEN status changes to 'completed'
- AND finishedAt timestamp recorded

## ADDED Requirements

### Requirement: Work Execution Tracking

The system MUST track work execution details on the WorkOrder.

#### Scenario: Record start timestamp

- GIVEN WorkOrder transitions from 'assigned' to 'in_progress'
- WHEN technician initiates work
- THEN startedAt = current timestamp
- AND startedBy = technician's user ID

#### Scenario: Record finish timestamp

- GIVEN WorkOrder transitions from 'in_progress' to 'completed'
- WHEN technician completes work
- THEN finishedAt = current timestamp
- AND duration calculated as (finishedAt - startedAt) in minutes

### Requirement: Technical Visit Status Flow

The system MUST support the same simplified status flow for Technical Visits: assigned → in_progress → completed

#### Scenario: Technical Visit execution

- GIVEN Technical Visit with status = 'assigned'
- AND technician is assigned
- WHEN technician starts work
- THEN status = 'in_progress'

- GIVEN Technical Visit with status = 'in_progress'
- WHEN technician submits WorkReport
- THEN status = 'completed'
- AND workReportId populated