# Delta for Work Order Assignment

## ADDED Requirements

### Requirement: Assignment Acknowledgment

The assigned technician MUST acknowledge the WorkOrder before proceeding.

#### Scenario: Technician acknowledges

- GIVEN WorkAssignment status = 'assigned'
- WHEN technician acknowledges
- THEN status = 'acknowledged'
- AND acknowledgedAt = current timestamp

#### Scenario: Technician declines

- GIVEN WorkAssignment status = 'assigned'
- WHEN technician declines
- THEN status = 'declined'
- AND declinedAt = current timestamp
- AND notification sent to dispatcher

## MODIFIED Requirements

### Requirement: Assignment Status Workflow

The system MUST support expanded assignment statuses for full audit trail.

(Previously: assigned, acknowledged, declined, replaced)

#### Scenario: Extended status support

- GIVEN WorkOrder assignment
- WHEN status changes
- THEN possible values: assigned, acknowledged, declined, replaced, cancelled
- AND each status change creates audit record
- AND timestamps recorded for state transitions

### Requirement: Assignment Replacement Chain

When replacing a technician, the system MUST maintain the full replacement chain.

(Previously: Basic replacement without full history)

#### Scenario: Multi-level replacement

- GIVEN Assignment A (T1) → Assignment B (T2) already exists
- WHEN T2 is replaced with T3
- THEN Assignment A keeps previousTechnicianId = null, type = 'initial'
- AND Assignment B gets previousTechnicianId = T1, type = 'replacement', replacedAt = now
- AND Assignment C created with previousTechnicianId = T2, type = 'replacement', status = 'assigned'
- AND Assignment C.replacedByAssignmentId references Assignment B

## REMOVED Requirements

### Requirement: Simple Assignment (REMOVED)

The simple one-to-one assignment model is being replaced by audit-aware assignment.

(Reason: Need full audit trail for accountability and history)
(Migration: Use new WorkAssignment with audit fields. Existing assignments migrated to have null audit fields and type = 'initial')