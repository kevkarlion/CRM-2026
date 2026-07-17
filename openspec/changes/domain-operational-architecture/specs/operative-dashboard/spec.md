# Operative Dashboard Specification

## Purpose

Real-time operational visibility for dispatchers and managers. Mobile-first design for field access.

## Requirements

### Requirement: Dashboard Metrics Display

The system MUST display operational metrics in near real-time. The dashboard SHALL show:

- Pending WorkOrders count
- Urgent WorkOrders count (priority = emergency | overdue)
- Delayed WorkOrders count (past due date)
- Unassigned WorkOrders count
- In-progress WorkOrders count
- WorkOrders pending technical report count

#### Scenario: Dashboard loads with data

- GIVEN WorkOrders exist in various states
- WHEN user accesses /operations/dashboard
- THEN all metric counters display current counts
- AND data is no older than 60 seconds

#### Scenario: Empty state

- GIVEN no WorkOrders exist
- WHEN dashboard loads
- THEN all counters show 0
- AND "No pending work" message displays

### Requirement: Technician Workload View

The system MUST display each technician's current workload. For each technician, the view SHALL show:

- Assigned WorkOrder count for today
- Availability status (available/busy/unavailable)
- Daily load percentage (assigned / maxDailyWorkOrders)

#### Scenario: Technician workload displays

- GIVEN technicians have WorkAssignments
- WHEN workload view loads
- THEN each technician row shows count and percentage
- AND unavailable technicians are visually distinguished

### Requirement: Agenda View

The system MUST provide calendar-based scheduling views. The agenda SHALL support:

- Daily view (default)
- Weekly view
- Monthly view

#### Scenario: Weekly agenda displays

- GIVEN WorkOrders have scheduled dates
- WHEN user selects weekly view
- THEN WorkOrders appear on their scheduled day
- AND time slots are visible when available

### Requirement: Next Actions

The system MUST surface immediate action items. The dashboard SHALL show:

- WorkOrders requiring immediate technician assignment
- WorkOrders with approaching scheduled time
- WorkOrders pending report submission超过 24 hours

#### Scenario: Action items prioritized

- GIVEN multiple WorkOrders need attention
- WHEN next actions loads
- THEN items sorted by urgency and due date
- AND each item shows suggested action

## ADDED Requirements

### Requirement: Mobile-First Responsive Design

The dashboard MUST render correctly on mobile devices (320px+). The interface SHALL adapt layout for:

- Single column on mobile
- Two columns on tablet (768px+)
- Three columns on desktop (1024px+)

#### Scenario: Mobile viewport

- GIVEN user accesses dashboard on 375px width
- WHEN page renders
- THEN all metrics visible without horizontal scroll
- AND touch targets minimum 44px

#### Scenario: Desktop viewport

- GIVEN user accesses dashboard on 1440px width
- WHEN page renders
- THEN three-column layout displays
- AND sidebar navigation visible