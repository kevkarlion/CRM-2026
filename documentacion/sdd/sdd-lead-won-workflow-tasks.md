# SDD Tasks: lead-won-workflow

> **Change name**: `lead-won-workflow`
> **Estado**: Tasks
> **Stack**: Next.js 16 + TypeScript + MongoDB (Mongoose) + App Router
> **Archivo fuente**: `documentacion/sdd/sdd-lead-won-workflow-tasks.md`
> **Topic key**: `sdd/lead-won-workflow/tasks`

## Resumen del Cambio

Cuatro áreas de cambio (A-D) sobre 4 archivos fuente + tests. Transiciones de state machine, guard en changeStatus, bugs en confirm-sale, y creación de WorkOrder post-won.

### Volumen Total Estimado

| Área | Archivos | Líneas est. |
|------|----------|-------------|
| A — State machine | `lead-state-machine.ts` | ~4 |
| B — changeStatus guard | `lead.service.ts` | ~7 |
| C — confirm-sale fixes | `confirm-sale/route.ts` | ~10 |
| D1 — Schema WorkOrder | `work-order.ts` | ~2 |
| D2-D3 — Imports + creación | `confirm-sale/route.ts` | ~25 |
| T1 — Tests state machine | `lead-state-machine.test.ts` | ~15 |
| T2 — Tests changeStatus | `lead.service.grouped.test.ts` | ~20 |
| T3 — Tests confirm-sale | `confirm-sale.integration.test.ts` (nuevo) | ~80 |

**Total estimado**: ~163 líneas, 4 archivos modificados, 1 archivo nuevo
**Total real**: (por completar durante implementación)

---

## Tareas

---

### PR1 — State Machine, changeStatus, y confirm-sale fixes

**Propósito**: Arreglar la state machine, el guard en changeStatus, y los 3 bugs en la ruta confirm-sale. Sin cambio de schema todavía.

**Dependencias externas**: Ninguna.

**Estimación total PR1**: ~21 líneas

---

### PR1-T1: [A1] Add contacted → won transition

| Campo | Valor |
|------|-------|
| **ID** | PR1-T1 |
| **Nombre** | Agregar `won` a `VALID_TRANSITIONS.contacted` |
| **Archivos** | `src/leads/helpers/lead-state-machine.ts` |
| **Dependencias** | Ninguna |
| **Descripción** | Agregar `'won'` al array de transiciones de `contacted` en `VALID_TRANSITIONS`. Esto permite que un lead en estado `contacted` pueda transicionar directamente a `won`. |
| **Estimación** | ~1 línea |
| **Criterio de aceptación** | `canTransition('contacted', 'won')` retorna `true`. Transiciones existentes desde `contacted` (`quote_sent`, `technical_visit`, `lost`) permanecen. `TERMINAL_STATUSES` y `CONVERTIBLE_STATUSES` sin cambios. |

```diff
-  contacted: ['quote_sent', 'technical_visit', 'lost'],
+  contacted: ['quote_sent', 'technical_visit', 'won', 'lost'],
```

---

### PR1-T2: [A2] Remove dead hasClient validation block

| Campo | Valor |
|------|-------|
| **ID** | PR1-T2 |
| **Nombre** | Eliminar bloque `hasClient` en `validateTransition` |
| **Archivos** | `src/leads/helpers/lead-state-machine.ts` |
| **Dependencias** | PR1-T1 (mismo archivo, pero son ediciones independientes) |
| **Descripción** | Remover las líneas 52-54 de `lead-state-machine.ts` que validan `hasClient` para transiciones a `won`. Este código es inalcanzable porque `changeStatus` ahora bloquea `→ won` antes de llegar a `validateTransition`. |
| **Estimación** | ~3 líneas |
| **Criterio de aceptación** | `validateTransition('quote_sent', 'won')` sin `hasClient` NO lanza error. `validateTransition('negotiation', 'won')` sin `hasClient` NO lanza error. La variable `hasClient` en `TransitionContext` se mantiene (puede ser usada por otras transiciones en el futuro). |

