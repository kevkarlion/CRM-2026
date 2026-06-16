# SDD Design: Fase 3 — Operaciones, Work Orders y Dispatching

> **Change name**: `fase-3-operaciones`
> **Estado**: Design
> **Stack**: Next.js, TypeScript, MongoDB Atlas, Mongoose
> **Basado en**: SDD Spec (aprobado)

---

## 1. Technical Approach Overview

El módulo `src/operations/` se implementa como un módulo top-level con dependencias unidireccionales:
- **Operations → CRM**: WorkOrder referencia Client, Location, Equipment (lectura de ObjectId)
- **Operations → Core**: WorkOrder referencia User (technician), ActivityLog para auditoría cross-entity
- **No hay dependencia inversa**: CRM no importa ni conoce Operations

### Principios de implementación
- State machine pura en helper functions (sin middleware de Mongoose)
- Snapshots embebidos como sub-documentos `{ _id: false }`
- WorkOrderAssignment como colección canónica + array denormalizado en WorkOrder
- Transiciones atómicas via `findOneAndUpdate` con filter de status actual
- Eventos operativos en WorkOrderEvent + auditoría cross-entity en ActivityLog

---

## 2. Architecture Decisions

| Decisión | Opción Elegida | Alternativas | Por qué |
|---|---|---|---|
| State machine enforcement | Service-layer validation function | Mongoose middleware, DB trigger | Service layer tiene acceso a todo el contexto (checklist, visit report, scheduling) |
| Snapshot storage | Embedded sub-documents en WorkOrder | Colección separada | Evita N+1 queries, preserva atomicidad, snapshot < 1KB |
| WorkOrder number | Atomic counter por tenant por día | UUID, Snowflake | Legible por humanos, reseteo diario alineado con negocio |
| Assignment tracking | WorkOrderAssignment collection separada | Array en WorkOrder | Historial completo de reasignaciones, auditoría |
| Technician list | Denormalizado array + canonical assignments | Solo canonical | Query rápida para dispatch queue sin joins |
| Race condition mitigation | `findOneAndUpdate` con filter de status | MongoDB transactions, locks | Sin overhead de sesión, atómico por documento |
| Event vs ActivityLog | Ambos coexisten | Fusionar en uno | Diferentes patrones de acceso y retención |
| WorkOrderEvent timestamps | `{ createdAt: true, updatedAt: false }` | Ambos timestamps | Append-only, no tiene sentido updatedAt |

---

## 3. Module Dependency Graph

```
src/core/ (User, ActivityLog, Tenant)
    ↑
    | reads
    |
src/crm/ (Client, Location, Equipment, Attachment)
    ↑
    | reads
    |
src/operations/ (WorkOrder, Assignment, Checklist, Event, VisitReport)
    |
    | writes
    ↓
[ActivityLog] (cross-entity audit events)
```

Operations NO exporta nada que CRM o Core importen. Es un módulo puramente consumidor.

---

## 4. Helper Functions Design

### 4.1 `helpers/state-machine.ts`

Propósito: Validación centralizada de transiciones de WorkOrder.

