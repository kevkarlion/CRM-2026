# Technician Work Execution Specification

## Purpose

Allow assigned technicians to execute WorkOrders (OT) and Technical Visits (VT) by recording start and completion. The workflow is: assigned → in_progress → completed. Only the assigned technician can initiate work.

## ADDED Requirements

### Requirement: Start Work Execution

The system MUST allow the assigned technician to start work on a WorkOrder or Technical Visit that is in 'assigned' status. The system SHALL change status to 'in_progress' and mark the technician as busy.

#### Scenario: Technician starts assigned WorkOrder

- GIVEN WorkOrder with status = 'assigned'
- AND current user is the assigned technician (matched by userId)
- WHEN technician clicks "Iniciar trabajo"
- THEN status changes to 'in_progress'
- AND startedAt = current timestamp
- AND startedBy = current user's ObjectId
- AND technician.availability = 'busy'

#### Scenario: Start blocked for non-assigned technician

- GIVEN WorkOrder with status = 'assigned'
- AND current user is NOT the assigned technician
- WHEN attempting to start work
- THEN 403 Forbidden returned
- AND status remains 'assigned'

#### Scenario: Start blocked for wrong status

- GIVEN WorkOrder with status = 'in_progress'
- AND assigned technician attempts to start again
- THEN 400 Bad Request returned
- AND error message: "Work already in progress"

### Requirement: Complete Work Execution

The system MUST require the technician to submit a WorkReport when completing work. The WorkReport MUST contain the result as mandatory field.

#### Scenario: Technician completes WorkOrder with result

- GIVEN WorkOrder with status = 'in_progress'
- AND current user is the assigned technician
- WHEN technician submits WorkReport with result field
- THEN status changes to 'completed'
- AND finishedAt = current timestamp
- AND technician.availability = 'available'
- AND workReportId = created WorkReport._id

#### Scenario: Complete blocked without result

- GIVEN WorkOrder with status = 'in_progress'
- AND technician submits WorkReport without result field
- THEN 400 Bad Request returned
- AND validation error: "Result is required"
- AND status remains 'in_progress'
- AND technician.availability remains 'busy'

#### Scenario: Availability rollback on save failure

- GIVEN WorkOrder status = 'in_progress'
- AND technician submits WorkReport
- WHEN database save fails
- THEN technician.availability reverts to 'available'
- AND error returned to user

### Requirement: WorkReport Entity Schema

The system MUST store work execution data in a WorkReport entity with the following fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| tenantId | ObjectId | Yes | Tenant reference |
| workOrderId | ObjectId | Yes | Reference to WorkOrder |
| technicalVisitId | ObjectId | No | Reference to TechnicalVisit (if VT) |
| technicianId | ObjectId | Yes | Technician who performed work |
| result | String | Yes | Service result (enum) |
| workPerformed | String[] | No | Work items performed (multi-select) |
| workPerformedOther | String | No | Other work description |
| hasObservations | Boolean | No | Has important observations |
| observationsText | String | No | Observation details |
| hasAdditionalIssues | Boolean | No | Has additional problems |
| additionalIssues | String[] | No | Problem types (multi-select) |
| additionalIssuesText | String | No | Problem description |
| nextVisitRecommendation | String | No | Follow-up recommendation |
| startedAt | Date | Yes | Work start timestamp |
| finishedAt | Date | Yes | Work completion timestamp |
| version | Number | No | Optimistic locking |

#### Scenario: WorkReport linked to WorkOrder

- GIVEN WorkOrder completed with WorkReport
- WHEN WorkReport is saved
- THEN workReportId populated in WorkOrder
- AND WorkReport queryable by workOrderId

### Requirement: Form Field Definitions

The completion form MUST contain the following fields:

**1. Resultado del servicio (required)**
- Type: Single select dropdown
- Options: completado, parcial, pendiente_materiales, no_se_pudo_completar, cancelado, requiere_seguimiento

**2. Trabajos realizados**
- Type: Multi-select checkboxes
- Options: instalacion, mantenimiento, reparacion, inspeccion, configuracion, prueba_funcionamiento, limpieza, calibracion, reemplazo_pieza, diagnostico, asesoramiento

**3. Observaciones importantes**
- Type: Conditional (Yes/No toggle + text area)
- Fields: hasObservations (boolean), observationsText (string, max 500 chars)

**4. Problemas adicionales**
- Type: Conditional (Yes/No toggle + multi-select)
- Fields: hasAdditionalIssues (boolean), additionalIssues (string[])

**5. Recomendación de nueva visita**
- Type: Single select dropdown
- Options: no_se_requiere, rutinario, urgente, pendiente_aprobacion, garantia, verificacion

### Requirement: API Contracts

#### POST /api/operations/work-orders/{id}/start

Request: Empty body (no form data needed)

Response (200):
```json
{
  "success": true,
  "data": {
    "status": "in_progress",
    "startedAt": "2026-07-31T10:00:00.000Z",
    "startedBy": "user-id"
  }
}
```

#### POST /api/operations/work-orders/{id}/complete

Request:
```json
{
  "result": "completado",
  "workPerformed": ["mantenimiento", "prueba_funcionamiento"],
  "hasObservations": true,
  "observationsText": "Equipo en buen estado",
  "hasAdditionalIssues": false,
  "nextVisitRecommendation": "rutinario"
}
```

Response (200):
```json
{
  "success": true,
  "data": {
    "status": "completed",
    "finishedAt": "2026-07-31T12:30:00.000Z",
    "workReportId": "report-id"
  }
}
```

#### POST /api/operations/technical-visits/{id}/start

Same contract as WorkOrder start

#### POST /api/operations/technical-visits/{id}/complete

Same contract as WorkOrder complete

#### GET /api/operations/work-orders/{id}/work-report

Response (200):
```json
{
  "success": true,
  "data": { WorkReport object }
}
```

### Requirement: Activity Events

The system MUST register the following activity events automatically:

| Event | Trigger | Fields |
|-------|---------|--------|
| work_started | Technician clicks "Iniciar trabajo" | workOrderId/technicalVisitId, technicianId, timestamp, oldStatus, newStatus |
| work_completed | Technician submits WorkReport | workOrderId/technicalVisitId, technicianId, timestamp, result, workReportId |
| work_report_created | WorkReport saved | workReportId, workOrderId/technicalVisitId |

#### Scenario: Activity logged on work start

- GIVEN WorkOrder status = 'assigned'
- WHEN technician starts work
- THEN activity created with type = 'work_started'
- AND includes oldStatus = 'assigned', newStatus = 'in_progress'

#### Scenario: Activity logged on work completion

- GIVEN WorkOrder status = 'in_progress'
- WHEN technician completes work
- THEN activity created with type = 'work_completed'
- AND includes result from WorkReport