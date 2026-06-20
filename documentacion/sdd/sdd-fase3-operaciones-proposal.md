# SDD Proposal: Fase 3 — Operaciones, Work Orders y Dispatching

> **Change name**: `fase-3-operaciones`
> **Estado**: Proposal
> **Stack**: Next.js, TypeScript, MongoDB Atlas, Mongoose
> **Basado en**: Fase 1 (v0.1.0 — Platform Foundation) + Fase 2 (v0.2.0 — CRM Business Model)

---

## 1. Intent

Construir el núcleo operativo del sistema — Work Orders, Scheduling, Dispatching, Technician Assignments, Checklists, Workflow Operacional e Historial Operacional.

El módulo `src/operations/` habilita el ciclo de vida completo de una orden de trabajo: desde su creación en estado `draft`, pasando por asignación, ruteo, ejecución en sitio, hasta su cierre y reporte de visita. Es el puente entre la gestión comercial (CRM, Phase 2) y la ejecución técnica en campo.

**Principios de diseño:**
- Separación estricta: `src/operations/` es un módulo top-level nuevo, no mezclado con CRM.
- Los Work Orders referencian entidades CRM (Client, Location, Equipment) via `ObjectId`, pero no las poseen.
- El timeline operacional (`WorkOrderEvent`) coexiste con `ActivityLog` de core — WorkOrderEvent es específico de operaciones, ActivityLog es cross-entity audit genérico.
- Attachments se reusan via el sistema polimórfico existente (`entityType: "workOrder"`).
- Soft-delete en todas las entidades de negocio siguiendo el patrón de Phase 2.

---

## 2. Entities

### 2.1 WorkOrder

Entidad central. Representa una orden de trabajo de principio a fin.

| Campo | Tipo | Requerido | Default | Descripción |
|---|---|---|---|---|
| `_id` | ObjectId | auto | — | |
| `tenantId` | ObjectId (ref: Tenant) | sí | — | Scope multitenant |
| `clientId` | ObjectId (ref: Client) | sí | — | Cliente asociado |
| `locationId` | ObjectId (ref: Location) | sí | — | Ubicación del servicio |
| `equipmentId` | ObjectId (ref: Equipment) | no | null | Equipo específico (opcional) |
| `workOrderNumber` | String | sí | auto-generado | Formato: `WO-{tenant}-{YYYYMMDD}-{XXXX}` |
| `title` | String | sí | — | Título corto de la orden |
| `description` | String | no | — | Descripción detallada |
| `priority` | String | sí | `normal` | `low \| normal \| high \| urgent \| emergency` |
| `category` | String | sí | — | `installation \| maintenance \| repair \| inspection \| warranty \| emergency` |
| `status` | String | sí | `draft` | Ver state machine |
| `scheduledDate` | Date | no | — | Fecha programada |
| `scheduledStart` | Date | no | — | Hora inicio programada |
| `scheduledEnd` | Date | no | — | Hora fin programada |
| `estimatedDuration` | Number | no | — | Duración estimada en minutos |
| `assignedTechnicians` | [ObjectId] (ref: User) | no | [] | Técnicos asignados actuales |
| `createdBy` | ObjectId (ref: User) | sí | — | Audit field |
| `updatedBy` | ObjectId (ref: User) | sí | — | Audit field |
| `deletedBy` | ObjectId (ref: User) | no | — | Audit field |
| `deletedAt` | Date | no | null | Soft-delete |
| `createdAt` | Date | auto | — | Timestamps |
| `updatedAt` | Date | auto | — | Timestamps |

#### Tipos auxiliares

