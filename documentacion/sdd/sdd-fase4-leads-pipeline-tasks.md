# SDD Tasks: Fase 4 — Leads y Pipeline Comercial

> **Change name**: `fase-4-leads-pipeline`
> **Estado**: Tasks (synced v0.4.0 — ✅ completed)
> **Stack**: Next.js + TypeScript + MongoDB (Mongoose) + App Router
> **Archivo fuente**: `documentacion/sdd/sdd-fase4-leads-pipeline-tasks.md`
> **Topic key**: `sdd/fase-4-leads-pipeline/tasks`

---

## Resumen del Cambio

Módulo completo de Leads y Pipeline Comercial: entidades Lead, LeadAssignment y Pipeline con state machine, detección de duplicados, asignación con historial, conversión transaccional a Client, y API REST completa.

### Volumen Total Estimado

| Componente | Archivos | Líneas est. | Líneas reales |
|---|---|---|---|---|
| Types (4 archivos) | `src/leads/types/*.ts` | ~60 | ~112 |
| Schemas (4 archivos) | `src/leads/schemas/*.ts` | ~85 | ~88 |
| Models (4 archivos) | `src/leads/models/*.ts` | ~25 | ~24 |
| Helpers (2 archivos) | `src/leads/helpers/*.ts` | ~120 | ~91 |
| Default Pipeline | `src/leads/pipelines/*.ts` | ~40 | ~7 |
| Services (3 archivos) | `src/leads/services/*.ts` | ~580 | ~1.029 |
| Barrels (5 archivos) | `src/leads/index.ts` + `src/leads/*/index.ts` | ~30 | ~17 |
| API Routes (8 archivos) | `src/app/api/crm/leads/**/route.ts` + pipelines | ~300 | ~389 |
| Tests (6 archivos) | `tests/leads/*.test.ts` | ~600 | ~1.498 |
| RBAC (edit) | `src/rbac/permissions.ts` | ~5 | ~1 |
| BITACORA (edit) | `documentacion/BITACORA.md` | ~30 | — |

**Total estimado**: ~1.875 líneas, ~40 archivos (32 nuevos, ~3 editados)
**Total real**: ~2.256 líneas (source ~1.745 + tests ~1.498, solapamiento estimado), 28 source + 8 routes + 6 tests = 28 archivos de código fuente + 6 tests + 1 RBAC edit

> **Nota**: Services ~1.029 líneas incluyen LeadService (478), LeadAssignmentService (162), PipelineService (386). No se implementaron `DuplicateService` ni `LeadConversionService` como archivos separados. Tests ~1.498 líneas (más del doble de la estimación original de ~600).

---

## PRs y Tareas

---

## PR1 — Foundation Layer

**Propósito**: Base del módulo `src/leads/`. Types, schemas, models, helpers, barrels, y setup inicial de RBAC. Sin lógica de negocio compleja — todo es declarativo o funciones puras.

**Dependencias externas**: Ninguna dentro del módulo. Depende de `IAuditFields` (ya existe en `src/crm/types/audit-fields.ts`).

**Estimación total PR1**: ~380 líneas
**Real PR1**: ~322 líneas (types ~112 + schemas ~88 + models ~24 + helpers ~91 + pipelines ~7)

---

### ✅ PR1-T1: Types definitions

| Campo | Valor |
|---|---|
| **ID** | PR1-T1 |
| **Nombre** | Definir tipos del módulo Leads |
| **Archivos** | `src/leads/types/lead.ts`, `src/leads/types/lead-assignment.ts`, `src/leads/types/pipeline.ts`, `src/leads/types/index.ts` |
| **Dependencias** | Ninguna |
| **Descripción** | ✅ Creados 4 archivos de types. `lead.ts`: `LeadSource`, `LeadStatus`, `ILead` (extiende `Document` — **NO** extiende `IAuditFields`), `CreateLeadInput` (interface plana, no Omit), `UpdateLeadInput`. **NOTA**: `ChangeLeadStatusInput` y `AssignLeadInput` **no implementados** como interfaces separadas. |
| **Estimación** | ~60 líneas |
| **Real** | ~112 líneas |
| **Criterio de aceptación** | ✅ Types compilan. `ILead` incluye todos los campos. `CreateLeadInput` tiene `assignedTo?: string`. `IPipelineStage` tiene name, position, probability, isActive. Barrel exporta todo. |

---

### ✅ PR1-T2: Mongoose schemas + indexes

