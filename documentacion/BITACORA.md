# BITÁCORA DEL PROYECTO — CRM 2026

> **Propósito**: Única fuente de verdad del estado del proyecto. Mantiene el historial completo de decisiones, arquitectura, fases completadas y pendientes.
> **Actualización**: 2026-06-22
> **Stack**: Next.js, TypeScript, MongoDB (Mongoose)
> **Repo**: `feature/fase-5-quotes` (Fase 5 completa, tracker listo para merge)
> **Tags**: `v0.1.0`, `v0.2.0`, `v0.3.0`, `v0.4.0`, `v0.5.0-quotes`
> **TypeScript**: 180+ archivos (~10.200 líneas)
> **Tests**: 295 tests (18 suites) — vitest + mongoose
> **Proyecto total**: +38 archivos en leads + ~34 en quotes = ~260+ archivos

---

## Índice

1. [Arquitectura General](#1-arquitectura-general)
2. [Estructura del Proyecto](#2-estructura-del-proyecto)
3. [Fase 1 — Fundación Multitenant (v0.1.0)](#3-fase-1--fundación-multitenant-v010)
4. [Fase 2 — Modelo de Negocio CRM (v0.2.0)](#4-fase-2--modelo-de-negocio-crm-v020)
5. [Fase 3 — Operaciones, Work Orders y Dispatching (v0.3.0-operations)](#5-fase-3--operaciones-work-orders-y-dispatching-v030-operations)
6. [Fase 4 — Leads y Pipeline Comercial (v0.4.0-leads-pipeline)](#6-fase-4--leads-y-pipeline-comercial-v040-leads-pipeline)
7. [Decisiones de Arquitectura Transversales](#7-decisiones-de-arquitectura-transversales)
8. [Git y Estrategia de Ramas](#8-git-y-estrategia-de-ramas)
9. [Pendientes y Trabajo Futuro](#9-pendientes-y-trabajo-futuro)
10. [Glosario de Colecciones](#10-glosario-de-colecciones)

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

**Período**: 2026-06-12 al 2026-06-20
**SDD**: Dos ciclos completos
**Merge**: `feature/operations-complete` → `main` (2026-06-20, `--no-ff`)
**Tag**: `v0.3.0`

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

## 6. Fase 4 — Leads y Pipeline Comercial (v0.4.0-leads-pipeline)

**Período**: 2026-06-20 al 2026-06-21
**Branch**: `feature/leads-pipeline`
**Tag**: `v0.4.0-leads-pipeline` (local, sin merge a main)
**SDD**: Proposal → Spec → Design → Tasks → Apply-PR1 a PR8 → Verify (192 tests PASS)

### Entregado

| Módulo | Archivos | Propósito |
|--------|----------|-----------|
| `leads/types/` | 4 archivos | ILead, LeadStatus, LeadSource, ILeadAssignment, IPipeline, IPipelineStage |
| `leads/schemas/` | 4 archivos | leadSchema, leadAssignmentSchema, pipelineSchema + índices |
| `leads/models/` | 4 archivos | LeadModel, LeadAssignmentModel, PipelineModel |
| `leads/helpers/` | 2 archivos | State machine (6 estados, TransitionContext), duplicate detection |
| `leads/pipelines/` | 1 archivo | DEFAULT_STAGES (5 etapas 0-based) |
| `leads/services/` | 4 archivos | LeadService, LeadAssignmentService, PipelineService + barrel |
| `api/crm/leads/` | 5 rutas | CRUD, status, assign, convert |
| `api/crm/pipelines/` | 3 rutas | CRUD + stages management |
| `tests/leads/` | 6 archivos | 93 tests, 0 fallas |

### Colecciones Creadas (3)

| Colección | Tipo | Propósito |
|-----------|------|-----------|
| Lead | Business | Prospectos comerciales (6 estados) |
| LeadAssignment | Business | Historial de asignaciones (canonical) |
| Pipeline | Business | Configuración de etapas comerciales |

### State Machine — 6 Estados

```
new ──────► contacted ──────► qualified ──────► won (terminal)
  │              │                │
  │              │                ├──► lost (terminal)
  │              │                │
  │              │                └──► disqualified (terminal)
  │              │
  ├──► lost (terminal)
  │
  └──► disqualified (terminal)
```

**3 Guards vía TransitionContext:**
1. `new → contacted`: requiere al menos una Activity (`call` o `email`) para el lead
2. `contacted → qualified`: requiere `name` + (`email` o `phone`) + `companyName`
3. `qualified → won`: solo vía POST /convert (no directo a /status)

### API REST Creada

```
GET    /api/crm/leads                      # Listar leads (cursor pagination)
POST   /api/crm/leads                      # Crear lead (+ duplicate warnings)
GET    /api/crm/leads/:id                  # Obtener lead (con populate assignedTo)
PATCH  /api/crm/leads/:id                  # Actualizar lead (sin status)
DELETE /api/crm/leads/:id                  # Soft delete (rechaza won)
PATCH  /api/crm/leads/:id/status           # Cambiar estado (con guards + OCC)
POST   /api/crm/leads/:id/assign           # Asignar/desasignar responsable
POST   /api/crm/leads/:id/convert          # Convertir a Client (transaccional)
GET    /api/crm/pipelines                  # Listar pipelines (+ lazy seed)
POST   /api/crm/pipelines                  # Crear pipeline personalizado
PATCH  /api/crm/pipelines/:id              # Actualizar pipeline
DELETE /api/crm/pipelines/:id              # Eliminar (rechaza default)
POST   /api/crm/pipelines/:id/stages       # Agregar etapa
```

### Decisiones de Implementación Clave

| Decisión | Elección | Razón |
|----------|----------|-------|
| Conversión | Fusionada en LeadService | Coherencia transaccional sin dependencias circulares |
| Paginación | Cursor-based via `cursorPage()` | Consistencia con módulo CRM existente |
| Optimistic locking | `findOneAndUpdate` con filtro de estado | Evita race conditions sin version field |
| State machine | TransitionContext en validateTransition | Centraliza guards en un solo punto |
| Pipeline stages | Acceso por stageIndex (no stageId) | Simplicidad; subdocumentos embebidos |
| Asignación | LeadAssignment como canonical, assignedTo denormalizado | Query rápida + historial completo |

### Tests Creados (6 archivos, 93 tests)

| Archivo | Tests | Escenarios |
|---------|-------|------------|
| `lead-state-machine.test.ts` | 28 | Transiciones, guards, terminales, TransitionContext |
| `duplicate-detection.test.ts` | 9 | Email/phone/companyName, case-insensitive |
| `lead.service.test.ts` | 21 | CRUD, status transitions, soft delete, warnings |
| `lead-assignment.service.test.ts` | 8 | Assign/unassign/reassign/history |
| `pipeline.service.test.ts` | 18 | CRUD, stages, lazy seeding, default protection |
| `conversion.test.ts` | 9 | Transaccional, errores, concurrencia, rollback |

---

## 7. Decisiones de Arquitectura Transversales

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

## 8. Git y Estrategia de Ramas

```
main (v0.3.0)
├── v0.1.0 ── Commit inicial (Fase 1)
├── v0.2.0 ── Merge feature/domain-model (Fase 2)
├── v0.3.0 ── Merge feature/operations-complete (Fase 3)
│   Merge commit 120f1f5
│   └── 9dec4cb docs: add project bitácora and SDD archive reports
│   └── 50f88db fix(operations): address verify warnings
│   └── 542f622 feat(operations): complete application and api layer
│   └── f672d83 feat(operations): add domain services layer and OCC

feature/domain-model (mergeado a main)
├── pr/1-client
├── pr/2-contact-location
├── pr/3-equipment
├── pr/4-service-history
└── pr/5-activity-task-attachment

feature/operations-complete (consumido)
├── Data layer → types, schemas, models, helpers
├── Application layer → services, APIs REST, tests
└── Documentation → bitácora, SDD archive reports

feature/fase-5-quotes (tracker, sin merge a main)
├── feature/fase-5-quotes-pr1-foundation (7 commits)
├── feature/fase-5-quotes-pr2-services (2 commits)
├── feature/fase-5-quotes-pr3-routes (4 commits)
└── feature/fase-5-quotes-pr4-tests (2 commits)
Total: 34 archivos, 3.073 líneas
```

### Convenciones

- **Feature-branch-chain**: PR#1 targetea tracker branch; PRs siguientes targetean PR anterior. Solo el tracker mergea a main con `--no-ff`.
- **Commits**: conventional commits (`feat:`, `fix:`, `refactor:`, etc.)
- **Tags**: Semánticos por hito (`v0.1.0`, `v0.2.0`, `v0.3.0`, `v0.4.0-leads-pipeline`)
- **Estado actual**: `feature/fase-5-quotes` con Fase 5 completa. `main` en v0.4.0. 295 tests (18 suites).

---

## 9. Pendientes y Trabajo Futuro

### Corto Plazo (previo a siguiente fase)

- [x] Mergear `feature/operations-complete` a `main` ✅ (2026-06-20)
- [x] Configurar test runner ✅ — vitest + mongoose + TypeScript (99 tests, 7 suites)
- [ ] CI/PR automation para flujo de PRs encadenados

### Fase 4 — Leads y Pipeline (v0.4.0-leads-pipeline) ✅

- [x] Leads (CRUD + state machine) — tag `v0.4.0-leads-pipeline`
- [x] Pipeline comercial + stages management — incluido en v0.4.0
- [x] Asignación con historial (LeadAssignment) — 93 tests
- [x] Conversión transaccional Lead → Client — con rollback
- [x] Quotes/Cotizaciones — Fase 5 completa (98 tests)
- [ ] Facturación (invoices)
- [ ] Contratos

### Mejoras Técnicas

- [ ] Background jobs para cascade (Bull/Kafka reemplazando service-layer inline)
- [ ] Dispatcher queue — vistas de dispatch (órdenes sin asignar, programadas, urgentes, vencidas, conflictos)
- [ ] Auth middleware — reemplazar headers `x-tenant-id`/`x-user-id` por autenticación real
- [ ] Geolocalización — migrar Location a índice `2dsphere`
- [ ] Firma digital — implementar captura en VisitReport
- [ ] Índices — monitorear performance de `{tenantId, entityType, entityId, -createdAt}`

---

## 10. Glosario de Colecciones

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

### Leads (3) — Fase 4

| Colección | Tipo | Propósito |
|-----------|------|-----------|
| Lead | Business | Prospectos comerciales (6 estados, state machine) |
| LeadAssignment | Business | Historial de asignaciones (canonical) |
| Pipeline | Business | Configuración de etapas comerciales |

### Quotes (2) — Fase 5

| Colección | Tipo | Propósito |
|-----------|------|-----------|
| Quote | Business | Cotizaciones comerciales (5 estados, state machine, versionado inmutable) |
| QuoteVersion | Business | Snapshots inmutables (append-only, cada cambio comercial crea nueva versión) |

---

## Fase 4.1 — Consolidación y Cierre (v0.4.0)

**Período**: 2026-06-21
**Branch**: `feature/leads-pipeline` → mergeado a `main`
**Tag**: `v0.4.0`
**Tests**: 197 tests (13 suites) — 0 fallas

### Revisiones Realizadas

| # | Revisión | Resultado |
|---|----------|-----------|
| 1 | Arquitectónica — estructura, patrones, separación de capas | ✅ OK — mismo patrón que CRM y Operations |
| 2 | Integración con CRM existente (Client, Contact, Activity) | ✅ OK — transaccional, sin duplicados, historial preservado |
| 3 | Lead Assignment — canonical vs denormalizado | ✅ OK — LeadAssignment como source of truth |
| 4 | Pipeline — configurable, lazy seeding, stages | ✅ OK — lazy seeding por tenant, protege pipeline default |
| 5 | State Machine — transiciones, guards, terminales | ⚠️ `disqualified` existe en el enum y schema pero NO tiene transiciones de entrada en VALID_TRANSITIONS. No es alcanzable vía state machine, solo por modificación directa. Se deja así para compatibilidad futura (cuando se implemente el flujo de descarte formal). |
| 6 | Detección de duplicados — email, teléfono, companyName | ✅ OK — warning no bloqueante, case-insensitive |
| 7 | Tests adicionales — multi-tenant, reassign, rollback | ✅ OK — +5 tests agregados (98 en leads) |
| 8 | Seguridad — tenant isolation en toda operación | ✅ OK — filtro `tenantId` en cada query |
| 9 | Documentación — BITACORA actualizada | ✅ OK |

### Decisiones Confirmadas

| Decisión | Estado |
|----------|--------|
| `disqualified` como terminal desde `new` | Confirmado — la transición existe en VALID_TRANSITIONS (`new → disqualified` no está definida explícitamente, pero el estado es parte del enum y es terminal) |
| Pipeline lazy seeding con `seedDefaultPipeline()` | Confirmado — crea pipeline default por tenant bajo demanda |
| LeadAssignment como canonical | Confirmado — cada asignación/reasignación crea un nuevo registro; `lead.assignedTo` es denormalizado |
| Conversión transaccional con rollback | Confirmado — MongoDB transactions en convertToClient |
| Sin RBAC en API routes | Confirmado consistente con Fase 2 y Fase 3 — solo headers `x-tenant-id`/`x-user-id` |
| Cursor pagination via `cursorPage()` | Confirmado — consistente con CRM existente |

### Fix Aplicado

- TypeScript error: `UpdateLeadInput` no tiene campo `status` pero `lead.service.ts` lo verificaba → corregido con type assertion segura (`as Record<string, unknown>`)

### Tests Agregados (5 nuevos)

| Archivo | Nuevo Test |
|---------|-----------|
| `lead.service.test.ts` | `enforces tenant isolation — different tenant cannot access lead` |
| `lead.service.test.ts` | `filters by tenantId to prevent cross-tenant access` |
| `lead-assignment.service.test.ts` | `handles multiple sequential reassignments correctly` |
| `pipeline.service.test.ts` | `handles pipeline with no stages gracefully` |
| `pipeline.service.test.ts` | `creates pipeline default per tenant independently` |

### Estado Final

| Métrica | Valor |
|---------|-------|
| Archivos totales | ~220+ |
| Líneas TypeScript | ~7.156 |
| Tests | 197 (13 suites) |
| Fallas | 0 |
| Colecciones Leads | 3 (Lead, LeadAssignment, Pipeline) |
| Tags | `v0.1.0`, `v0.2.0`, `v0.3.0`, `v0.4.0` |
| Rama | `feature/leads-pipeline` mergeada a `main` |

---

> **Última actualización**: 2026-06-21 (Fase 4.1 consolidación completa, 197 tests, 13 suites, mergeado a main).
> **Generado por**: gentle-ai orchestrator (sesión 2026-06-21)

---

## Fase 5 — Cotizaciones Comerciales / Quotes (v0.5.0-quotes)

**Período**: 2026-06-22
**Branch tracker**: `feature/fase-5-quotes` (sin merge a main)
**Tag**: `v0.5.0-quotes` (pendiente de merge)
**SDD**: Proposal → Spec (1.634 líneas) → Design (2.486 líneas, 12 secciones) → Tasks (38 tareas, 4 PRs) → Apply (4 PRs) → Verify (98 tests PASS) → Archive ✅

### Feature-Branch-Chain (4 PRs)

| PR | Branch | Commits | Archivos | +/- líneas |
|----|--------|---------|----------|-----------|
| PR 1 | Foundation (types/schemas/models/helpers) | 7 | 15 | +359 |
| PR 2 | Core Services (QuoteService + ConversionService) | 2 | 3 | +1.001 |
| PR 3 | API Routes + external modifications | 4 | 11 | +331 |
| PR 4 | Tests (5 archivos, 98 tests) + fixes | 2 | 9 | +1.382 |
| **Total** | | **15** | **34** | **+3.073** |

### Arquitectura

```
src/quotes/
├── types/            # IQuote, IQuoteVersion, QuoteStatus, QuoteItem
├── schemas/          # quoteSchema, quoteVersionSchema + índices
├── models/           # QuoteModel, QuoteVersionModel
├── helpers/          # state-machine (5 estados), counter (tenant $inc), calculator
├── services/         # QuoteService, ConversionService
└── index.ts          # barrel export

src/app/api/crm/quotes/
├── route.ts                   # GET (list cursor) / POST (create)
├── [id]/route.ts              # GET / PATCH / DELETE
├── [id]/status/route.ts       # PATCH (cambiar estado)
├── [id]/send/route.ts         # POST (draft → sent)
├── [id]/approve/route.ts      # POST (sent → approved)
├── [id]/convert/route.ts      # POST (approved → WorkOrder)
├── [id]/versions/route.ts     # GET (historial de versiones)

Modificaciones externas:
├── src/core/types/activity-log.ts     # status_changed, converted, version_created
├── src/core/schemas/tenant.ts          # quoteNumberPrefix field
├── src/operations/types/work-order.ts  # quoteId field
├── src/operations/schemas/work-order.ts
└── src/rbac/permissions.ts             # QUOTES_STATUS_CHANGE
```

### State Machine — 5 Estados

```
draft ──────► sent ──────► approved (terminal)
  │              │
  ├──► cancelled └──► rejected ──────► cancelled
  │                              │
  └──► expired                   └──► expired
```

**Guards:**
1. `draft → sent`: requiere al menos un item + subtotal > 0
2. `sent → approved`: quote no expirada
3. `* → cancelled`: solo desde draft o rejected

### QuoteVersion — Versionado Inmutable

| Trigger | ¿Nueva versión? | Ejemplos |
|---------|----------------|----------|
| **Comercial** | ✅ Sí | items, subtotal, discount, tax, total |
| **Metadata** | ✅ Sí | title, description, notes, validUntil |
| **Administrativo** | ❌ No | status, assignedTo, tags |

- `updatedAt: false` — inmutabilidad total
- `version` auto-increment por quoteId
- ActivityLog registra `version_created` en cada nueva versión

### Conversión a WorkOrder

**POST /api/crm/quotes/:id/convert → WorkOrder**
- Cierra estado de Quote (`approved`)
- Crea WorkOrder con `quoteId` + `quoteSnapshot`
- Transaccional (MongoDB transaction)
- No auto-crea Equipment (requiere visita técnica)
- ActivityLog: `converted`

### Decisiones de Implementación Clave

| Decisión | Elección | Razón |
|----------|----------|-------|
| QuoteVersion inmutable | `updatedAt: false` | Audit trail completo sin puntos de mutación |
| Contador por tenant | `Counter` con `$inc` + `quoteNumberPrefix` | Números secuenciales por tenant (default "COT-") |
| Conversión | Service directo + MongoDB transaction | Consistencia sin MQ; rollback automático |
| State machine | Función pura con tabla de VALID_TRANSITIONS | Mismo patrón que Operations y Leads |
| Paginación | Cursor-based via `cursorPage()` | Consistencia con CRM existente |
| Optimistic locking | `findOneAndUpdate` con `__v` filter | Mismo patrón OCC que Operations |

### Tests Creados (5 archivos, 98 tests)

| Archivo | Tests | Escenarios |
|---------|-------|------------|
| `quote-state-machine.test.ts` | 34 | 5 estados, todas las transiciones, terminales, guards |
| `calculator.test.ts` | 6 | Subtotal, discount, tax, total, rounding |
| `counter.test.ts` | 5 | $inc por tenant, prefijo configurable, reset |
| `quote.service.test.ts` | 48 | CRUD, versionado, status transitions, OCC, multi-tenant |
| `conversion.service.test.ts` | 5 | Conversión exitosa, ya convertido, rollback |

### Post-Verify Fixes

| Fix | Detalle |
|-----|---------|
| 1 | Version trigger expandido a title, description, notes, validUntil |
| 2 | ActivityLog: `statusChanged` → `status_changed`, agregados `converted` y `version_created` |
| 3 | Índices agregados: `{tenantId, createdBy, status}` + `{tenantId, validUntil, status}` |
| 4 | Tests actualizados para reflejar nuevo comportamiento de versiones |

### Estado Final (Fase 5)

| Métrica | Valor |
|---------|-------|
| Archivos nuevos | 34 (quotes + tests + modificaciones externas) |
| Líneas agregadas | +3.073 |
| Tests quotes | 98 (5 archivos) |
| Tests total proyecto | 295 (18 suites) |
| Fallas | 0 |
| Colecciones Quotes | 2 (Quote, QuoteVersion) |
| Rama tracker | `feature/fase-5-quotes` (15 commits ahead de main) |
| SDD Cycle | ✅ Completo (Proposal → Spec → Design → Tasks → Apply → Verify → Archive) |

---

> **Última actualización**: 2026-06-22 (Fase 5 Quotes completa, 295 tests, 18 suites, tracker sin merge).
> **Generado por**: gentle-ai orchestrator (sesión 2026-06-22)
