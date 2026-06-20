# SDD Proposal: Fase 3.1 — Cierre Completo del Módulo Operations

> **Change name**: `fase-3-1-operaciones`
> **Estado**: Proposal
> **Stack**: Next.js, TypeScript, MongoDB Atlas, Mongoose
> **Basado en**: Fase 3 data layer (types, schemas, models, helpers) existente sin commit

---

## Intent

Completar el módulo Operations implementando la capa de aplicación y APIs. El data layer (types, schemas, models, helpers) ya existe localmente pero no está commitado. Hace falta services con validación + state machine + OCC + audit, REST endpoints, tests, commit y tag v0.3.0-operations.

## Scope

**In Scope:**

| Área | Detalle |
|---|---|
| Services | WorkOrderService, AssignmentService, SchedulingService, ChecklistService, VisitReportService |
| APIs REST | work-orders CRUD, assignments, checklists, visit reports |
| Concurrencia | OCC vía version field — validar version+status en transiciones, incrementar en cada write |
| State machine | Guards de transiciones obligatorios (checklist, visit report, technicians, schedule) |
| Audit | Reuso de `core/audit/activity-logger.ts`, sin sistema paralelo |
| SLA | Validaciones estructurales: `responseDueAt > createdAt`, `resolutionDueAt > responseDueAt` |
| Firma digital | Placeholders en VisitReport (customerSignature, customerName, signedAt) — sin implementación |
| Soft-delete | Restricción: solo en `draft`/`cancelled` y sin evidencia operativa |
| Tests | State machine, guards, scheduling, assignments |
| Commit + Tag | `v0.3.0-operations` |

**Out of Scope:** Dispatcher queue UI/módulo, SLA engines/alerts, digital signature capture, Leads/Quotes/Facturación/Contratos, background jobs, geolocation

## Capabilities

| Capability | Type | Description |
|---|---|---|
| `work-order-lifecycle` | New | CRUD + state machine con 10 estados y 4 guards |
| `technician-assignment` | New | Asignación, acknowledge, decline, replace con scheduling conflict detection |
| `pre-visit-checklist` | New | Checklist 6-booleans, bloquea transición a en_route |
| `visit-report` | New | Reporte post-visita con arrival/departure/workPerformed |
| `scheduling-conflict-detection` | New | Overlap detection multi-técnico |

## Approach

1. Crear `src/operations/services/` con 5 servicios: cada uno encapsula su lógica de dominio con integración de state machine, OCC y audit
2. Agregar campo `version: number` al schema de WorkOrder (default 0, increment en cada write)
3. Crear rutas REST en el app router (Next.js API routes)
4. Escribir tests unitarios para state machine, guards, scheduling, assignments
5. Commit y tag `v0.3.0-operations`

## Design Decisions (Confirmed)

| Decisión | Elección | Alternativas | Por qué |
|---|---|---|---|
| Concurrencia | OCC via `version` field | MongoDB transactions | Sin overhead de sesión, atómico por documento |
| Assignment | WorkOrderAssignment es source of truth; `assignedTechnicians` es denormalizado | Solo canonical | Query rápida dispatch queue |
| Audit | `core/audit/activity-logger.ts` | Sistema paralelo | Reuso, sin duplicación |
| SLA | Validaciones estructurales en service | Engines/automations | Scope mínimo, deferido |
| Dispatcher | Deferido, documentar índices y queries | — | No hay UI ni lógica de dispatch |

## Affected Areas

| Path | Change |
|---|---|
| `src/operations/services/` | **New** — 5 service files |
| `src/operations/schemas/work-order.ts` | Modified — agregar `version` field |
| API routes (`src/app/api/operations/`) | **New** — REST endpoints |
| `tests/operations/` | **New** — tests |

## Risks

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Assignment inconsistency | Medium | Single write path via service layer |
| Concurrent transitions | Medium | OCC con version+status en filter |
| PR grande (>400 lines) | High | Chain PRs si es necesario |
| No test runner configurado | High | Verificación manual + documentar setup |

## Rollback Plan

Revertir commit. Revertir tag si se creó. Domain files (`src/operations/types/`, `schemas/`, `models/`, `helpers/`) no se modifican estructuralmente, solo se agrega `version` field.

## Dependencies

- `src/operations/*` (types, schemas, models, helpers) — existente
- `core/audit/activity-logger.ts` — auditoría cross-entity
- `crm/helpers/cursor-pagination.ts` — paginación WorkOrderEvent
- `core/db.ts` — conexión MongoDB

## Success Criteria

- [ ] 5 services con validación + state machine + audit
- [ ] REST endpoints funcionales
- [ ] State machine guards enforceados
- [ ] OCC funcionando (version bump, conflict detection)
- [ ] Assignment consistency mantenida
- [ ] Tests pasando
- [ ] Commit + tag `v0.3.0-operations`

---

> **Próximo paso**: SDD Spec con definiciones detalladas de servicios, APIs y tests.