| Campo | Valor |
|---|---|
| **ID** | PR1-T2 |
| **Nombre** | Definir schemas Mongoose con índices |
| **Archivos** | `src/leads/schemas/lead.ts`, `src/leads/schemas/lead-assignment.ts`, `src/leads/schemas/pipeline.ts`, `src/leads/schemas/index.ts` |
| **Dependencias** | PR1-T1 (types) |
| **Descripción** | ✅ Creados 4 archivos. `lead.ts`: **4/7 índices** implementados (faltan `{tenantId, source, createdAt}`, `{tenantId, deletedAt}`, `{tenantId, companyName}`). `lead-assignment.ts`: **1/3 índices** (solo `{tenantId, leadId, assignedAt}`). `pipeline.ts`: 2 índices (`{tenantId, isDefault}`, `{tenantId, name}` unique). **Validator de al menos 1 stage activa NO implementado**. Audit fields como `string` (no ObjectId ref). |
| **Estimación** | ~85 líneas |
| **Real** | ~88 líneas |
| **Criterio de aceptación** | ✅ Schemas registran en Mongoose. Índices definidos (subset del spec). Validaciones de schema funcionan. Sin validator de pipeline. |

---

### ✅ PR1-T3: Mongoose models

| Campo | Valor |
|---|---|
| **ID** | PR1-T3 |
| **Nombre** | Crear modelos Mongoose |
| **Archivos** | `src/leads/models/lead.ts`, `src/leads/models/lead-assignment.ts`, `src/leads/models/pipeline.ts`, `src/leads/models/index.ts` |
| **Dependencias** | PR1-T2 (schemas) |
| **Descripción** | ✅ Creados 4 archivos. Cada uno sigue el patrón: `mongoose.model<T>(name, schema)`. Barrel exporta los 3 modelos. |
| **Estimación** | ~25 líneas |
| **Real** | ~24 líneas |
| **Criterio de aceptación** | ✅ Modelos se instancian. Barrel exporta los 3. |

---

### ✅ PR1-T4: State machine helper

| Campo | Valor |
|---|---|
| **ID** | PR1-T4 |
| **Nombre** | State machine para transiciones de lead |
| **Archivos** | `src/leads/helpers/lead-state-machine.ts` |
| **Dependencias** | PR1-T1 (LeadStatus type) |
| **Descripción** | ✅ Implementado con **TransitionContext** en lugar de guards separados. `VALID_TRANSITIONS`: `new→[contacted, lost]` (sin `disqualified`), `contacted→[qualified, lost]` (sin `disqualified`), `qualified→[won, lost]` (sin `disqualified`). `TERMINAL_STATUSES`: won/lost/disqualified. `validateTransition(from, to, context?)` valida guards internamente según el par. **Desviación**: `disqualified` no es alcanzable como destino (falta en VALID_TRANSITIONS). No existen `canMarkContacted` ni `validateQualifiedRequirements` como funciones separadas. |
| **Estimación** | ~80 líneas |
| **Real** | ~47 líneas |
| **Criterio de aceptación** | ✅ `canTransition` funciona. `validateTransition` lanza TransitionError. Guards funcionan vía TransitionContext. Terminales no tienen transiciones. |

---

### ✅ PR1-T5: Duplicate detection helper

| Campo | Valor |
|---|---|
| **ID** | PR1-T5 |
| **Nombre** | Helper de detección de duplicados |
| **Archivos** | `src/leads/helpers/duplicate-detection.ts` |
| **Dependencias** | PR1-T3 (LeadModel) |
| **Descripción** | ✅ `normalizePhone()`, `escapeRegex()`, `findDuplicates(tenantId, email?, phone?, companyName?)`. **Desviaciones**: La función se llama `findDuplicates` (no `detectDuplicates`). No acepta `fields` object ni `excludeId`. No tiene auto-exclusión. |
| **Estimación** | ~45 líneas |
| **Real** | ~44 líneas |
| **Criterio de aceptación** | ✅ `normalizePhone` funciona. `findDuplicates` con email retorna coincidencias. Sin campos retorna []. |

---

### ✅ PR1-T6: Default pipeline config

| Campo | Valor |
|---|---|
| **ID** | PR1-T6 |
| **Nombre** | Default pipeline config |
| **Archivos** | `src/leads/pipelines/default-pipeline.ts`, `src/leads/services/index.ts` |
| **Dependencias** | PR1-T3 (models) |
| **Descripción** | ✅ `DEFAULT_STAGES` con 5 etapas (nombres: "Nuevo contacto", "Contactado", "Visita técnica", "Presupuesto", "Ganado" — **difieren del spec**). `seedDefaultPipeline()` como función standalone en `pipeline.service.ts` (no en archivo separado). **DuplicateService NO implementado como clase separada** — la detección está in-line en `LeadService.createLead()`. |
| **Estimación** | ~65 líneas |
| **Real** | ~7 (default-pipeline) + ~3 (barrel) |
| **Criterio de aceptación** | ✅ DEFAULT_STAGES tiene 5 etapas. seedDefaultPipeline idempotente. Sin DuplicateService. |