```typescript
import { WorkOrderStatus } from '../types/work-order';

export interface TransitionContext {
  hasChecklist?: boolean;    // PreVisitChecklist exists and complete
  hasVisitReport?: boolean;  // VisitReport exists
  hasTechnicians?: boolean;  // At least one technician assigned
  hasSchedule?: boolean;     // scheduledDate, scheduledStart, scheduledEnd set
}

// Constants
export const VALID_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  draft: ['scheduled', 'cancelled'],
  scheduled: ['confirmed', 'assigned', 'cancelled'],
  confirmed: ['assigned', 'cancelled'],
  assigned: ['en_route', 'cancelled'],
  en_route: ['on_site', 'cancelled'],
  on_site: ['paused', 'completed', 'cancelled'],
  paused: ['on_site', 'cancelled'],
  completed: ['closed'],
  cancelled: [],
  closed: [],
};

// Terminal states
export const TERMINAL_STATUSES: WorkOrderStatus[] = ['cancelled', 'closed'];

// Non-terminal active states (for dispatch queries)
export const ACTIVE_STATUSES: WorkOrderStatus[] = [
  'scheduled', 'confirmed', 'assigned', 'en_route', 'on_site', 'paused'
];

// UI-friendly check
export function canTransition(
  from: WorkOrderStatus,
  to: WorkOrderStatus,
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// Service-layer validation with context-aware guards
export class TransitionError extends Error {
  constructor(
    message: string,
    public readonly from: WorkOrderStatus,
    public readonly to: WorkOrderStatus,
    public readonly reason: string,
  ) {
    super(message);
    this.name = 'TransitionError';
  }
}

export function validateTransition(
  from: WorkOrderStatus,
  to: WorkOrderStatus,
  context: TransitionContext = {},
): void {
  if (!canTransition(from, to)) {
    throw new TransitionError(
      `Invalid transition: ${from} → ${to}`,
      from, to,
      `Transition from '${from}' to '${to}' is not allowed by the state machine.`,
    );
  }

  // Guard: assigned → en_route requires complete checklist
  if (from === 'assigned' && to === 'en_route' && !context.hasChecklist) {
    throw new TransitionError(
      `Checklist required: ${from} → ${to}`,
      from, to,
      'PreVisitChecklist must be completed before transitioning to en_route.',
    );
  }

  // Guard: on_site → completed requires VisitReport
  if (from === 'on_site' && to === 'completed' && !context.hasVisitReport) {
    throw new TransitionError(
      `VisitReport required: ${from} → ${to}`,
      from, to,
      'VisitReport must exist before transitioning to completed.',
    );
  }

  // Guard: scheduled → assigned requires at least one technician
  if (to === 'assigned' && !context.hasTechnicians) {
    throw new TransitionError(
      `Technicians required: ${from} → ${to}`,
      from, to,
      'At least one technician must be assigned.',
    );
  }

  // Guard: draft → scheduled requires schedule info
  if (from === 'draft' && to === 'scheduled' && !context.hasSchedule) {
    throw new TransitionError(
      `Schedule required: ${from} → ${to}`,
      from, to,
      'scheduledDate, scheduledStart, and scheduledEnd must be set.',
    );
  }
}
```

### 4.2 `helpers/overlap-detection.ts`

Propósito: Detección de conflictos de agenda para técnicos.

```typescript
import { WorkOrderModel } from '../models/work-order';

export interface TimeSlot {
  scheduledDate: Date;
  scheduledStart: Date;
  scheduledEnd: Date;
}

/**
 * Check if a technician has any conflicting work orders in the given time range.
 * Returns the first conflicting WorkOrder, or null if no conflict.
 */
export async function checkTechnicianConflict(
  tenantId: Types.ObjectId,
  technicianId: Types.ObjectId,
  slot: TimeSlot,
  excludeWorkOrderId?: Types.ObjectId,
): Promise<WorkOrderDocument | null> {
  const filter: Record<string, unknown> = {
    tenantId,
    assignedTechnicians: technicianId,
    scheduledDate: slot.scheduledDate,
    scheduledStart: { $lt: slot.scheduledEnd },
    scheduledEnd: { $gt: slot.scheduledStart },
    deletedAt: null,
    status: { $nin: ['cancelled', 'closed'] },
  };

  if (excludeWorkOrderId) {
    filter._id = { $ne: excludeWorkOrderId };
  }

  // Covered by index: { tenantId, assignedTechnicians, status }
  return WorkOrderModel.findOne(filter).lean();
}

/**
 * Validate multiple technicians for the same time slot.
 * Returns array of conflicts found.
 */
export async function checkMultiTechnicianConflicts(
  tenantId: Types.ObjectId,
  technicianIds: Types.ObjectId[],
  slot: TimeSlot,
  excludeWorkOrderId?: Types.ObjectId,
): Promise<Array<{ technicianId: Types.ObjectId; conflict: WorkOrderDocument }>> {
  const results = await Promise.all(
    technicianIds.map(async (techId) => {
      const conflict = await checkTechnicianConflict(tenantId, techId, slot, excludeWorkOrderId);
      return conflict ? { technicianId: techId, conflict } : null;
    }),
  );
  return results.filter(Boolean) as Array<{ technicianId: Types.ObjectId; conflict: WorkOrderDocument }>;
}
```

---

## 5. Snapshot Design

### 5.1 Structure

Los snapshots son sub-documentos Mongoose embebidos con `{ _id: false }`. Se almacenan directamente en el documento WorkOrder.

```typescript
interface IClientSnapshot {
  name?: string;
  email?: string;
  phone?: string;
  taxId?: string;
  customerType?: string;
  status?: string;
}

interface ILocationSnapshot {
  name?: string;
  address?: string;
  city?: string;
  province?: string;
  country?: string;
  postalCode?: string;
}

interface IEquipmentSnapshot {
  equipmentType?: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  status?: string;
}
```

### 5.2 Captura (creation time)

Al crear una WorkOrder:

1. Leer `Client.findById(clientId)` → extraer campos del snapshot
2. Leer `Location.findById(locationId)` → extraer campos del snapshot
3. Si `equipmentId` presente, leer `Equipment.findById(equipmentId)` → extraer campos
4. Si la entidad referenciada no existe → el snapshot queda como objeto vacío `{}` (no bloquea creación)
5. Asignar snapshots al input del WorkOrder antes de guardar

### 5.3 Reglas de lifecycle

- **CREACIÓN**: Service layer popula los snapshots antes de `workOrder.save()`
- **READ-ONLY**: Los snapshots NUNCA se modifican después de la creación
- **NO CASCADE**: Cambios en Client/Location/Equipment NO afectan snapshots existentes
- **ERROR HANDLING**: Si la entidad referenciada no existe, el snapshot queda vacío (no se bloquea la WO)

---

## 6. WorkOrder Number Generation

### Estrategia: Counter collection (MongoDB atomic counter)

```typescript
// src/operations/helpers/counter.ts
interface ICounter {
  _id: string; // e.g. "WO-ACME-20260612"
  seq: number;
}

export async function getNextWorkOrderNumber(tenantPrefix: string): Promise<string> {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const counterId = `WO-${tenantPrefix}-${dateStr}`;

  const result = await CounterModel.findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const seq = result.seq.toString().padStart(4, '0');
  return `${counterId}-${seq}`;
}
```

**Output**: `WO-ACME-20260612-0001`
**Reseteo**: Automático por día (el counter ID incluye la fecha)
**Defense-in-depth**: Unique index `{ tenantId, workOrderNumber }` en WorkOrder previene colisiones

---

## 7. Assignment Consistency Strategy

### Arquitectura: Canonical + Denormalized

| Almacenamiento | Propósito | Actualización |
|---|---|---|
| `WorkOrderAssignment` collection | Historial canónico de asignaciones | Cada asignación/reemplazo/decline |
| `WorkOrder.assignedTechnicians[]` | Query rápida (dispatch queue) | Atómico via `$addToSet` / `$pull` |

### Protocolo de reemplazo

1. Crear nuevo `WorkOrderAssignment` con `status: 'assigned'`
2. Marcar anterior como `status: 'replaced'`, setear `replacedAt` + `replacedByAssignmentId`
3. Actualizar `WorkOrder.assignedTechnicians`:
   - `$pull: { assignedTechnicians: oldTechnicianId }`
   - `$addToSet: { assignedTechnicians: newTechnicianId }`
4. Crear `WorkOrderEvent` con `eventType: 'technician_changed'`

### Protocolo de decline

1. Marcar `WorkOrderAssignment.status = 'declined'`
2. `$pull` de `WorkOrder.assignedTechnicians`
3. Notificar al dispatcher (futuro)

---

## 8. WorkOrderEvent vs ActivityLog

| Aspecto | WorkOrderEvent | ActivityLog |
|---|---|---|
| **Propósito** | Timeline operativo detallado | Auditoría cross-entity genérica |
| **Quién lo crea** | Service layer de Operations | ActivityLogger global |
| **Eventos típicos** | status_changed, technician_changed, visit_started, checklist_completed | created, updated, deleted, assigned |
| **Volumen** | Alto (múltiples eventos por WO) | Medio (eventos de todas las entidades) |
| **Retención** | Indefinida (histórico) | Configurable |
| **Query pattern** | `{ tenantId, workOrderId }` sorted by createdAt | `{ tenantId, entityType, entityId }` |
| **updatedAt** | No (append-only) | Sí |

### Cuándo usar cada uno

- **WorkOrderEvent SIEMPRE**: En cada cambio de estado, asignación, checkpoint operativo
- **ActivityLog ADEMÁS**: Para eventos cross-entity que deban aparecer en el feed global de actividad (creación de WO, eliminación, creación de VisitReport)

El service layer de Operations llama a ambos cuando corresponde.

---

## 9. Error Handling Strategy

### Error Hierarchy (service layer)

```
AppError (base)
├── NotFoundError        — Entidad no encontrada (404)
├── ValidationError      — Datos inválidos (400)
├── TransitionError      — Transición de estado inválida (409)
├── SchedulingConflictError — Conflicto de agenda (409)
├── ConflictError        — Race condition / concurrencia (409)
├── DeleteForbiddenError — WO no puede eliminarse (409)
```

### Patrón de transición atómica

