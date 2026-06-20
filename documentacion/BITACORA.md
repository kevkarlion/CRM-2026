# BITÁCORA DEL PROYECTO — CRM 2026

> **Propósito**: Única fuente de verdad del estado del proyecto. Mantiene el historial completo de decisiones, arquitectura, fases completadas y pendientes.
> **Actualización**: 2026-06-16
> **Stack**: Next.js, TypeScript, MongoDB (Mongoose)
> **Repo**: `main` + `feature/operations-complete` (3 commits ahead)
> **Tags**: `v0.1.0`, `v0.2.0`, `v0.3.0-operations`
> **TypeScript**: 133 archivos, ~5.400 líneas de código fuente, ~1.000 líneas de tests

---

## Índice

1. [Arquitectura General](#1-arquitectura-general)
2. [Estructura del Proyecto](#2-estructura-del-proyecto)
3. [Fase 1 — Fundación Multitenant (v0.1.0)](#3-fase-1--fundación-multitenant-v010)
4. [Fase 2 — Modelo de Negocio CRM (v0.2.0)](#4-fase-2--modelo-de-negocio-crm-v020)
5. [Fase 3 — Operaciones, Work Orders y Dispatching (v0.3.0-operations)](#5-fase-3--operaciones-work-orders-y-dispatching-v030-operations)
6. [Decisiones de Arquitectura Transversales](#6-decisiones-de-arquitectura-transversales)
7. [Git y Estrategia de Ramas](#7-git-y-estrategia-de-ramas)
8. [Pendientes y Trabajo Futuro](#8-pendientes-y-trabajo-futuro)
9. [Glosario de Colecciones](#9-glosario-de-colecciones)

---

## 1. Arquitectura General

### Capas

```
┌──────────────────────────────────────────────┐
│                API Layer                      │
│   src/app/api/operations/ (App Router)       │
├──────────────────────────────────────────────┤
│              Services Layer                   │
│   src/crm/services/ · src/operations/services │
├──────────────────────────────────────────────┤
│           Helpers / Business Logic            │
│   cursor-pagination, state-machine, counter,  │
│   overlap-detection                          │
├──────────────────────────────────────────────┤
│         Domain / Persistence Layer            │
│   types/ · schemas/ · models/ (Mongoose)     │
├──────────────────────────────────────────────┤
│            Cross-Cutting Modules              │
│   multitenancy · rbac · audit · security      │
│   observability · health · metrics            │
└──────────────────────────────────────────────┘
```

### Principios Arquitectónicos

- **Multitenant**: `tenantId` en toda colección de negocio. Índices compuestos con `{tenantId, ...}`.
- **Soft-delete**: `deletedAt: Date | null` + `deletedBy` en entidades de negocio. Partial unique indexes con `partialFilterExpression: { deletedAt: null }`.
- **Snapshots históricos**: Datos de referencia embebidos en documentos (`clientSnapshot`, `locationSnapshot`, `equipmentSnapshot`) para preservar evidencia histórica.
- **Append-only**: Colecciones de eventos y actividad que NO se modifican ni eliminan (WorkOrderEvent, ActivityLog, etc.).
- **Auditoría centralizada**: Todas las acciones relevantes pasan por `core/audit/activity-logger.ts`.

---

## 2. Estructura del Proyecto

```
src/
├── core/                          # 48 archivos — Plataforma base
│   ├── types/                     # 15 interfaces
│   ├── schemas/                   # 15 schemas, 25 índices
│   ├── models/                    # 15 modelos Mongoose
│   └── db.ts                      # Pool MongoDB global
├── multitenancy/                  # tenantScope, findByTenant
├── rbac/                          # 260+ permisos, guards
├── audit/                         # activity-logger.ts
├── security/                      # security-logger.ts
├── observability/                 # system-logger, request-logger, error-tracker
├── health/                        # health-check.ts
├── metrics/                       # metrics-aggregator.ts
├── platform/                      # admin-guard.ts
├── crm/                           # 38 archivos — Modelo de negocio CRM
│   ├── types/                     # 10 interfaces + audit-fields + common
│   ├── schemas/                   # 8 schemas
│   ├── models/                    # 8 modelos
│   ├── services/                  # 8 servicios CRUD + lógica
│   └── helpers/                   # cursor-pagination.ts
├── operations/                    # 28 archivos — Módulo operativo
│   ├── types/                     # 5 interfaces
│   ├── schemas/                   # 5 schemas, 15 índices
│   ├── models/                    # 5 modelos
│   ├── helpers/                   # state-machine, counter, overlap-detection
│   └── services/                  # 5 servicios
├── app/api/operations/            # 6 rutas REST (App Router)
└── ...
tests/
├── multitenancy/                  # tenant-scope.test.ts
├── rbac/                          # guards.test.ts
├── integration/                   # schemas.test.ts
└── operations/                    # 5 archivos (state-machine, guards, OCC, scheduling, assignments)
```

---

## 3. Fase 1 — Fundación Multitenant (v0.1.0)

**Período**: 2026-06-09 al 2026-06-10
**Commit**: `f5b6b89`
**Tag**: `v0.1.0` (implícito en commit inicial)
**SDD**: Proposal → Spec (23 req) → Design (6 decisiones) → Tasks (38 tareas, 3 PRs) → Verify (PASS)

### Entregado

| Módulo | Archivos | Propósito |
|--------|----------|-----------|
| `core/types/` | 15 interfaces | ITenant, IUser, IRole, IPermission, etc. |
| `core/schemas/` | 15 schemas | 25 índices, timestamps, soft-delete |
| `core/models/` | 15 modelos | Mongoose models + barrel |
| `multitenancy/` | 2 archivos | tenantScope(), findByTenant(), findOneByTenant() |
| `rbac/` | 3 archivos | 260+ permisos, guards de autorización |
| `audit/` | 1 archivo | logActivity(), getEntityHistory() |
| `security/` | 1 archivo | Eventos de seguridad |
| `observability/` | 3 archivos | system-logger, request-logger, error-tracker |
| `platform/` | 1 archivo | admin-guard |
| `health/` | 1 archivo | health-check |
| `metrics/` | 1 archivo | metrics-aggregator |

### Colecciones Creadas (15)

**Platform**: Tenant, User, Role, Permission, UserRole, RolePermission, PlatformUser
**Audit**: ActivityLog, SecurityLog, SystemLog, RequestLog, PlatformAuditLog
**Ops**: ErrorEvent, TenantMetrics, SystemHealth

### Patrones Establecidos

- `types/{entidad}.ts` → Interface extends Document
- `schemas/{entidad}.ts` → Schema con timestamps:true, índices POST schema
- `models/{entidad}.ts` → mongoose.model, export default
- `models/index.ts` → barrel
- Soft-delete: `deletedAt: Date | null` en toda entidad de negocio
- `tenantId` en toda colección business

---

## 4. Fase 2 — Modelo de Negocio CRM (v0.2.0)

**Período**: 2026-06-10
**Tag**: `v0.2.0` en `main`
**SDD**: Proposal → Spec → Design → Tasks → 5 PRs encadenados (feature-branch-chain) → Merge a main

### Entregado

| Módulo | Archivos | Propósito |
|--------|----------|-----------|
| `crm/types/` | 10 interfaces + audit-fields + common | IClient, IContact, ILocation, IEquipment, IServiceHistory, IActivity, ITask, IAttachment, IAuditFields, CursorPage |
| `crm/schemas/` | 8 schemas | Con índices, partialFilterExpression unique |
| `crm/models/` | 8 modelos | Mongoose + barrel |
| `crm/services/` | 8 servicios | CRUD + lógica de negocio + cascade |
| `crm/helpers/` | 1 helper | cursor-pagination (base64, collection-agnostic) |

### Colecciones Creadas (8)

Client, Contact, Location, Equipment, ServiceHistory, Activity, Task, Attachment

### Decisiones de Diseño

| Decisión | Elección | Por Qué |
|----------|----------|---------|
| Cascade soft-delete | Service-layer directo | Sin infra de MQ; upgrade a Bull/Kafka si escala |
| Paginación | Cursor (base64) | O(1), consistente bajo escritura |
| Activity | Colección separada | Patrones de query distintos al ActivityLog |
| clientId en Equipment | Denormalizado + sync | Evita 2-hop query a 100K+ |
| entityType | Strings planos (sin enum) | Work Orders, Quotes, Leads sin schema changes |
| Primary contact | Sin denormalizar en Client | Menos sync complexity |

### Entregado via feature-branch-chain (5 PRs)

| PR | Contenido | Archivos | +/- líneas |
|----|-----------|----------|------------|
| PR1 | Tipos reutilizables + Client | 9 | +179 |
| PR2 | Contact + Location | 11 | +281 |
| PR3 | Equipment + cascadas | 9 | +239 |
| PR4 | ServiceHistory + cursor pagination | 8 | +203 |
| PR5 | Activity + Task + Attachment | 16 | +349 |
| **Total** | **8 colecciones** | **38 nuevos** | **+1.240** |

---

## 5. Fase 3 — Operaciones, Work Orders y Dispatching (v0.3.0-operations)

**Período**: 2026-06-12 al 2026-06-16
**SDD**: Dos ciclos completos
**Branch**: `feature/operations-complete` (3 commits, NO mergeado a main)
**Tag**: `v0.3.0-operations`

### Subfase 3.0 — Data Layer (archivada 2026-06-12)

**SDD**: Proposal → Spec → Design → Tasks → Apply (PR1+PR2) → Verify (PASS) → Archive

| Módulo | Archivos | Propósito |
|--------|----------|-----------|
| `operations/types/` | 6 archivos | IWorkOrder + snapshots, IWorkOrderAssignment, IPreVisitChecklist, IWorkOrderEvent, IVisitReport |
| `operations/schemas/` | 6 archivos | 5 schemas + barrel, 15 índices |
| `operations/models/` | 7 archivos | 5 modelos + barrel + módulo barrel |
| `operations/helpers/` | 3 archivos | state-machine (10 estados, 4 guards), counter, overlap-detection |

### Subfase 3.1 — Services + APIs + Tests (archivada 2026-06-16)

**SDD**: Proposal → Spec → Design → Tasks → Apply (PR1+PR2) → Verify (PASS WITH WARNINGS, resuelto) → Archive

#### Entregado

| Módulo | Archivos | Propósito |
|--------|----------|-----------|
| `operations/services/` | 6 archivos | 5 servicios + barrel |
| `app/api/operations/` | 6 archivos | Rutas REST (App Router) |
| `tests/operations/` | 5 archivos | Tests unitarios |

#### Servicios Creados

| Servicio | Métodos Clave |
|----------|---------------|
| **WorkOrderService** | create, findById, findByTenant, update, changeStatus (con OCC + state machine + audit), schedule, softDelete |
| **AssignmentService** | assignTechnician, unassignTechnician, reassignTechnician, getCurrentAssignments (canonical + sync denormalizado) |
| **SchedulingService** | checkConflicts, validateAvailability, schedule, reschedule (con WorkOrderEvent + audit) |
| **ChecklistService** | createChecklist, updateChecklist, completeChecklist, validateChecklist, findByWorkOrder |
| **VisitReportService** | createVisitReport, updateVisitReport (con OCC), getVisitReport, existsForWorkOrder |

#### State Machine — 10 Estados

```
draft → scheduled → confirmed → assigned → en_route → on_site ⇄ paused → completed → closed
cancelled ← desde cualquier estado excepto closed
closed/cancelled: terminales (sin reapertura)
```

**4 Guards:**
1. `draft → scheduled`: requiere schedule info (scheduledDate, scheduledStart, scheduledEnd)
2. `* → assigned`: requiere al menos un técnico asignado
3. `assigned → en_route`: requiere PreVisitChecklist completo (6 booleanos + completedAt)
4. `on_site → completed`: requiere VisitReport existente

#### API REST Creada

```
POST   /api/operations/work-orders              # Crear WO
GET    /api/operations/work-orders              # Listar WO (filtros: status, technician, date range)
GET    /api/operations/work-orders/:id          # Obtener WO
PATCH  /api/operations/work-orders/:id          # Actualizar WO (con OCC)
DELETE /api/operations/work-orders/:id          # Soft-delete WO
PATCH  /api/operations/work-orders/:id/status   # Transición de estado (con OCC)
POST   /api/operations/work-orders/:id/assign   # Asignar técnico
GET    /api/operations/work-orders/:id/assign   # Ver asignaciones actuales
POST   /api/operations/work-orders/:id/assign   # (con action: reassign/unassign)
PATCH  /api/operations/work-orders/:id/checklist # Crear/actualizar/completar checklist
GET    /api/operations/work-orders/:id/checklist # Obtener checklist
POST   /api/operations/work-orders/:id/report   # Crear reporte de visita
GET    /api/operations/work-orders/:id/report   # Obtener reporte
PATCH  /api/operations/work-orders/:id/report   # Actualizar reporte (con OCC)
```

#### Tests Creados (5 archivos, Vitest-compatible)

| Archivo | Escenarios |
|---------|------------|
| `state-machine.test.ts` | 174 líneas — 10 estados, transiciones válidas e inválidas |
| `guards.test.ts` | 129 líneas — 4 guards, casos pass/fail |
| `occ.test.ts` | 111 líneas — version match, stale → 409 |
| `scheduling.test.ts` | 205 líneas — 4 escenarios overlap + multi-técnico |
| `assignments.test.ts` | 161 líneas — assign/unassign/reassign, duplicados |

#### Optimistic Concurrency Control (OCC)

- Campo `version: Number` (default 0) en WorkOrder y VisitReport
- Toda mutación incluye `version` en el filter de `findOneAndUpdate`
- `$inc: { version: 1 }` en cada update exitoso
- Si `matchedCount === 0` → 409 Conflict

#### Post-Verify Fixes (commit 50f88db)

- ✅ Agregado GET handler en ruta de checklist
- ✅ Agregado `version` field a VisitReport + OCC en update
- ✅ Movido `completedAt` de createChecklist a completeChecklist
- ✅ Agregado GET handler en ruta de assignments

---

## 6. Decisiones de Arquitectura Transversales

| Decisión | Elección | Alternativas | Rationale |
|----------|----------|-------------|-----------|
| Concurrencia | OCC vía `version` field | MongoDB transactions | Sin overhead de sesión, atómico por documento |
| Cascade soft-delete | Service-layer directo | Bull/Kafka | Sin infra de MQ; upgrade cuando escale |
| Paginación | Cursor (base64), collection-agnostic | Offset | O(1), consistente bajo escritura |
| Assignment canonical | WorkOrderAssignment es fuente de verdad; `assignedTechnicians` denormalizado | Solo canonical | Query rápida dispatch queue |
| State machine | Función pura en helper con tabla de transiciones | Máquina de estados formal | Simple, testeable, sin dependencias |
| Auditoría | `core/audit/activity-logger.ts` — llamadas explícitas | Aspect/decorators | Claridad, sin magia |
| entityType | Strings planos (sin enum) | Enum TypeScript | Work Orders, Quotes, Leads sin schema changes |
| Snapshots | Subdocumentos embebidos `{ _id: false }` | Referencias | Preserva evidencia histórica |
| SLA | Solo validaciones estructurales | Motores/alertas | Scope mínimo, diferido |
| Firma digital | Placeholders declarados, sin implementar | — | Compatibilidad futura |

---

## 7. Git y Estrategia de Ramas

```
main (v0.2.0)
├── v0.1.0 ── Commit inicial (Fase 1)
├── v0.2.0 ── Merge feature/domain-model (Fase 2)
│
└── feature/operations-complete (3 commits ahead, NO mergeado)
    ├── f672d83 feat(operations): add domain services layer and OCC
    ├── 542f622 feat(operations): complete application and api layer
    └── 50f88db fix(operations): address verify warnings
    └── tag: v0.3.0-operations

feature/domain-model (mergeado a main)
├── pr/1-client
├── pr/2-contact-location
├── pr/3-equipment
├── pr/4-service-history
└── pr/5-activity-task-attachment
```

### Convenciones

- **Feature-branch-chain**: PR#1 targetea tracker branch; PRs siguientes targetean PR anterior. Solo el tracker mergea a main con `--no-ff`.
- **Commits**: conventional commits (`feat:`, `fix:`, `refactor:`, etc.)
- **Tags**: Semánticos por hito (`v0.1.0`, `v0.2.0`, `v0.3.0-operations`)
- **Estado actual**: `feature/operations-complete` está 3 commits ahead de `main`. Pendiente de merge.

---

## 8. Pendientes y Trabajo Futuro

### Corto Plazo (previo a siguiente fase)

- [ ] Mergear `feature/operations-complete` a `main`
- [ ] Configurar test runner (Vitest/Jest) — 5 test files de operations + tests existentes no pueden ejecutarse
- [ ] CI/PR automation para flujo de PRs encadenados

### Fase 4 — Quotes, Facturación, Pipeline Comercial

- [ ] Quotes/Cotizaciones
- [ ] Facturación (invoices)
- [ ] Pipeline comercial
- [ ] Contratos
- [ ] Leads

### Mejoras Técnicas

- [ ] Background jobs para cascade (Bull/Kafka reemplazando service-layer inline)
- [ ] Dispatcher queue — vistas de dispatch (órdenes sin asignar, programadas, urgentes, vencidas, conflictos)
- [ ] Auth middleware — reemplazar headers `x-tenant-id`/`x-user-id` por autenticación real
- [ ] Geolocalización — migrar Location a índice `2dsphere`
- [ ] Firma digital — implementar captura en VisitReport
- [ ] Índices — monitorear performance de `{tenantId, entityType, entityId, -createdAt}`

---

## 9. Glosario de Colecciones

### Core (15) — Fase 1

| Colección | Tipo | Propósito |
|-----------|------|-----------|
| Tenant | Platform | Inquilinos multitenant |
| User | Platform | Usuarios del sistema |
| Role | Platform | Roles RBAC |
| Permission | Platform | Permisos RBAC |
| UserRole | Platform | Asignación usuario-rol |
| RolePermission | Platform | Asignación rol-permiso |
| PlatformUser | Platform | Usuarios cross-tenant |
| ActivityLog | Audit | Auditoría de actividad |
| SecurityLog | Audit | Eventos de seguridad |
| SystemLog | Audit | Logs del sistema |
| RequestLog | Audit | Logs de requests HTTP |
| PlatformAuditLog | Audit | Auditoría de plataforma |
| ErrorEvent | Ops | Eventos de error |
| TenantMetrics | Ops | Métricas por tenant |
| SystemHealth | Ops | Salud del sistema |

### CRM (8) — Fase 2

| Colección | Tipo | Propósito |
|-----------|------|-----------|
| Client | Business | Clientes del CRM |
| Contact | Business | Contactos de clientes |
| Location | Business | Ubicaciones de clientes |
| Equipment | Business | Equipos en sitio |
| ServiceHistory | Business | Historial de servicio (append-only) |
| Activity | Business | Actividades CRM (append-only) |
| Task | Business | Tareas programadas |
| Attachment | Business | Archivos adjuntos |

### Operations (5) — Fase 3

| Colección | Tipo | Propósito |
|-----------|------|-----------|
| WorkOrder | Business | Órdenes de trabajo (10 estados) |
| WorkOrderAssignment | Business | Asignaciones de técnicos (canonical) |
| PreVisitChecklist | Business | Checklist pre-visita (1:1 con WO) |
| WorkOrderEvent | Business | Timeline operativo (append-only) |
| VisitReport | Business | Reportes de visita (1:1 con WO) |

---

> **Próxima actualización**: post-merge de `feature/operations-complete` a `main` y/o al inicio de Fase 4.
> **Generado por**: gentle-ai orchestrator (sesión 2026-06-16)
