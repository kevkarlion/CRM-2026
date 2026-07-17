# Work Report Completion Specification

## Purpose

Technical report workflow from field execution to WorkOrder closure. Enhance existing visit-report into formal work report.

## Requirements

### Requirement: Create Work Report

The system MUST allow technicians to submit technical reports. The report SHALL be linked to:

- WorkOrder (required)
- Technician (from assignment)
- Client location (from WorkOrder)

#### Scenario: Technician submits report

- GIVEN WorkOrder in 'on_site' status
- AND technician is currently assigned
- WHEN technician submits work report
- THEN report created with WorkOrder reference
- AND WorkOrder status changes to 'pending_review'

### Requirement: Report Required Fields

The work report MUST contain minimum required information:

- WorkOrder reference
- Technician who performed work
- Service performed (description)
- Parts used (optional, array)
- Time started
- Time completed
- Resolution status: completed/partial/pending_parts/cannot_complete

#### Scenario: Complete report submission

- GIVEN all required fields provided
- WHEN technician submits
- THEN report saved
- AND WorkOrder status updated

#### Scenario: Incomplete report

- GIVEN required field missing (e.g., time completed)
- WHEN technician submits
- THEN validation error
- AND submission blocked

### Requirement: Resolution Tracking

The system MUST track work resolution outcome. Resolution status options:

- completed: All work finished
- partial: Some items incomplete
- pending_parts: Waiting for materials
- cannot_complete: Unable to resolve

#### Scenario: Partial completion

- GIVEN technician completes 2 of 3 tasks
- WHEN report submitted with resolution = 'partial'
- THEN notes must describe remaining work
- AND WorkOrder remains open

### Requirement: Report Attachments

The system MAY support attachments (photos, signatures). Attachments SHALL be:

- Linked to report via reference
- Store URL/path only (not blob)

#### Scenario: Photo attachment

- GIVEN technician captures photo
- WHEN photo uploaded
- THEN reference stored in report.attachments
- AND photo viewable in report detail

### Requirement: Report Approval Flow

The system MAY require supervisor approval. When enabled:

- Submitted reports set WorkOrder to 'pending_approval'
- Supervisor reviews and approves/rejects
- On approval, WorkOrder moves to 'completed'

#### Scenario: Approval required workflow

- GIVEN WorkOrder requires approval
- WHEN technician submits report
- THEN WorkOrder status = 'pending_approval'
- AND supervisor notified
- AND when approved, status = 'completed'