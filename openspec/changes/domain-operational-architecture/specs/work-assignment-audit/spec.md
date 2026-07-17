# Work Assignment Audit Specification

## Purpose

Immutable audit trail for all technician assignments. Track every change for accountability and historical analysis.

## Requirements

### Requirement: Assignment History Immutable

The system MUST never overwrite assignment history. When a technician is replaced:

- Previous assignment record MUST remain unchanged
- New assignment record MUST be created
- Both records MUST be queryable

#### Scenario: Technician replacement

- GIVEN WorkOrder has Assignment A (Technician T1)
- WHEN dispatcher reassigns to Technician T2
- THEN Assignment A status changes to 'replaced'
- AND Assignment B created with status 'assigned'
- AND both records contain full audit data

### Requirement: Audit Fields

The system MUST record complete audit information for each assignment. Each record SHALL include:

- Previous technician ID (or null for new)
- New technician ID
- Assignment type (initial/replacement/emergency)
- Reason for change
- User who made the change
- Timestamp
- Observations/notes

#### Scenario: New assignment audit

- GIVEN WorkOrder has no existing assignment
- WHEN dispatcher assigns Technician T1
- THEN previousTechnicianId is null
- AND type is 'initial'
- AND assignedBy is current user
- AND assignedAt is current timestamp

#### Scenario: Replacement audit

- GIVEN WorkOrder has Assignment A (T1)
- WHEN dispatcher replaces with T2 due to "availability"
- THEN previousTechnicianId = T1._id
- AND type = 'replacement'
- AND reason = 'availability'
- AND replacedAt added to Assignment A
- AND new Assignment B references A.replacedByAssignmentId

### Requirement: Assignment Type

The system MUST support multiple assignment types. The type SHALL be one of:

- initial: First assignment for a WorkOrder
- replacement: Technician swapped after initial
- emergency: Urgent reassignment outside normal process

#### Scenario: Emergency assignment

- GIVEN WorkOrder in urgent status
- WHEN dispatcher uses emergency assignment
- THEN type = 'emergency'
- AND reason is required
- AND notification sent to new technician

### Requirement: Query Assignment History

The system MUST allow querying full assignment history for any WorkOrder. The query SHALL return:

- All assignments in chronological order (oldest first)
- Each with full audit fields
- Replacement chain visible

#### Scenario: History query

- GIVEN WorkOrder has 3 assignments (T1 → T2 → T3)
- WHEN fetching assignment history
- THEN returns array of 3 records
- AND each shows previousTechnicianId
- AND chain is traceable