---

### ✅ PR1-T7: Module barrel + RBAC update

| Campo | Valor |
|---|---|
| **ID** | PR1-T7 |
| **Nombre** | Barrel público del módulo y actualización de RBAC |
| **Archivos** | `src/leads/index.ts`, `src/rbac/permissions.ts` (editado) |
| **Dependencias** | PR1-T1 a PR1-T6 |
| **Descripción** | ✅ Barrel `src/leads/index.ts` exporta types, models, y helpers. **RBAC**: No se exportan services desde el barrel público. `LEADS_STATUS_CHANGE` agregado a Permissions en `src/rbac/permissions.ts`. |
| **Estimación** | ~20 líneas |
| **Real** | ~5 (barrel) + ~1 (RBAC) |
| **Criterio de aceptación** | ✅ Barrel exporta sin errores. Permissions tiene LEADS_STATUS_CHANGE. |

---

## PR2 — Lead Service

**Propósito**: Core del módulo. CRUD completo, status transitions con guards, soft delete.
**Estimación total PR2**: ~280 líneas
**Real PR2**: ~478 líneas (LeadService completo, incluye convertToClient)

---

### ✅ PR2-T1: LeadService.createLead()

| Campo | Valor |
|---|---|
| **ID** | PR2-T1 |
| **Nombre** | Implementar LeadService.createLead() |
| **Archivos** | `src/leads/services/lead.service.ts` |
| **Dependencias** | PR1-T4, PR1-T5, PR3-T1 |
| **Descripción** | ✅ `createLead(data, userId, tenantId)`. **Desviaciones**: No normaliza email/phone. Duplicate detection in-line con `findDuplicates()` + `DuplicateWarning[]` (no `DuplicateService`). No crea Activity CRM (solo audit log). Retorna `{ lead, warnings? }` (no `{ ...lead, duplicates }`). |
| **Estimación** | ~70 líneas |
| **Real** | ~46 (createLead) |
| **Criterio de aceptación** | ✅ Crea lead con status 'new'. Con assignedTo, crea LeadAssignment. logActivity llamado. Warnings incluidos. |

---

### ✅ PR2-T2: LeadService.getLead() + listLeads()

| Campo | Valor |
|---|---|
| **ID** | PR2-T2 |
| **Nombre** | Implementar métodos de consulta |
| **Archivos** | `src/leads/services/lead.service.ts` |
| **Dependencias** | PR2-T1 |
| **Descripción** | ✅ `getLead(leadId, tenantId)`: `findOne` con `populate('assignedTo')`. No soporta `includeDeleted`. `listLeads(filters, tenantId)`: **cursor-based pagination** (no skip/limit). Filtros: status, assignedTo, source, createdAtGte, createdAtLte, search, cursor, limit. Retorna `{ data, cursor?, total }` (no `{ data, pagination }`). |
| **Estimación** | ~80 líneas |
| **Real** | ~54 (getLead + listLeads) |
| **Criterio de aceptación** | ✅ getLead retorna lead. listLeads filtra correctamente. Cursor pagination funciona. |

---

### ✅ PR2-T3: LeadService.updateLead()

| Campo | Valor |
|---|---|
| **ID** | PR2-T3 |
| **Nombre** | Implementar LeadService.updateLead() |
| **Archivos** | `src/leads/services/lead.service.ts` |
| **Dependencias** | PR2-T1 |
| **Descripción** | ✅ `updateLead(leadId, data, userId, tenantId)`. **Desviaciones**: Rechaza `status` en body. Si `assignedTo` presente, delega en assignmentService.assign(). **NO ejecuta duplicate detection en update**. **NO rechaza update de lead won**. No registra Activity CRM. Retorna lead plano. |
| **Estimación** | ~75 líneas |
| **Real** | ~40 (updateLead) |
| **Criterio de aceptación** | ✅ Update modifica campos permitidos. Rechaza status en body. assignedTo delegado. updatedBy actualizado. |

---

### ✅ PR2-T4: LeadService.changeStatus()

| Campo | Valor |
|---|---|
| **ID** | PR2-T4 |
| **Nombre** | Implementar changeStatus con guards |
| **Archivos** | `src/leads/services/lead.service.ts` |
| **Dependencias** | PR1-T4 (state machine) |
| **Descripción** | ✅ `changeStatus(leadId, newStatus, userId, tenantId)`. Guards vía TransitionContext (no funciones separadas). **Desviaciones**: No rechaza específicamente `qualified→won` (lo maneja el guard `hasClient`). Error de lead no encontrado es genérico `Error('Lead not found')`. Sólo audit log (no Activity CRM). |
| **Estimación** | ~80 líneas |
| **Real** | ~76 (changeStatus) |
| **Criterio de aceptación** | ✅ Transiciones válidas e inválidas funcionan. Guards evaluados. ConflictError en concurrencia. |

