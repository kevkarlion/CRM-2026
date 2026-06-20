# CRM 2026 — Estado del Proyecto

> **Generado**: 2026-06-12
> **Stack**: Next.js, TypeScript, MongoDB Atlas (planificado), Mongoose
> **Repo**: git init, 3 tags (v0.1.0, v0.2.0, v0.3.0 implícito)

---

## Fase 1 — Fundación Multitenant (v0.1.0)

**Archivos**: 63 TypeScript en `src/core/` + tests
**SDD**: Proposal → Spec (23 req) → Design → Tasks (38 tareas, 3 PRs) → Verify (PASS)

### Colecciones (15 tablas)
Platform: Tenant, User, Role, Permission, UserRole, RolePermission, PlatformUser
Audit: ActivityLog, SecurityLog, SystemLog, RequestLog, PlatformAuditLog
Ops: ErrorEvent, TenantMetrics, SystemHealth

### Patrones establecidos
- `types/{entity}.ts` → Interface extends Document
- `schemas/{entity}.ts` → Schema con timestamps:true, índices POST schema
- `models/{entity}.ts` → mongoose.model, export default
- `models/index.ts` → barrel
- Soft-delete: `deletedAt: Date | null` en toda entidad de negocio
- `tenantId` en toda colección business

---

## Fase 2 — Modelo de Negocio CRM (v0.2.0)

**Tag**: `v0.2.0` en `main`
**Archivos**: 44 TypeScript en `src/crm/`
**SDD**: Proposal → Spec → Design → Tasks → 5 PRs encadenados → Merge a main

### Colecciones CRM (8 tablas)
Client, Contact, Location, Equipment, ServiceHistory, Activity, Task, Attachment

### Decisiones de diseño clave
| Decisión | Elegido |
|---|---|
| Cascade soft-delete | Service-layer directo |
| Paginación | Cursor (base64) |
| Activity | Colección separada |
| clientId en Equipment | Denormalizado + sync |
| entityType | Strings planos (sin enum) |
| Primary contact | Sin denormalizar en Client |

---

## Fase 3 — Operaciones, Work Orders y Dispatching (v0.3.0)

**SDD**: Proposal → Spec → Design → Tasks → Apply (PR1+PR2) → Verify (PASS) → Archive
**Archivos**: 22 TypeScript en `src/operations/`
**Documentación**: `documentacion/sdd/sdd-fase3-operaciones-{proposal,spec,design}.md`

### Estructura del módulo Operations

```
src/operations/
├── types/                          # 5 entidades + barrel
│   ├── work-order.ts               # IWorkOrder, snapshots, enums, input types
│   ├── work-order-assignment.ts    # IWorkOrderAssignment, AssignmentStatus
│   ├── pre-visit-checklist.ts      # IPreVisitChecklist
│   ├── work-order-event.ts         # IWorkOrderEvent, 11 event types
│   ├── visit-report.ts             # IVisitReport + placeholders firma digital
│   └── index.ts                    # Barrel
├── schemas/                        # 5 schemas + barrel + 15 índices
│   ├── work-order.ts               # 7 índices, snapshots embebidos { _id: false }
│   ├── work-order-assignment.ts    # 3 índices, unique compuesto
│   ├── pre-visit-checklist.ts      # 1 índice único compuesto
│   ├── work-order-event.ts         # 2 índices, append-only (updatedAt: false)
│   ├── visit-report.ts             # 2 índices, audit fields
│   └── index.ts                    # Barrel
├── models/
│   ├── work-order.ts               # WorkOrderModel
│   ├── work-order-assignment.ts    # WorkOrderAssignmentModel
│   ├── pre-visit-checklist.ts      # PreVisitChecklistModel
│   ├── work-order-event.ts         # WorkOrderEventModel
│   ├── visit-report.ts             # VisitReportModel
│   ├── index.ts                    # Barrel models
│   └── ../index.ts                 # Barrel módulo (types + schemas + models)
├── helpers/
│   ├── state-machine.ts            # 10 estados, canTransition, validateTransition, 4 guards
│   ├── counter.ts                  # getNextWorkOrderNumber() atómico
│   └── overlap-detection.ts        # Conflictos de scheduling multi-técnico
└── index.ts                        # Barrel público
```