```typescript
export type WorkOrderPriority = 'low' | 'normal' | 'high' | 'urgent' | 'emergency';
export type WorkOrderCategory = 'installation' | 'maintenance' | 'repair' | 'inspection' | 'warranty' | 'emergency';
export type WorkOrderStatus =
  | 'draft'
  | 'scheduled'
  | 'confirmed'
  | 'assigned'
  | 'en_route'
  | 'on_site'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'closed';

export type CreateWorkOrderInput = Omit<
  IWorkOrder,
  keyof Document | '_id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedBy' | 'deletedAt' | 'workOrderNumber'
>;

export type UpdateWorkOrderInput = Partial<Omit<CreateWorkOrderInput, 'tenantId' | 'clientId'>>;
```

### 2.2 WorkOrderAssignment

Tracking individual de asignaciones. Una WorkOrder puede tener múltiples asignaciones (histórico), pero solo una activa por técnico.

| Campo | Tipo | Requerido | Default | Descripción |
|---|---|---|---|---|
| `_id` | ObjectId | auto | — | |
| `tenantId` | ObjectId (ref: Tenant) | sí | — | Scope multitenant |
| `workOrderId` | ObjectId (ref: WorkOrder) | sí | — | Orden asociada |
| `technicianId` | ObjectId (ref: User) | sí | — | Técnico asignado |
| `assignedBy` | ObjectId (ref: User) | sí | — | Quién asignó |
| `assignedAt` | Date | sí | — | Momento de asignación |
| `status` | String | sí | `assigned` | `assigned \| acknowledged \| declined \| replaced` |
| `acknowledgedAt` | Date | no | — | Cuándo confirmó el técnico |
| `declinedAt` | Date | no | — | Cuándo rechazó |
| `replacedAt` | Date | no | — | Cuándo fue reemplazado |
| `replacedByAssignmentId` | ObjectId | no | — | Asignación que reemplazó esta |
| `notes` | String | no | — | Nota del dispatch |
| `createdAt` | Date | auto | — | |
| `updatedAt` | Date | auto | — | |

### 2.3 PreVisitChecklist

Checklist obligatorio antes de salir a ruta. Sin checklist completado, no se puede transicionar a `en_route`.

| Campo | Tipo | Requerido | Default | Descripción |
|---|---|---|---|---|
| `_id` | ObjectId | auto | — | |
| `tenantId` | ObjectId (ref: Tenant) | sí | — | Scope multitenant |
| `workOrderId` | ObjectId (ref: WorkOrder) | sí | — | 1:1 con WorkOrder |
| `workOrderReviewed` | Boolean | sí | false | Revisó los detalles de la orden |
| `toolsPrepared` | Boolean | sí | false | Herramientas listas |
| `partsAvailable` | Boolean | sí | false | Repuestos disponibles |
| `routeConfirmed` | Boolean | sí | false | Ruta confirmada |
| `vehicleAssigned` | Boolean | sí | false | Vehículo asignado |
| `safetyEquipmentChecked` | Boolean | sí | false | EPP verificado |
| `notes` | String | no | — | Notas del técnico |
| `completedBy` | ObjectId (ref: User) | sí | — | Técnico que completó |
| `completedAt` | Date | sí | — | Momento de finalización |
| `createdAt` | Date | auto | — | |
| `updatedAt` | Date | auto | — | |

### 2.4 WorkOrderEvent

Timeline operacional detallado. Append-only. Cada transición de estado, asignación o acción relevante genera un evento.

| Campo | Tipo | Requerido | Default | Descripción |
|---|---|---|---|---|
| `_id` | ObjectId | auto | — | |
| `tenantId` | ObjectId (ref: Tenant) | sí | — | Scope multitenant |
| `workOrderId` | ObjectId (ref: WorkOrder) | sí | — | Orden asociada |
| `eventType` | String | sí | — | Ver tipos abajo |
| `description` | String | sí | — | Texto legible del evento |
| `performedBy` | ObjectId (ref: User) | sí | — | Usuario que ejecutó la acción |
| `metadata` | Record<string, unknown> | no | — | Payload adicional (ej: `{ from: 'draft', to: 'scheduled' }`) |
| `createdAt` | Date | auto | — | |