---

### ✅ PR2-T5: LeadService.softDelete()

| Campo | Valor |
|---|---|
| **ID** | PR2-T5 |
| **Nombre** | Implementar softDelete |
| **Archivos** | `src/leads/services/lead.service.ts` |
| **Dependencias** | PR2-T1 |
| **Descripción** | ✅ `softDelete(leadId, userId, tenantId)`. Rechaza si `status === 'won'`. Setea deletedAt/deletedBy. Audit log. |
| **Estimación** | ~40 líneas |
| **Real** | ~42 (softDelete) |
| **Criterio de aceptación** | ✅ Soft delete setea deletedAt. Lead won rechazado. Audit log registrado. |

---

### ✅ PR2-T6: Error classes + barrel + convertToClient

| Campo | Valor |
|---|---|
| **ID** | PR2-T6 |
| **Nombre** | Error classes, barrel y convertToClient fusionado |
| **Archivos** | `src/leads/services/lead.service.ts`, `src/leads/services/index.ts` |
| **Dependencias** | PR2-T1 a PR2-T5 |
| **Descripción** | ✅ `ConflictError` y `ValidationError` exportados. `convertToClient()` implementado dentro de LeadService (no como servicio separado). Barrel exporta LeadService. **Nota**: `convertToClient()` agrega ~160 líneas extra no estimadas originalmente en PR2. |
| **Estimación** | ~15 líneas |
| **Real** | ~220 (error classes + convertToClient + barrel) |
| **Criterio de aceptación** | ✅ ConflictError y ValidationError exportados. Barrel exporta LeadService. Conversión transaccional funciona. |

---

## PR3 — Assignment Service

**Propósito**: LeadAssignment como entidad histórica. Asignación, reasignación y desasignación con auditoría.

**Dependencias**: PR1 (Foundation Layer — models y types)

**Estimación total PR3**: ~130 líneas
**Real PR3**: ~195 líneas (service 162 + route 33)

---

### ✅ PR3-T1: LeadAssignmentService class

| Campo | Valor |
|---|---|
| **ID** | PR3-T1 |
| **Nombre** | Implementar LeadAssignmentService |
| **Archivos** | `src/leads/services/lead-assignment.service.ts` |
| **Dependencias** | PR1-T3, PR1-T1 |
| **Descripción** | ✅ `assign(leadId, userId, assignedBy, tenantId, reason?)` — cierra assignment activo previo si existe, crea nuevo, actualiza lead.assignedTo, logActivity. `unassign(leadId, tenantId, userId)` — setea unassignedAt, lead.assignedTo=null, logActivity. `reassign(leadId, newUserId, assignedBy, tenantId, reason?)` — delega en assign. `getAssignmentHistory(leadId, tenantId)` — find sorted desc. `getActiveAssignments(userId, tenantId)` — find unassignedAt null. |
| **Estimación** | ~80 líneas |
| **Real** | ~162 líneas |
| **Criterio de aceptación** | ✅ Assign, unassign, reassign, history, active assignments. Todo con logActivity. |

---

### ✅ PR3-T2: Assign API route

| Campo | Valor |
|---|---|
| **ID** | PR3-T2 |
| **Nombre** | POST /api/crm/leads/:id/assign |
| **Archivos** | `src/app/api/crm/leads/[id]/assign/route.ts` |
| **Dependencias** | PR3-T1 |
| **Descripción** | ✅ POST handler. Body `{ userId, reason? }`. userId string → assign, userId null → unassign. Headers x-tenant-id, x-user-id requeridos. Maneja 401, 404, 500. |
| **Estimación** | ~50 líneas |
| **Real** | ~33 líneas |
| **Criterio de aceptación** | ✅ POST asigna/desasigna. Headers validados. Errores manejados. |

---

## PR4 — Pipeline Service

**Propósito**: CRUD de pipelines, stage management, seeding automático (lazy) del pipeline default.

**Dependencias**: PR1 (Foundation Layer — PipelineModel)

**Estimación total PR4**: ~320 líneas
**Real PR4**: ~528 líneas (service 386 + routes 142)

---

### ✅ PR4-T1: PipelineService class