```typescript
async function transitionStatus(
  workOrderId: string,
  from: WorkOrderStatus,
  to: WorkOrderStatus,
  context: TransitionContext,
  updatedBy: ObjectId,
): Promise<IWorkOrder> {
  validateTransition(from, to, context);

  const updated = await WorkOrderModel.findOneAndUpdate(
    { _id: workOrderId, status: from },  // ← optimistic lock
    { $set: { status: to, updatedBy } },
    { new: true },
  );

  if (!updated) {
    throw new ConflictError(
      `WorkOrder ${workOrderId} status changed from '${from}' before transition could complete. Retry.`,
    );
  }

  // Create WorkOrderEvent
  await WorkOrderEventModel.create({
    tenantId: updated.tenantId,
    workOrderId: updated._id,
    eventType: 'status_changed',
    description: `Status changed from ${from} to ${to}`,
    performedBy: updatedBy,
    metadata: { from, to },
  });

  return updated;
}
```

---

## 10. File Structure with Descriptions

```
src/operations/
├── types/
│   ├── index.ts                       # Barrel: exporta todos los tipos
│   ├── work-order.ts                  # IWorkOrder, snapshots interfaces, Create/Update input types
│   ├── work-order-assignment.ts       # IWorkOrderAssignment, AssignmentStatus, Create input
│   ├── pre-visit-checklist.ts         # IPreVisitChecklist, Create input
│   ├── work-order-event.ts            # IWorkOrderEvent, WorkOrderEventType, Create input
│   └── visit-report.ts                # IVisitReport, Create/Update input types
├── schemas/
│   ├── index.ts                       # Barrel: exporta todos los schemas
│   ├── work-order.ts                  # workOrderSchema + sub-schemas snapshots + 7 índices
│   ├── work-order-assignment.ts       # workOrderAssignmentSchema + 3 índices
│   ├── pre-visit-checklist.ts         # preVisitChecklistSchema + 1 índice único
│   ├── work-order-event.ts            # workOrderEventSchema + 2 índices (append-only)
│   └── visit-report.ts                # visitReportSchema + 2 índices (unique WO)
├── models/
│   ├── index.ts                       # Barrel: exporta los 5 modelos
│   ├── work-order.ts                  # WorkOrderModel
│   ├── work-order-assignment.ts       # WorkOrderAssignmentModel
│   ├── pre-visit-checklist.ts         # PreVisitChecklistModel
│   ├── work-order-event.ts            # WorkOrderEventModel
│   └── visit-report.ts                # VisitReportModel
├── helpers/
│   ├── state-machine.ts               # canTransition(), validateTransition(), TransitionContext
│   ├── overlap-detection.ts           # checkTechnicianConflict(), checkMultiTechnicianConflicts()
│   └── counter.ts                     # getNextWorkOrderNumber() — atomic counter
└── index.ts                           # Barrel público del módulo
```

**Total**: ~22 archivos

---

## 11. Implementation Considerations

### 11.1 Orden de implementación sugerido

| Orden | Archivos | Dependencias |
|---|---|---|
| 1 | Types (5) + Schemas (5) | Ninguna |
| 2 | Models (5) + barrel | Schemas |
| 3 | Helpers: state-machine.ts | Types |
| 4 | Helpers: counter.ts | Ninguna |
| 5 | Helpers: overlap-detection.ts | WorkOrderModel |
| 6 | Module index.ts | Todos los modelos |
| 7 | WorkOrderEvent service | Modelos |
| 8 | PreVisitChecklist service | Modelos |
| 9 | WorkOrderAssignment service | Modelos + overlap-detection |
| 10 | VisitReport service | Modelos |
| 11 | WorkOrder service | Todo lo anterior |

### 11.2 PR Strategy (same as Phase 2 — feature-branch-chain)

```
main (v0.2.0)
└── feature/operations (tracker branch)
    ├── PR1: Types + Schemas + Models (5 entidades base)
    ├── PR2: Helpers (state-machine + counter + overlap-detection)
    ├── PR3: WorkOrder + WorkOrderEvent services
    ├── PR4: Assignment + PreVisitChecklist services
    └── PR5: VisitReport service + Module barrel + Final wiring
```

### 11.3 Reuso confirmado

| Módulo existente | Uso |
|---|---|
| `src/crm/types/audit-fields.ts` | Re-export o import directo en tipos de Operations |
| `src/crm/types/attachment.ts` | Adjuntos vía `entityType: "workOrder"` (sin cambios) |
| `src/crm/helpers/cursor-pagination.ts` | Paginación de WorkOrderEvent |
| `src/core/types/activity-log.ts` | Auditoría cross-entity complementaria |
| `src/core/db.ts` | Conexión MongoDB (ya global) |

---

> **End of SDD Design: Fase 3 — Operaciones**
>
> Próximo paso: SDD Tasks — desglose en tareas de implementación.