```diff
-  if ((from === 'quote_sent' && to === 'won' || from === 'negotiation' && to === 'won') && context && !context.hasClient) {
-    throw new TransitionError(from, to, 'Cannot mark as won without converting to Client first');
-  }
```

---

### PR1-T3: [B1] Add early won guard in changeStatus

| Campo | Valor |
|------|-------|
| **ID** | PR1-T3 |
| **Nombre** | Agregar guard temprano para `newStatus === 'won'` en `changeStatus` |
| **Archivos** | `src/leads/services/lead.service.ts` |
| **Dependencias** | Ninguna |
| **Descripción** | Agregar un early return al inicio de `changeStatus` (después del fetch del lead, línea ~421) que lance `ValidationError` si `newStatus === 'won'`. Esto ejecuta ANTES de cualquier query a DB (ActivityModel, ClientModel) y antes de `validateTransition`. |
| **Estimación** | ~4 líneas |
| **Criterio de aceptación** | `changeStatus(leadId, 'won', userId, tenantId)` lanza `ValidationError` con mensaje `'Use "Confirmar venta" o "Convertir a cliente" para marcar el lead como ganado'`. No se ejecuta `ActivityModel.exists`, `ClientModel` check, ni `validateTransition`. Transiciones a otros status (ej: `contacted`) no se ven afectadas. |

```typescript
if (newStatus === 'won') {
  throw new ValidationError(
    'Use "Confirmar venta" o "Convertir a cliente" para marcar el lead como ganado'
  );
}
```

---

### PR1-T4: [B2] Remove dead hasClient computation in changeStatus

| Campo | Valor |
|------|-------|
| **ID** | PR1-T4 |
| **Nombre** | Eliminar bloque `hasClient` en `changeStatus` |
| **Archivos** | `src/leads/services/lead.service.ts` |
| **Dependencias** | PR1-T3 (si no está el guard, este código aún se ejecuta para transiciones a `won`) |
| **Descripción** | Remover las líneas 443-445 que computan `hasClient` para `quote_sent → won` y `negotiation → won`. Es código muerto porque PR1-T3 bloquea `→ won` antes de llegar aquí. La declaración `let hasClient: boolean \| undefined;` (línea 425) puede permanecer — sigue siendo parte del objeto pasado a `validateTransition`. |
| **Estimación** | ~3 líneas |
| **Criterio de aceptación** | No hay referencia a `hasClient` para transiciones `→ won` en `changeStatus`. `hasClient` queda como `undefined` para transiciones `→ won` (que nunca llegan por PR1-T3). |

```diff
-    if ((currentStatus === 'quote_sent' && newStatus === 'won') || (currentStatus === 'negotiation' && newStatus === 'won')) {
-      hasClient = !!lead.convertedToClient;
-    }
```

---

### PR1-T5: [C1] Fix quote filter from approved to sent

| Campo | Valor |
|------|-------|
| **ID** | PR1-T5 |
| **Nombre** | Corregir filtro de quotes: `approved` → `sent` |
| **Archivos** | `src/app/api/crm/leads/[id]/confirm-sale/route.ts` |
| **Dependencias** | Ninguna |
| **Descripción** | Cambiar `status: 'approved'` a `status: 'sent'` en el `QuoteModel.find` de `confirm-sale/route.ts:68`. La búsqueda debe encontrar presupuestos ENVIADOS (pendientes de aprobación), no los ya aprobados. |
| **Estimación** | ~1 línea |
| **Criterio de aceptación** | El query busca quotes con `status: 'sent'`. Quotes con `status: 'approved'` NO son encontradas por este query. |

```diff
-        status: 'approved',
+        status: 'sent',
```

**Archivos editados:**

| Archivo | Cambio |
|---------|--------|
| `src/app/api/crm/leads/[id]/confirm-sale/route.ts:68` | `'approved'` → `'sent'` |

---

### PR1-T6: [C2] Add status: approved to transaction $set