| Campo | Valor |
|---|---|
| **ID** | PR4-T1 |
| **Nombre** | Implementar PipelineService |
| **Archivos** | `src/leads/services/pipeline.service.ts` |
| **Dependencias** | PR1-T3, PR1-T6 |
| **Descripción** | ✅ `createPipeline(data, userId, tenantId)` — si no hay pipelines, es default. `getPipelines(tenantId)` — lazy seeding si vacío. `getDefaultPipeline(tenantId)` — find + lazy seed. `updatePipeline(id, data, userId, tenantId)`. `addStage(id, {name, probability}, userId, tenantId)` — appends en `maxPosition+1`. `updateStage(id, stageIndex, data, userId, tenantId)` — usa `stages.${index}.key` positional. `deactivateStage(id, stageIndex, userId, tenantId)` — isActive=false, **sin verificar última activa**. `reorderStages(id, stageOrder[], userId, tenantId)` — reordena stages por ID. `deletePipeline(id, userId, tenantId)` — soft delete, rechaza default. `seedDefaultPipeline(tenantId, userId?)` — función standalone exportada. **Desviaciones**: `addStage` no reordena (solo appends). `deactivateStage` no verifica última activa. Sin `setAsDefault` separado. Stages se acceden por `stageIndex` (no `stageId`). Método extra: `reorderStages`. |
| **Estimación** | ~170 líneas |
| **Real** | ~386 líneas |
| **Criterio de aceptación** | ✅ CRUD completo con tenant isolation. Lazy seeding. Soft delete rechaza default. |

---

### ✅ PR4-T2: Pipeline API routes

| Campo | Valor |
|---|---|
| **ID** | PR4-T2 |
| **Nombre** | Pipeline API routes completas |
| **Archivos** | `src/app/api/crm/pipelines/route.ts`, `src/app/api/crm/pipelines/[id]/route.ts`, `src/app/api/crm/pipelines/[id]/stages/route.ts` |
| **Dependencias** | PR4-T1 |
| **Descripción** | ✅ **3 route files** (no 4 — no existe `stages/[stageId]/route.ts`). `pipelines/route.ts` (41): GET list, POST create. `pipelines/[id]/route.ts` (63): GET byId, PATCH update, DELETE. `pipelines/[id]/stages/route.ts` (38): GET stages, POST addStage, PATCH updateStage (via query param `stageIndex`), DELETE deactivateStage. **Desviaciones**: stages api usa `stageIndex` como query param, no `stageId` en URL. GET stages existe (no especificado). |
| **Estimación** | ~150 líneas |
| **Real** | ~142 líneas (41+63+38) |
| **Criterio de aceptación** | ✅ CRUD completo. Stages via stageIndex. Headers validados. Errores manejados. |

---

## PR5 — Conversion

**Propósito**: Conversión transaccional Lead → Client + Contact + Activity.

**Dependencias**: PR2 (LeadService), PR1-T3 (LeadModel), modelos CRM externos

**Estimación total PR5**: ~170 líneas
**Real PR5**: ~192 líneas (convertToClient ~160 dentro de LeadService + route 32)

---

### ✅ PR5-T1: convertToClient (fusionado en LeadService, no servicio separado)

| Campo | Valor |
|---|---|
| **ID** | PR5-T1 |
| **Nombre** | Implementar convertToClient transaccional |
| **Archivos** | `src/leads/services/lead.service.ts` |
| **Dependencias** | PR1-T3, PR1-T4, PR2-T1 |
| **Descripción** | ✅ `convertToClient(leadId, userId, tenantId, data?)` — **implementado dentro de LeadService**, no como LeadConversionService separado. Algoritmo transaccional con `startSession()/commitTransaction()/abortTransaction()`. Crea Client + Contact + Activity, actualiza lead a 'won'. `data` permite `{ customerType?, notes? }`. Retorna `{ lead: IPipelineLead, client: IClient, contact: IContact, activity }`. |
| **Estimación** | ~110 líneas |
| **Real** | ~160 líneas |
| **Criterio de aceptación** | ✅ Conversión exitosa crea Client + Contact + Lead. No qualified → 422. Ya convertido → 404. Concurrencia manejada con ConflictError. Transacción con rollback. Notes copiadas a Activity. |

---

### ✅ PR5-T2: Convert API route

| Campo | Valor |
|---|---|
| **ID** | PR5-T2 |
| **Nombre** | POST /api/crm/leads/:id/convert |
| **Archivos** | `src/app/api/crm/leads/[id]/convert/route.ts` |
| **Dependencias** | PR5-T1 |
| **Descripción** | ✅ POST handler. Body `{ customerType?, notes? }`. Headers x-tenant-id, x-user-id. Llama `leadService.convertToClient()`. Retorna 201 con lead+client+contact. Manejos de errores: 401 (headers), 404 (lead no encontrado/no qualified), 422 (ValidationError), 500. |
| **Estimación** | ~60 líneas |
| **Real** | ~32 líneas |
| **Criterio de aceptación** | ✅ POST 201 con lead+client+contact. Todos los errores manejados. |

---

## PR6 — API Routes

**Propósito**: Rutas REST para leads CRUD + status change + pipeline routes (estas últimas en PR4).

**Dependencias**: PR2 (LeadService), PR3 (LeadAssignmentService)