**Event types:**

```
created | assigned | status_changed | checklist_completed
technician_changed | visit_started | visit_completed
attachment_uploaded | note_added | closed | rescheduled
```

### 2.5 VisitReport

Reporte generado al finalizar una visita en sitio.

| Campo | Tipo | Requerido | Default | Descripción |
|---|---|---|---|---|
| `_id` | ObjectId | auto | — | |
| `tenantId` | ObjectId (ref: Tenant) | sí | — | Scope multitenant |
| `workOrderId` | ObjectId (ref: WorkOrder) | sí | — | 1:1 con WorkOrder |
| `technicianId` | ObjectId (ref: User) | sí | — | Técnico que reporta |
| `arrivalTime` | Date | sí | — | Hora de llegada |
| `departureTime` | Date | sí | — | Hora de salida |
| `workPerformed` | String | sí | — | Descripción del trabajo realizado |
| `observations` | String | no | — | Observaciones |
| `recommendations` | String | no | — | Recomendaciones al cliente |
| `customerSignature` | ObjectId (ref: Attachment) | no | — | Firma digital (Attachment ref) |
| `createdBy` | ObjectId (ref: User) | sí | — | Audit field |
| `updatedBy` | ObjectId (ref: User) | sí | — | Audit field |
| `createdAt` | Date | auto | — | |
| `updatedAt` | Date | auto | — | |

---

## 3. State Machine — WorkOrder

### Transiciones

```
┌──────────┐
│   draft  │ ──────────────────────────────────────┐
└────┬─────┘                                       │
     │ schedule                                     │
     ▼                                              │
┌──────────┐                                        │
│ scheduled │ ─── confirm ───┐                      │
└──────────┘                 │                      │
     │ assign                │                      │
     ▼                       ▼                      │
┌──────────┐          ┌───────────┐                 │
│ assigned │          │ confirmed │                 │
└──────────┘          └─────┬─────┘                 │
     │ acknowledge           │ assign                │
     ▼                       ▼                      │
┌──────────┐          ┌───────────┐                 │
│ en_route │◄─────────│ assigned  │                 │
└────┬─────┘ (ack)    └───────────┘                 │
     │ arrive                                        │
     ▼                                               │
┌──────────┐     ─── pause ──▶ ┌───────┐            │
│  on_site │                   │ paused│            │
└────┬─────┘ ◀── resume ────── └───────┘            │
     │ complete                                      │
     ▼                                               │
┌──────────┐                                        │
│completed │                                        │
└────┬─────┘                                        │
     │ close                                         │
     ▼                                               │
┌──────────┐                                        │
│  closed  │                                        │
└──────────┘                                        │
                                                    │
               ┌───────────┐                        │
               │ cancelled │ ◀───────────────────────┘
               └───────────┘  (desde cualquier estado
                                excepto closed)
```

### Tabla de transiciones válidas

| Estado actual | Transiciones permitidas |
|---|---|
| `draft` | `scheduled`, `cancelled` |
| `scheduled` | `confirmed`, `assigned`, `cancelled` |
| `confirmed` | `assigned`, `cancelled` |
| `assigned` | `en_route` (requiere checklist), `cancelled` |
| `en_route` | `on_site`, `cancelled` |
| `on_site` | `paused`, `completed`, `cancelled` |
| `paused` | `on_site` (resume), `cancelled` |
| `completed` | `closed` |
| `cancelled` | — (terminal) |
| `closed` | — (terminal) |

### Reglas de integridad