| Campo | Valor |
|------|-------|
| **ID** | PR1-T6 |
| **Nombre** | Agregar `status: 'approved'` al `$set` del `updateMany` |
| **Archivos** | `src/app/api/crm/leads/[id]/confirm-sale/route.ts` |
| **Dependencias** | PR1-T5 (coherente: se buscan `sent` y se marcan `approved`) |
| **Descripción** | Agregar `status: 'approved'` al objeto `$set` del `QuoteModel.updateMany` dentro de la transacción (línea 95). Actualmente solo setea `approvedAt` y `updatedBy`; después de confirmar la venta las quotes deben reflejar que fueron aprobadas. |
| **Estimación** | ~1 línea |
| **Criterio de aceptación** | Después de la transacción, las quotes tienen `status: 'approved'`, `approvedAt` con timestamp válido, y `updatedBy` con el userId. |

```diff
            $set: {
+              status: 'approved',
              approvedAt: new Date(),
              updatedBy: new Types.ObjectId(userId),
            },
```

---

### PR1-T7: [C3] Add lead status validation before transaction

| Campo | Valor |
|------|-------|
| **ID** | PR1-T7 |
| **Nombre** | Validar estado del lead antes de iniciar transacción |
| **Archivos** | `src/app/api/crm/leads/[id]/confirm-sale/route.ts` |
| **Dependencias** | Ninguna |
| **Descripción** | Agregar validación después de obtener el lead (línea 56) y antes de `session.startTransaction()`. Definir `ALLOWED_FOR_SALE` con los estados permitidos y retornar 400 si el lead no está en uno de ellos. |
| **Estimación** | ~8 líneas |
| **Criterio de aceptación** | Lead en `contacted`, `technical_visit`, `quote_sent`, `negotiation` pasa la validación. Lead en `new`, `won`, `lost`, `disqualified` recibe 400 con mensaje descriptivo. La validación ocurre antes de la transacción (sin rollback necesario). |

```typescript
const ALLOWED_FOR_SALE: LeadStatus[] = ['contacted', 'technical_visit', 'quote_sent', 'negotiation'];
if (!ALLOWED_FOR_SALE.includes(lead.status as LeadStatus)) {
  return NextResponse.json(
    { error: `Lead en estado '${lead.status}' no puede confirmar venta. Estados permitidos: contactado, visita técnica, presupuesto enviado, negociación` },
    { status: 400 },
  );
}
```

Requiere import:
```typescript
import type { LeadStatus } from '@/leads/constants/lead-status.constants';
```

---

### PR2 — Schema WorkOrder + WorkOrder creation

**Propósito**: Hacer opcionales `locationId` y `locationSnapshot` en el schema WorkOrder, y crear la WorkOrder dentro de la transacción de confirm-sale.

**Dependencias externas**: PR1 (los fixes de confirm-sale deben estar para que la transacción funcione correctamente).

**Estimación total PR2**: ~27 líneas

---

### PR2-T1: [D1] Make locationId and locationSnapshot optional

| Campo | Valor |
|------|-------|
| **ID** | PR2-T1 |
| **Nombre** | Hacer `locationId` y `locationSnapshot` opcionales en WorkOrder schema |
| **Archivos** | `src/operations/schemas/work-order.ts` |
| **Dependencias** | Ninguna |
| **Descripción** | Cambiar `required: true` a `required: false` para `locationId` (línea 49) y `locationSnapshot` (línea 54). Esto permite crear WorkOrders sin ubicación, necesario cuando un lead no tiene dirección asociada. |
| **Estimación** | ~2 líneas |
| **Criterio de aceptación** | `WorkOrderModel.create` con `locationId: null` y `locationSnapshot: {}` no lanza `ValidationError`. Documentos existentes no se ven afectados (no requiere migración). |

```diff
-    locationId: { type: Schema.Types.ObjectId, ref: 'Location', required: true },
+    locationId: { type: Schema.Types.ObjectId, ref: 'Location', required: false },
```