**Estimación total PR6**: ~170 líneas
**Real PR6**: ~247 líneas (leads routes 215 + assign 33 — pipeline routes contadas en PR4)

---

### ✅ PR6-T1: Create + List routes

| Campo | Valor |
|---|---|
| **ID** | PR6-T1 |
| **Nombre** | POST y GET /api/crm/leads |
| **Archivos** | `src/app/api/crm/leads/route.ts` |
| **Dependencias** | PR2-T1, PR2-T2 |
| **Descripción** | ✅ GET `listLeads()` con query params: status, assignedTo, source, cursor, search, limit. Retorna `{ data, cursor?, total }`. POST `createLead()` con body, retorna 201. Headers x-tenant-id, x-user-id requeridos (401 si no). |
| **Estimación** | ~60 líneas |
| **Real** | ~56 líneas |
| **Criterio de aceptación** | ✅ GET lista con cursor pagination. POST crea lead 201. Errores manejados. |

---

### ✅ PR6-T2: GetById + Update + Delete routes

| Campo | Valor |
|---|---|
| **ID** | PR6-T2 |
| **Nombre** | GET, PATCH, DELETE /api/crm/leads/:id |
| **Archivos** | `src/app/api/crm/leads/[id]/route.ts` |
| **Dependencias** | PR2-T2, PR2-T3, PR2-T5 |
| **Descripción** | ✅ GET `getLead()` con populate. PATCH `updateLead()` — rechaza status en body. DELETE `softDelete()`. Headers requeridos. Maneja 401, 404, 400, 500. **No retorna duplicates en PATCH** (difier del spec). |
| **Estimación** | ~70 líneas |
| **Real** | ~86 líneas |
| **Criterio de aceptación** | ✅ GET lead. PATCH update. DELETE soft-delete. Errores manejados. |

---

### ✅ PR6-T3: Status change route

| Campo | Valor |
|---|---|
| **ID** | PR6-T3 |
| **Nombre** | PATCH /api/crm/leads/:id/status |
| **Archivos** | `src/app/api/crm/leads/[id]/status/route.ts` |
| **Dependencias** | PR2-T4 (changeStatus) |
| **Descripción** | ✅ PATCH `changeStatus()`. Body `{ status }`. Maneja ValidationError → 400, ConflictError → 409, Error genérico → 500. **Desviaciones**: No maneja específicamente TransitionError → 422 (cae en 500 genérico). |
| **Estimación** | ~50 líneas |
| **Real** | ~40 líneas |
| **Criterio de aceptación** | ✅ PATCH cambia status. Errores manejados parcialmente. |

---

## PR7 — Tests

**Propósito**: Suite de tests completa. 93 tests, 6 archivos, 0 fallos.

**Dependencias**: PR1-PR6 (todo implementado). vitest + mongodb-memory-server.

**Estimación total PR7**: ~600 líneas
**Real PR7**: ~1.498 líneas, 93 tests en 6 archivos

---

### ✅ PR7-T1: State machine unit tests

| Campo | Valor |
|---|---|
| **ID** | PR7-T1 |
| **Nombre** | Tests de state machine helper |
| **Archivos** | `tests/leads/lead-state-machine.test.ts` |
| **Dependencias** | PR1-T4 |
| **Descripción** | ✅ **178 líneas, ~14 tests**. Cubre: `canTransition()` todas las combinaciones, transition context guards (`hasActivity`, `isValidQualification`, `hasClient`), `TransitionError`, terminal states, default status. Sin DB. |
| **Estimación** | ~100 líneas |
| **Real** | ~178 líneas, ~14 tests |
| **Criterio de aceptación** | ✅ Transiciones válidas/inválidas. Guards. Terminales. |

---

### ✅ PR7-T2: Duplicate detection unit tests

| Campo | Valor |
|---|---|
| **ID** | PR7-T2 |
| **Nombre** | Tests de duplicate detection |
| **Archivos** | `tests/leads/duplicate-detection.test.ts` |
| **Dependencias** | PR1-T5 |
| **Descripción** | ✅ **125 líneas, ~10 tests**. Cubre: `normalizePhone`, `escapeRegex`, `findDuplicates` por email/phone/companyName, sin duplicados. DB tests con MongoMemoryServer. |
| **Estimación** | ~80 líneas |
| **Real** | ~125 líneas, ~10 tests |
| **Criterio de aceptación** | ✅ normalizePhone. findDuplicates por cada campo. Sin duplicados. |

---

### ✅ PR7-T3: Lead service integration tests