1. **Checklist obligatorio**: Transición `assigned → en_route` requiere `PreVisitChecklist` completado con todos los checkboxes en `true`.
2. **No retroceso**: Nunca se puede volver a un estado anterior (ej: `on_site → assigned`). Solo `paused → on_site` (resume) es la excepción natural.
3. **Reasignación**: Si un técnico es reemplazado, crear nueva `WorkOrderAssignment` con status `assigned`, marcar la anterior como `replaced`. La WorkOrder mantiene el estado actual.
4. **Soft-delete**: Una WorkOrder puede ser soft-deleteada solo si está en `draft` o `cancelled`.
5. **VisitReport obligatorio**: Transición `on_site → completed` requiere `VisitReport`.
6. **Closed es irreversible**: `completed → closed` es el cierre final. No hay reapertura.

---

## 4. Relaciones

### Diagrama de Entidades

```
┌─────────────────────────────────────────────────────────────┐
│                        src/operations/                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────┐      ┌──────────────────────────┐ │
│  │  PreVisitChecklist   │ 1:1  │       WorkOrder          │ │
│  │  ┌──────────────────┐│──────│───────────────────────── │ │
│  │  │ workOrderId       ││      │ _id                     │ │
│  │  │ (6 booleans)      ││      │ clientId ───────────────┼──
│  │  │ completedBy       ││      │ locationId ─────────────┼──
│  │  │ completedAt       ││      │ equipmentId ────────────┼──
│  └──────────────────────┘      │ assignedTechnicians[]───┼──
│                                │ workOrderNumber          │ │
│  ┌──────────────────────┐      │ (auto-generated)         │ │
│  │  WorkOrderAssignment │      │ status (state machine)   │ │
│  │  ┌──────────────────┐│      │ priority, category       │ │
│  │  │ workOrderId ─────┼┤      │ scheduledDate/Start/End  │ │
│  │  │ technicianId      ││      │ estimatedDuration        │ │
│  │  │ assignedBy        ││      └──────────────────┬───────┘ │
│  │  │ status            ││                         │        │
│  │  │ acknowledgedAt    ││                         │ 1:N    │
│  │  │ declinedAt        ││                         ▼        │
│  │  │ replacedBy        ││      ┌──────────────────────────┐│
│  └──────────────────────┘      │    WorkOrderEvent          ││
│                                │  ┌──────────────────────┐  ││
│  ┌──────────────────────┐      │  │ workOrderId           │  ││
│  │    VisitReport        │      │  │ eventType             │  ││
│  │  ┌──────────────────┐│      │  │ description            │  ││
│  │  │ workOrderId ─────┼┤──────│  │ performedBy            │  ││
│  │  │ technicianId      ││      │  │ metadata               │  ││
│  │  │ arrivalTime       ││      │  │ createdAt (cursor)     │  ││
│  │  │ departureTime     ││      └──────────────────────────┘  ││
│  │  │ workPerformed     ││                                    ││
│  │  │ customerSignature ││─── Attachment (entityType:"workOrder")
│  └──────────────────────┘                                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ (referencias a módulos existentes)
                            ▼
  ┌─────────┐   ┌──────────┐   ┌───────────┐   ┌─────────┐
  │  Client │   │ Location │   │ Equipment  │   │  User   │
  │ (CRM)    │   │ (CRM)    │   │ (CRM)      │   │ (Core)  │
  └─────────┘   └──────────┘   └───────────┘   └─────────┘
                          ┌────────────┐
                          │ Attachment │
                          │ (CRM)      │
                          └────────────┘
```

### Reglas de referencia

| Entidad Operaciones | Refiere a | Módulo | Cardinalidad |
|---|---|---|---|
| WorkOrder.clientId | Client | CRM | N:1 |
| WorkOrder.locationId | Location | CRM | N:1 |
| WorkOrder.equipmentId | Equipment | CRM | N:1 (opcional) |
| WorkOrder.assignedTechnicians[] | User | Core | N:M |
| WorkOrderAssignment.technicianId | User | Core | N:1 |
| PreVisitChecklist.workOrderId | WorkOrder | Operations | 1:1 |
| WorkOrderEvent.workOrderId | WorkOrder | Operations | N:1 |
| VisitReport.workOrderId | WorkOrder | Operations | 1:1 |
| Attachment.entityType = "workOrder" | WorkOrder | CRM | N:1 (polimórfico) |

