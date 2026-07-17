# Technician Management Specification

## Purpose

Complete technician lifecycle management tied to User entities. Support availability tracking and zone-based assignment.

## Requirements

### Requirement: Create Technician

The system MUST allow creating a technician profile. The technician SHALL be linked to an existing User or created standalone.

#### Scenario: Create technician from user

- GIVEN User U exists in system
- WHEN admin creates technician with userId = U._id
- THEN technician created with userId reference
- AND email/phone pulled from user if not provided

#### Scenario: Create standalone technician

- GIVEN no matching User exists
- WHEN admin creates technician without userId
- THEN technician created with null userId
- AND name, email, phone required fields

### Requirement: Technician Status

The system MUST track technician operational status. The status field SHALL be one of:

- active: Can receive assignments
- inactive: Cannot receive assignments
- on_leave: Temporarily unavailable

#### Scenario: Set technician on leave

- GIVEN technician with status = 'active'
- WHEN admin sets status to 'on_leave'
- THEN status updated
- AND availability automatically set to 'unavailable'
- AND existing assignments remain unchanged

### Requirement: Technician Availability

The system MUST track real-time availability for dispatching. The availability field SHALL be one of:

- available: Can accept new WorkOrders
- busy: Currently on a WorkOrder
- unavailable: Cannot accept (leave, etc.)

#### Scenario: Availability auto-updates

- GIVEN technician has availability = 'available'
- WHEN WorkOrder status changes to 'on_site'
- THEN technician availability = 'busy'
- AND when WorkOrder completes, availability = 'available'

### Requirement: Zone Management

The system MUST support geographic zone assignment. Each technician MAY have multiple zones assigned.

#### Scenario: Filter by zone

- GIVEN technicians have zones [North, East, South]
- WHEN dispatcher filters by zone = 'North'
- THEN only technicians with 'North' in zones returned

### Requirement: Specialty Management

The system MUST support skill-based categorization. Each technician MAY have multiple specialties.

#### Scenario: Filter by specialty

- GIVEN technicians have specialties [HVAC, Electrical, Plumbing]
- WHEN dispatcher filters by specialty = 'HVAC'
- THEN only technicians with 'HVAC' in specialties returned

### Requirement: Daily Capacity

The system MUST enforce maximum daily WorkOrder limit. Each technician SHALL have maxDailyWorkOrders (default 5).

#### Scenario: Capacity check before assignment

- GIVEN technician with maxDailyWorkOrders = 5
- AND technician has 5 assignments for today
- WHEN dispatcher attempts assignment
- THEN system warns capacity reached
- AND assignment blocked or requires override