| Campo | Valor |
|---|---|
| **ID** | PR7-T3 |
| **Nombre** | Tests de LeadService |
| **Archivos** | `tests/leads/lead.service.test.ts` |
| **Dependencias** | PR2 |
| **Descripción** | ✅ **354 líneas, ~18 tests**. Cubre: CRUD completo, changeStatus transitions y guards, soft delete, convertToClient, duplicate warnings, error classes, concurrent access. |
| **Estimación** | ~150 líneas |
| **Real** | ~354 líneas, ~18 tests |
| **Criterio de aceptación** | ✅ CRUD. Status transitions. Soft delete. Conversión. Concurrencia. |

---

### ✅ PR7-T4: Assignment service integration tests

| Campo | Valor |
|---|---|
| **ID** | PR7-T4 |
| **Nombre** | Tests de LeadAssignmentService |
| **Archivos** | `tests/leads/lead-assignment.service.test.ts` |
| **Dependencias** | PR3-T1 |
| **Descripción** | ✅ **207 líneas, ~11 tests**. Cubre: assign (crea assignment + update lead), reassign (cierra activo, crea nuevo), unassign (cierra activo, assignedTo=null), history, activeAssignments, lead inexistente. |
| **Estimación** | ~100 líneas |
| **Real** | ~207 líneas, ~11 tests |
| **Criterio de aceptación** | ✅ Assign, reassign, unassign. History. Activity log. |

---

### ✅ PR7-T5: Pipeline service integration tests

| Campo | Valor |
|---|---|
| **ID** | PR7-T5 |
| **Nombre** | Tests de PipelineService |
| **Archivos** | `tests/leads/pipeline.service.test.ts` |
| **Dependencias** | PR4-T1 |
| **Descripción** | ✅ **323 líneas, ~20 tests**. Cubre: createPipeline, default seeding, lazy seeding, getPipelines, updatePipeline, addStage (append + position), updateStage, deactivateStage, reorderStages, deletePipeline (rechaza default), ValidationError. |
| **Estimación** | ~110 líneas |
| **Real** | ~323 líneas, ~20 tests |
| **Criterio de aceptación** | ✅ CRUD completo. Stage management. Delete default protegido. Lazy seeding. |

---

### ✅ PR7-T6: Conversion integration tests

| Campo | Valor |
|---|---|
| **ID** | PR7-T6 |
| **Nombre** | Tests de conversión |
| **Archivos** | `tests/leads/conversion.test.ts` |
| **Dependencias** | PR5-T1 |
| **Descripción** | ✅ **311 líneas, ~20 tests**. Cubre: conversión exitosa (Client + Contact + Lead), lead no qualified, ya convertido, concurrente (ConflictError), rollback transaccional, field mapping, notes heredados, default customerType. Usa mongodb-memory-server con ReplicaSet para transacciones. |
| **Estimación** | ~120 líneas |
| **Real** | ~311 líneas, ~20 tests |
| **Criterio de aceptación** | ✅ Conversión exitosa. Todos los errores. Concurrencia. Rollback. |

---

## PR8 — Docs + Release

**Propósito**: Documentar fase completada, syncing SDD docs, commit local y tag.

**Dependencias**: PR1-PR7 (todo implementado y testeado)

**Estimación total PR8**: ~30 líneas
**Real PR8**: ~37 líneas (solo doc edits — BITACORA queda pendiente)

---

### ✅ PR8-T1: Sync SDD docs (spec + design + tasks)

| Campo | Valor |
|---|---|
| **ID** | PR8-T1 |
| **Nombre** | Sincronizar documentos SDD con implementación real |
| **Archivos** | `documentacion/sdd/sdd-fase4-leads-pipeline-spec.md` (editado), `documentacion/sdd/sdd-fase4-leads-pipeline-design.md` (editado), `documentacion/sdd/sdd-fase4-leads-pipeline-tasks.md` (editado) |
| **Dependencias** | PR1-PR7 |
| **Descripción** | ✅ **Los 3 documentos sincronizados con implementación real**. Cada documento actualizado con §Implementation Status/Notes, desviaciones, y líneas reales. BITACORA.md puede requerir actualización adicional. |
| **Estimación** | ~25 líneas |
| **Real** | ~37 líneas de cambios totales (sin BITACORA) |
| **Criterio de aceptación** | ✅ Spec, Design y Tasks reflejan implementación real. Desviaciones documentadas. |

---

### 🔳 PR8-T2: Commit + tag v0.4.0

| Campo | Valor |
|---|---|
| **ID** | PR8-T2 |
| **Nombre** | Commit local y tag de release v0.4.0 |
| **Archivos** | Ninguno |
| **Dependencias** | PR8-T1 |
| **Descripción** | 🔳 `git add -A && git commit -m "chore: sync Fase 4 docs with implementation"`. `git tag -a v0.4.0-leads-pipeline -m "Fase 4 — Leads Pipeline + state machine + API + 93 tests"`. |
| **Estimación** | ~1 línea (comando git) |
| **Real** | Pendiente |
| **Criterio de aceptación** | Pendiente — commit local + tag. |