---

## 5. Estrategia de Índices

### WorkOrder

| Índice | Propósito |
|---|---|
| `{ tenantId: 1, status: 1, scheduledDate: -1 }` | Filtro principal: WO por tenant + estado + fecha |
| `{ tenantId: 1, workOrderNumber: 1 }` | Búsqueda exacta por número de orden (único) |
| `{ tenantId: 1, clientId: 1, status: 1 }` | Histórico de WO de un cliente |
| `{ tenantId: 1, assignedTechnicians: 1, status: 1 }` | WO activas de un técnico |
| `{ tenantId: 1, scheduledDate: 1, status: 1 }` | Agenda del día (scheduled + confirmed + assigned + en_route) |
| `{ tenantId: 1, deletedAt: 1 }` | Filtro soft-delete global |

### WorkOrderAssignment

| Índice | Propósito |
|---|---|
| `{ tenantId: 1, workOrderId: 1, technicianId: 1 }` | Unique: una asignación activa por técnico+WO |
| `{ tenantId: 1, technicianId: 1, status: 1 }` | Carga de trabajo de un técnico |
| `{ tenantId: 1, workOrderId: 1, status: 1 }` | Asignaciones actuales de una WO |

### PreVisitChecklist

| Índice | Propósito |
|---|---|
| `{ tenantId: 1, workOrderId: 1 }` | Unique: una checklist por WO |

### WorkOrderEvent

| Índice | Propósito |
|---|---|
| `{ tenantId: 1, workOrderId: 1, createdAt: -1 }` | Timeline: cursor pagination |
| `{ tenantId: 1, eventType: 1, createdAt: -1 }` | Filtro por tipo de evento |

### VisitReport

| Índice | Propósito |
|---|---|
| `{ tenantId: 1, workOrderId: 1 }` | Unique: un report por WO |
| `{ tenantId: 1, technicianId: 1, createdAt: -1 }` | Historial de reportes del técnico |

---

## 6. Riesgos y Mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| **Race condition en status transitions** | Dos requests cambian estado simultáneamente → estado inconsistente | Usar `findOneAndUpdate` con filter de estado actual (`{ _id, status: 'assigned' }` → `$set: { status: 'en_route' }`). Si no matchea, error de concurrencia. |
| **Overlap detection en scheduling** | Técnico asignado a dos WO en el mismo horario | Validación en service layer: query de WO del técnico en el rango horario antes de asignar. Índice compuesto para detección rápida. |
| **WorkOrderEvent volume** | Miles de eventos por WO saturan queries | Index `{ tenantId, workOrderId, createdAt }` con cursor pagination. Eventos append-only, sin update. Archivo histórico opcional vía TTL parcial a futuro. |
| **Checklist olvidada** | Técnico sale a ruta sin checklist | Regla en service: `assigned → en_route` es bloqueante si no hay checklist completa. El service valida y lanza `ValidationError`. |
| **Reasignación inconsistente** | Dos asignaciones activas para el mismo técnico en la misma WO | Unique compound index `{ workOrderId, technicianId }` para evitar duplicados activos. Antes de crear nueva, marcar la anterior como `replaced`. |
| **Soft-delete de WorkOrder activa** | Se borra lógicamente una WO que está en ejecución | Regla en service: solo permitir soft-delete si status es `draft` o `cancelled`. |
| **Fecha mal programada (pasado)** | WO se agenda en el pasado | Validación: `scheduledDate >= today` al crear/actualizar. |
| **VisitReport sin WorkOrder completada** | Reporte creado antes de completar trabajo | Regla: `VisitReport` solo se puede crear si WorkOrder status es `on_site`. Service valida y lanza error. |

---

## 7. Archivos Estimados y Complejidad

### Estructura de archivos

