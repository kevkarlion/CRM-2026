# CRM 2026 — Estado del Proyecto

> Generado: 2026-06-10
> Stack: Next.js, TypeScript, MongoDB Atlas (planificado), Mongoose
> Repo: git init, 2 tags (v0.1.0 implícito en commit inicial, v0.2.0)

---

## Fase 1 — Fundación Multitenant (v0.1.0)

**Commit**: `f5b6b89` en `main`
**Archivos**: 63 TypeScript
**SDD**: Proposal → Spec (23 req) → Design (6 decisiones) → Tasks (38 tareas en 3 PRs) → Verify (PASS)

### Estructura

```
src/
├── core/
│   ├── db.ts                  # Pool MongoDB con caching global
│   ├── types/                 # 15 interfaces (ITenant, IUser, IRole, etc.)
│   ├── schemas/               # 15 schemas con 25 índices
│   └── models/                # 15 modelos Mongoose + barrel
├── multitenancy/
│   └── tenant-scope.ts        # tenantScope(), findByTenant(), findOneByTenant()
├── rbac/
│   ├── permissions.ts         # 260+ permisos
│   └── guards.ts              # Guards de autorización
├── audit/
│   └── activity-logger.ts     # logActivity(), getEntityHistory()
├── security/
│   └── security-logger.ts     # Eventos de seguridad
├── observability/
│   ├── system-logger.ts
│   ├── request-logger.ts
│   └── error-tracker.ts
├── platform/
│   └── admin-guard.ts
├── health/
│   └── health-check.ts
└── metrics/
    └── metrics-aggregator.ts

tests/
├── multitenancy/tenant-scope.test.ts
├── rbac/guards.test.ts
├── loggers.test.ts
└── integration/schemas.test.ts
```

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

### Estructura del módulo CRM

```
src/crm/
├── types/                     # 8 entidades + 2 reutilizables
│   ├── audit-fields.ts        # IAuditFields (createdBy, updatedBy, deletedBy, deletedAt)
│   ├── common.ts              # CursorPage<T>, CursorOptions, IPolymorphicRef
│   ├── client.ts
│   ├── contact.ts
│   ├── location.ts
│   ├── equipment.ts
│   ├── service-history.ts
│   ├── activity.ts
│   ├── task.ts
│   └── attachment.ts
├── schemas/                   # 8 schemas + audit-fields partial
├── models/                    # 8 modelos Mongoose + barrel
├── services/                  # 8 servicios (CRUD + lógica de negocio)
│   ├── client.service.ts      # CRUD + cascade completo
│   ├── contact.service.ts     # CRUD + setPrimary (two-phase)
│   ├── location.service.ts    # CRUD + Equipment sync en re-parent
│   ├── equipment.service.ts   # CRUD + clientId auto desde Location
│   ├── service-history.service.ts  # Append-only + cursor pagination
│   ├── activity.service.ts    # Append-only + cursor pagination
│   ├── task.service.ts        # CRUD + cursor pagination + completedAt auto
│   └── attachment.service.ts  # Create/delete (sin update)
├── helpers/
│   └── cursor-pagination.ts   # Collection-agnostic, base64 cursor
└── index.ts                   # Barrel público
```

### Decisiones de diseño (Phase 2)

| Decisión | Elegido | Por qué |
|---|---|---|
| Cascade soft-delete | Service-layer directo | Sin infra de MQ; upgrade a Bull/Kafka si escala |
| Paginación | Cursor (base64) | O(1), consistente bajo escritura |
| Activity | Colección separada | Patrones de query distintos al ActivityLog |
| clientId en Equipment | Denormalizado + sync | Evita 2-hop query a 100K+ |
| entityType | Strings planos (sin enum) | Work Orders, Quotes, Leads sin schema changes |
| Primary contact | Sin denormalizar en Client | Menos sync complexity |

### Índices clave

| Colección | Índice | Propósito |
|---|---|---|
| Client | `{tenantId, taxId}` unique, partialFilter deletedAt null | Unique taxId por tenant |
| Contact | `{tenantId, clientId, email}` unique, partialFilter | Unique email por cliente |
| Equipment | `{tenantId, clientId, status}` | Query directa por cliente (denormalizado) |
| Equipment | `{tenantId, serialNumber}` unique, partialFilter | Unique serial number |
| ServiceHistory | `{tenantId, equipmentId, serviceDate: -1}` | Cursor pagination por equipo |
| Activity | `{tenantId, entityType, entityId, createdAt: -1}` | Timeline cursor pagination |
| Task | `{tenantId, assignedTo, status}` | Lista de tareas por usuario |
| Attachment | `{tenantId, entityType, entityId}` | Adjuntos por entidad |

### Reglas de integridad

1. **Equipment.clientId** = Location.clientId (auto-resuelto en create/update)
2. **Client cascade**: soft-delete → Contacts, Locations, Equipment, Tasks
3. **Location cascade**: soft-delete → Equipment; clientId sync en re-parent
4. **Activity**: append-only, NO se modifica ni elimina
5. **Attachment**: sin update de metadata, delete físico (no soft-delete)
6. **ServiceHistory**: append-only, sin update ni soft-delete expuesto
7. **Unique constraints**: partialFilterExpression `{ deletedAt: null }` en taxId, serialNumber, email

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
- Tags semánticos por hito (`v0.1.0` fundación, `v0.2.0` modelo negocio)

---

## Entrega

| PR | Contenido | Archivos | +/- líneas |
|---|---|---|---|
| PR1 | Tipos reutilizables + Client | 9 | +179 |
| PR2 | Contact + Location | 11 | +281 |
| PR3 | Equipment + cascadas | 9 | +239 |
| PR4 | ServiceHistory + cursor pagination | 8 | +203 |
| PR5 | Activity + Task + Attachment | 16 | +349 |
| **Total** | **8 colecciones** | **38 nuevos** | **+1.240** |

---

## Pendientes

- [ ] Tests unitarios para servicios CRM (8 services)
- [ ] Background jobs para cascade (Bull/Kafka reemplazando service-layer inline)
- [ ] Work Orders, Quotes, Leads (schema-free, solo crear documentos con entityType nuevo)
- [ ] CI/PR automation para flujo de PRs encadenados
- [ ] Índices `{tenantId, entityType, entityId, -createdAt}` monitorear performance