### Entidades

| Entidad | Propósito | Relaciones clave |
|---|---|---|
| **WorkOrder** | Orden de trabajo (instalación, mantenimiento, reparación, etc.) | Client, Location, Equipment, User, Attachment |
| **WorkOrderAssignment** | Historial de asignaciones de técnicos | WorkOrder, User (technician) |
| **PreVisitChecklist** | Checklist pre-visita obligatorio | WorkOrder (1:1) |
| **WorkOrderEvent** | Timeline operativo append-only | WorkOrder (N:1) |
| **VisitReport** | Reporte de visita completada | WorkOrder (1:1), User |

### State Machine — 10 estados

```
draft → scheduled → confirmed → assigned → en_route → on_site ⇄ paused → completed → closed
cancelled ← desde cualquier estado excepto closed
closed/cancelled: terminales (sin reapertura)
```

**4 Guards obligatorios:**
1. `draft → scheduled`: requiere schedule info
2. `* → assigned`: requiere al menos un técnico
3. `assigned → en_route`: requiere PreVisitChecklist completo
4. `on_site → completed`: requiere VisitReport

### Ajustes obligatorios incorporados

| Ajuste | Implementación |
|---|---|
| Snapshots históricos | `clientSnapshot`, `locationSnapshot`, `equipmentSnapshot` embebidos |
| SLA Ready | `responseDueAt`, `resolutionDueAt` en WorkOrder |
| Scheduling conflict | `checkTechnicianConflict()` + `checkMultiTechnicianConflicts()` |
| Delete restriction | Solo soft-delete si `draft`/`cancelled` y sin evidencia operativa |
| Firma digital futura | `customerSignature`, `customerName`, `signedAt` en VisitReport |

### Índices (15 total)

| Colección | Índices | Propósito |
|---|---|---|
| WorkOrder | 7 (2 unique) | Status, fecha, técnico, cliente, dispatch queue |
| WorkOrderAssignment | 3 (1 unique) | Técnico, WO, estado |
| PreVisitChecklist | 1 (unique compuesto) | 1:1 por tenant |
| WorkOrderEvent | 2 | Timeline cursor, analytics |
| VisitReport | 2 (1 unique compuesto) | 1:1, historial técnico |

### Recursos reutilizados de fases anteriores

| Módulo | Reutilización |
|---|---|
| `crm/types/audit-fields.ts` | IAuditFields en WorkOrder y VisitReport |
| `crm/types/attachment.ts` | Adjuntos vía `entityType: "workOrder"` |
| `crm/helpers/cursor-pagination.ts` | Paginación de WorkOrderEvent |
| `core/types/activity-log.ts` | Auditoría cross-entity complementaria |
| `core/db.ts` | Conexión MongoDB global |

---

## Git

```
main
├── v0.2.0 ← HEAD
├── feature/domain-model (tracker branch, mergeado a main)
│   ├── pr/1-client
│   ├── pr/2-contact-location
│   ├── pr/3-equipment
│   ├── pr/4-service-history
│   └── pr/5-activity-task-attachment
└── Phase 1 (commit inicial)
```

### Estrategia de ramas
- **feature-branch-chain**: PR#1 targetea tracker branch; PRs siguientes targetean PR anterior
- Solo el tracker branch mergea a main con `--no-ff`
- Tags semánticos por hito (`v0.1.0`, `v0.2.0`)

---

## Pendientes

- [ ] Services layer para Operations (WorkOrder, Assignment, Checklist, Event, VisitReport)
- [ ] APIs REST para Operations
- [ ] Fase 4: Quotes, Facturación, Pipeline Comercial
- [ ] Geolocalización: migrar Location a `2dsphere` index
- [ ] Firma digital: implementar captura en VisitReport
- [ ] Tests unitarios para CRM services (8 services)
- [ ] Tests unitarios para Operations helpers (state-machine, counter, overlap-detection)
- [ ] Background jobs para cascade (Bull/Kafka reemplazando service-layer inline)
- [ ] CI/PR automation para flujo de PRs encadenados