```diff
-    locationSnapshot: { type: locationSnapshotSchema, required: true },
+    locationSnapshot: { type: locationSnapshotSchema, required: false },
```

---

### PR2-T2: [D2] Add imports to confirm-sale route

| Campo | Valor |
|------|-------|
| **ID** | PR2-T2 |
| **Nombre** | Agregar imports para WorkOrderModel, getNextWorkOrderNumber, y LeadStatus |
| **Archivos** | `src/app/api/crm/leads/[id]/confirm-sale/route.ts` |
| **Dependencias** | PR2-T1 (WorkOrderModel necesita el schema actualizado) |
| **Descripción** | Agregar 3 imports al inicio del archivo: `WorkOrderModel`, `getNextWorkOrderNumber`, y `LeadStatus`. |
| **Estimación** | ~3 líneas |
| **Criterio de aceptación** | Los imports compilan sin error. `WorkOrderModel`, `getNextWorkOrderNumber`, y `LeadStatus` están disponibles en el scope del archivo. |

```typescript
import WorkOrderModel from '@/operations/models/work-order';
import { getNextWorkOrderNumber } from '@/operations/helpers/counter';
import type { LeadStatus } from '@/leads/constants/lead-status.constants';
```

---

### PR2-T3: [D3] Create WorkOrder inside transaction

| Campo | Valor |
|------|-------|
| **ID** | PR2-T3 |
| **Nombre** | Crear WorkOrder dentro de la transacción de confirm-sale |
| **Archivos** | `src/app/api/crm/leads/[id]/confirm-sale/route.ts` |
| **Dependencias** | PR1-T6 (quote status update), PR2-T1 (schema optional), PR2-T2 (imports) |
| **Descripción** | Después de actualizar el lead a `won` (línea 167) y antes de `commitTransaction` (línea 169), agregar la creación de una WorkOrder. Usar `getNextWorkOrderNumber` para generar el número, y crear el documento con `clientSnapshot` desde los datos del lead, `locationId: null`, `locationSnapshot: {}`, `status: 'draft'`, y `source: 'manual'`. |
| **Estimación** | ~22 líneas |
| **Criterio de aceptación** | Después de `commitTransaction`, existe exactamente 1 WorkOrder con `leadId` del lead original, `clientId` del cliente creado, `status: 'draft'`, `workOrderNumber` formateado correctamente. Si `WorkOrderModel.create` lanza error, `abortTransaction` se ejecuta y el lead NO queda como `won`. |