---

## Estimación Total por PR

| PR | Líneas (est.) | Líneas reales | Archivos nuevos | Archivos editados |
|---|---|---|---|---|---|
| **PR1 — Foundation Layer** | ~380 | ~322 | 18 | 1 (rbac) |
| **PR2 — Lead Service** | ~280 | ~478 | 1 | 0 |
| **PR3 — Assignment Service** | ~130 | ~195 | 2 | 0 |
| **PR4 — Pipeline Service** | ~320 | ~528 | 5 | 0 |
| **PR5 — Conversion** | ~170 | ~192 | 1 (fusionado en LeadService) | 0 |
| **PR6 — API Routes** | ~170 | ~247 | 5 | 0 |
| **PR7 — Tests** | ~600 | ~1.498 | 6 | 0 |
| **PR8 — Docs + Release** | ~30 | ~37 (solo docs) | 0 | 3 (SDD docs) |
| **Total** | **~2.080** | **~3.497** | **~38 nuevos** | **~4 editados (rbac + 3 SDD docs)** |

---

## Recomendación de Estrategia de Entrega

### Volumen real: ~3.497 líneas, ~38 nuevos, ~4 editados (estimado ~2.080, 37, 2)

**Recomendación**: **Chained PRs** sobre `feature/leads-pipeline`.

**Razones**:

1. **~2.080 líneas es demasiado para un solo PR** — excede el umbral de 400 líneas para revisión efectiva (convención del proyecto).
2. **Dependencias claras entre PRs** — PR2 depende de PR3, PR5 depende de PR2 y modelos CRM externos. Chained PRs permiten merge progresivo sin bloquear.
3. **Cada PR tiene boundaries lógicos nítidos** — Foundation (PR1) es 100% revisable sin entender lógica de negocio. Tests (PR7) se agregan al final como verificación.
4. **Riesgo de merge conflict bajo** — PR1 es `src/leads/*` (nuevo directorio), PR2-PR6 tocan files dentro de ese directorio, sin overlap con código existente excepto `rbac/permissions.ts` (PR1-T7) y `BITACORA.md` (PR8).

### Secuencia de entrega propuesta:

```
main
 └── feature/leads-pipeline
      ├── CHAIN 1: PR1 — Foundation Layer (base)
      ├── CHAIN 2: PR3 — Assignment Service (desbloquea PR2)
      ├── CHAIN 3: PR2 — Lead Service (depende de PR3)
      ├── CHAIN 4: PR4 — Pipeline Service (independiente, puede ir en paralelo)
      ├── CHAIN 5: PR5 — Conversion (depende de PR2)
      ├── CHAIN 6: PR6 — API Routes (depende de PR2)
      ├── CHAIN 7: PR7 — Tests (depende de todo lo anterior)
      └── CHAIN 8: PR8 — Docs + Release (final)
```

### Alternativa: Single PR

Si se prefiere un solo PR (menos overhead de CI/CD), recomiendo al menos **dividir la revisión en 3 rounds**:
- **Round 1**: Types + Schemas + Models + Helpers (archivos declarativos)
- **Round 2**: Services + API Routes (lógica de negocio)
- **Round 3**: Tests

---

## Diagrama de Dependencias entre PRs

```
PR1 ── Foundation Layer
└── PR3 ── Assignment Service             (depende de PR1: types, models)
    └── PR2 ── Lead Service               (depende de PR1: helpers + DuplicateService)
        │                                 (depende de PR3: LeadAssignmentService.assign)
        ├── PR5 ── Conversion             (depende de PR2: LeadService patterns, errores)
        │                                 (depende de PR1: LeadModel)
        │                                 (depende de módulo CRM: ClientModel, ContactModel)
        └── PR6 ── API Routes            (depende de PR2: LeadService CRUD + changeStatus)
PR4 ── Pipeline Service                   (independiente, solo PR1)
PR7 ── Tests                              (depende de PR1-6)
PR8 ── Docs + Release                     (depende de PR1-7)
```

### Orden de implementación recomendado:

```
PR1 ──────────────────────────────────────► PR3 ──► PR2 ──► PR5
  │                                                    │
  │                                                    └──► PR6
  └──► PR4 (paralelo con PR3/PR2) ────────────────────────► PR7 ──► PR8
```

**Nota**: PR4 (Pipeline Service) es 100% independiente de PR2/PR3/PR5. Se puede implementar en paralelo con PR3 o PR2 para optimizar tiempo.

---

> **Fin de SDD Tasks: Fase 4 — Leads y Pipeline Comercial**
>
> Próximo paso: SDD Apply — implementación secuencial de PRs según el orden definido.