```
src/operations/
├── types/
│   ├── index.ts                       # Barrel export
│   ├── work-order.ts                  # IWorkOrder, CreateWorkOrderInput, UpdateWorkOrderInput
│   ├── work-order-assignment.ts       # IWorkOrderAssignment
│   ├── pre-visit-checklist.ts         # IPreVisitChecklist
│   ├── work-order-event.ts            # IWorkOrderEvent
│   └── visit-report.ts                # IVisitReport
├── schemas/
│   ├── work-order.ts                  # workOrderSchema + indexes
│   ├── work-order-assignment.ts       # workOrderAssignmentSchema + indexes
│   ├── pre-visit-checklist.ts         # preVisitChecklistSchema + indexes
│   ├── work-order-event.ts            # workOrderEventSchema + indexes
│   └── visit-report.ts                # visitReportSchema + indexes
├── models/
│   ├── index.ts                       # Barrel export
│   ├── work-order.ts                  # WorkOrderModel
│   ├── work-order-assignment.ts       # WorkOrderAssignmentModel
│   ├── pre-visit-checklist.ts         # PreVisitChecklistModel
│   ├── work-order-event.ts            # WorkOrderEventModel
│   └── visit-report.ts                # VisitReportModel
├── services/
│   ├── work-order.service.ts          # CRUD + state machine + scheduling
│   ├── work-order-assignment.service.ts  # Assign, acknowledge, decline, replace
│   ├── pre-visit-checklist.service.ts    # CRUD + validación de completitud
│   ├── work-order-event.service.ts       # Append-only event logging
│   └── visit-report.service.ts           # CRUD + validación de estado
├── helpers/
│   ├── state-machine.ts               # Transiciones válidas, validación de reglas
│   └── overlap-detection.ts           # Detección de conflictos horarios
└── index.ts                           # Barrel público del módulo
```

### Estimación

| Aspecto | Cantidad |
|---|---|
| **Entidades nuevas** | 5 (WorkOrder, WorkOrderAssignment, PreVisitChecklist, WorkOrderEvent, VisitReport) |
| **Archivos TypeScript** | ~22 (5 types + 5 schemas + 5 models + 1 barrel model + 5 services + 2 helpers + 1 barrel module) |
| **Índices MongoDB** | ~15 |
| **Reglas de integridad** | 6 (checklist obligatorio, no retroceso, reasignación, soft-delete restringido, visit report obligatorio, closed irreversible) |
| **Validaciones de estado** | ~15 transiciones posibles (vs ~25 inválidas) |
| **Complejidad relativa** | Alta — state machine con 10 estados y scheduling con overlap detection agregan complejidad sobre CRUD puro de Phase 2 |

### Dependencias entre PRs (feature-branch-chain)

```
main (v0.2.0)
└── feature/operations (tracker branch)
    ├── PR1: Types + Schemas + Models (5 entidades base)
    ├── PR2: State machine + WorkOrder service (CRUD + transiciones)
    ├── PR3: Scheduling + Overlap detection + Assignment service
    ├── PR4: PreVisitChecklist + WorkOrderEvent (append-only timeline)
    └── PR5: VisitReport + Cursor pagination + Barrel público
```

### Reuso de módulos existentes

| Módulo existente | Uso en Operations |
|---|---|
| `crm/models/attachment` | Adjuntar archivos a WorkOrder via `entityType: "workOrder"` |
| `crm/helpers/cursor-pagination` | Paginación de WorkOrderEvent (cursor por `createdAt`) |
| `audit/activity-logger` | Auditoría cross-entity (coexiste con WorkOrderEvent) |
| `core/models/user` | Referencia a técnicos (`assignedTechnicians`, `technicianId`) |
| `crm/models/client` | Referencia a cliente (`clientId`) |
| `crm/models/location` | Referencia a ubicación (`locationId`) |
| `crm/models/equipment` | Referencia a equipo (`equipmentId`, opcional) |