```typescript
const workOrderNumber = await getNextWorkOrderNumber(tenantId);
await WorkOrderModel.create([{
  tenantId: new Types.ObjectId(tenantId),
  clientId,
  locationId: null,
  leadId: lead._id,
  clientSnapshot: {
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    customerType: resolvedCustomerType,
    status: 'active',
  },
  locationSnapshot: {},
  source: 'manual',
  workOrderNumber,
  title: `Venta: ${lead.companyName || lead.name}`,
  description: notes || `Venta generada desde lead #${lead._id}`,
  priority: 'normal',
  category: 'installation',
  status: 'draft',
  createdBy: new Types.ObjectId(userId),
  updatedBy: new Types.ObjectId(userId),
}], { session });
```

---

### PR3 — Tests

**Propósito**: Tests unitarios e integración para todas las áreas de cambio.

**Dependencias**: PR1 + PR2 (los tests validan el código implementado).

**Estimación total PR3**: ~115 líneas

---

### PR3-T1: State machine tests

| Campo | Valor |
|------|-------|
| **ID** | PR3-T1 |
| **Nombre** | Tests unitarios para cambios en state machine |
| **Archivos** | `tests/leads/lead-state-machine.test.ts` |
| **Dependencias** | PR1-T1, PR1-T2 |
| **Descripción** | Agregar tests a `lead-state-machine.test.ts` para: (1) `canTransition('contacted', 'won')` retorna `true`, (2) `validateTransition('contacted', 'won')` no lanza, (3) transiciones existentes desde `contacted` preservadas, (4) `TERMINAL_STATUSES` sin cambios, (5) `CONVERTIBLE_STATUSES` sin cambios, (6) `validateTransition('quote_sent', 'won')` sin `hasClient` no lanza, (7) `validateTransition('negotiation', 'won')` sin `hasClient` no lanza. Los tests existentes que verifican `hasClient` guard (líneas 129-137 y 155-161) deben actualizarse para reflejar que el guard ya no existe. |
| **Estimación** | ~15 líneas |
| **Criterio de aceptación** | Todos los tests pasan con `pnpm test -- --testPathPattern=lead-state-machine`. Tests existentes de `hasClient` se actualizan y pasan. |

---

### PR3-T2: changeStatus guard tests

| Campo | Valor |
|------|-------|
| **ID** | PR3-T2 |
| **Nombre** | Tests unitarios para guard en changeStatus |
| **Archivos** | `tests/leads/lead.service.grouped.test.ts` (o archivo existente de tests de lead.service) |
| **Dependencias** | PR1-T3, PR1-T4 |
| **Descripción** | Agregar tests para: (1) `changeStatus(leadId, 'won', userId, tenantId)` lanza `ValidationError` con el mensaje exacto, (2) verificar que NO se ejecutan queries DB antes del throw (mock `ActivityModel.exists` y `ClientModel.findOne` para confirmar que no se llaman), (3) transiciones a otros status (ej: `contacted`) no se ven afectadas. |
| **Estimación** | ~20 líneas |
| **Criterio de aceptación** | Todos los tests pasan con `pnpm test`. El mensaje de error coincide exactamente con FR-B03. Se verifica que `hasClient` computation block ya no se ejecuta para `→ won`. |

---

### PR3-T3: confirm-sale integration tests

| Campo | Valor |
|------|-------|
| **ID** | PR3-T3 |
| **Nombre** | Tests de integración para ruta confirm-sale |
| **Archivos** | `tests/leads/confirm-sale.integration.test.ts` (nuevo) |
| **Dependencias** | PR1-T5, PR1-T6, PR1-T7, PR2-T1, PR2-T2, PR2-T3 |
| **Descripción** | Crear archivo nuevo de tests de integración (MongoDB real) que cubra todos los escenarios: <br><br>**Happy path**: (1) confirm-sale con `saleMode: 'quotes'` — lead en `quote_sent`, 1 quote `sent`, verificar que WorkOrder se crea con campos correctos, quote cambia a `approved`, lead cambia a `won`. (2) confirm-sale con `saleMode: 'direct'`. (3) WorkOrder sin location (locationId=null, locationSnapshot={}). (4) Varias quotes sent. (5) unique workOrderNumber por tenant.<br><br>**Error paths**: (6) lead en `new` → 400. (7) lead ya `won` → 400. (8) lead en `lost` → 400. (9) lead en `disqualified` → 400. (10) WorkOrderModel.create falla → rollback, lead no queda `won`, no hay orphan client.<br><br>Utilizar seeding con MongoDB test database, la sesión de Mongoose, y verificar post-condiciones. |
| **Estimación** | ~80 líneas |
| **Criterio de aceptación** | Todos los tests pasan con `pnpm test -- --testPathPattern=confirm-sale`. Cada escenario del spec (C1-D5) tiene cobertura. Rollback verifica que `abortTransaction` se ejecuta y la DB queda consistente. |

---

## Review Workload Forecast

```yaml
review_workload:
  total_estimated_lines: 163
  files_changed: 5
  new_files: 1
  risk_level: low
  chained_prs_recommended: no
  exceeds_400_budget: no
  decision_needed_before_apply: no
  reason: >
    163 líneas total estimado está muy por debajo del budget de 400 líneas.
    Todos los cambios son locales (no afectan infraestructura, migraciones,
    o breaking changes). Las decisiones de diseño ya fueron resueltas en
    la fase de diseño. No se necesita decisión adicional antes de aplicar.
```
