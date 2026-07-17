# SDD Proposal: lead-won-workflow

## Intent

El flujo actual para marcar un lead como `won` (ganado) tiene inconsistencias, transiciones faltantes y errores en la ruta `confirm-sale`. Además, `won` no debería ser un estado terminal sin efecto colateral: cuando un lead se marca como ganado, debe generarse una **orden de trabajo (work order)** para cumplir con el servicio/producto vendido.

Esta propuesta soluciona 4 problemas en un solo cambio cohesivo:

1. **State machine**: faltan transiciones válidas hacia `won`
2. **changeStatus**: bloquea `→ won` con un mensaje confuso (usa `hasClient`)
3. **confirm-sale/route.ts**: errores en filtro de presupuestos, falta de actualización de estado, y ausencia de validación de estado del lead
4. **Work Order posterior a WON**: `won` deja de ser terminal "silencioso" y gatilla la creación de una orden de trabajo

## Scope

### In scope

| ID | Cambio | Archivos |
|----|--------|----------|
| A | Agregar `contacted → won` en la state machine | `lead-state-machine.ts` |
| B | Bloquear explícitamente `→ won` en `changeStatus` con mensaje claro | `lead.service.ts` |
| C1 | `confirm-sale/route.ts`: cambiar filtro de quotes de `status: 'approved'` a `status: 'sent'` | `confirm-sale/route.ts` |
| C2 | `confirm-sale/route.ts`: en la transacción, setear `status: 'approved'` en las quotes (además de `approvedAt`) | `confirm-sale/route.ts` |
| C3 | `confirm-sale/route.ts`: validar que el lead esté en un estado permitido (`contacted`, `technical_visit`, `quote_sent`, `negotiation`) antes de la transacción | `confirm-sale/route.ts` |
| D | `confirm-sale/route.ts`: crear una WorkOrder dentro de la misma transacción al marcar el lead como `won` | `confirm-sale/route.ts`, (reutiliza `WorkOrderModel` existente) |

### Out of scope

- CRUD completo de Work Orders (ya existe en `src/operations/`)
- Pantalla/frontend de Work Orders desde leads
- Convertir lead a cliente desde fuera del confirm-sale (flujo `convertToClient` existente no se modifica)
- Disparar Work Order desde `changeStatus` o `convertToClient` — solo desde confirm-sale
- Estado `approved` en quotes fuera del flujo confirm-sale

## Approach

### (A) State machine — `contacted → won`

**Problema**: `VALID_TRANSITIONS.contacted` no incluye `won`, pero es válido desde el negocio (un lead contactado puede ir directo a venta sin necesidad de presupuesto).

**Solución**: Agregar `'won'` al array de transiciones de `contacted` en `lead-state-machine.ts`.

Impacto colateral: `canTransition('contacted', 'won')` pasa a ser `true`. La validación de `hasClient` se remueve de `changeStatus` (ver B), por lo que el state machine NO debe exigir `hasClient` para esta ruta.

### (B) `changeStatus` — bloqueo explícito de `→ won`

**Problema**: `changeStatus` permite transiciones a `won` en el state machine (para `quote_sent` y `negotiation`), pero luego las bloquea con `hasClient`. El error `TransitionError` dice "Requires complete minimum information" o "Cannot mark as won without converting to Client first", que es confuso porque el usuario debería usar "Confirmar venta".

**Solución**:
1. Agregar un early return al inicio de `changeStatus`:
   ```ts
   if (newStatus === 'won') {
     throw new ValidationError(
       'Use "Confirmar venta" o "Convertir a cliente" para marcar el lead como ganado'
     );
   }
   ```
2. Esto elimina la necesidad del bloque `hasClient` en `changeStatus` para `→ won`.

### (C) confirm-sale/route.ts — 3 bugs

#### C1: Filtro de quotes usa `status: 'approved'` en vez de `'sent'`

**Problema**: Busca quotes con `status: 'approved'`. Pero el flujo correcto es:
- `sent` = presupuesto enviado al cliente, pendiente de decisión
- `approved` = presupuesto aprobado POR el confirm-sale

La ruta debe buscar quotes con `status: 'sent'` (enviadas, aún no aprobadas).

**Solución**: Cambiar `status: 'approved'` a `status: 'sent'` en el `find` de `confirm-sale/route.ts:68`.

#### C2: La transacción no setea `status: 'approved'` en las quotes

**Problema**: El `updateMany` dentro de la transacción solo setea `approvedAt` y `updatedBy`. No cambia `status` a `'approved'`. Después de confirmar la venta, las quotes quedan con `status: 'sent'` en vez de reflejar que fueron aprobadas.

**Solución**: Agregar `status: 'approved'` al `$set` del `updateMany` en `confirm-sale/route.ts:95`.

#### C3: Falta validación de estado del lead antes de la transacción

**Problema**: No se valida que el lead esté en un estado que permita confirmar la venta. Un lead en `new`, `won`, `lost` o `disqualified` no debería poder ejecutar confirm-sale.

**Solución**: Agregar validación después de obtener el lead (línea 56):
```ts
const ALLOWED_FOR_SALE: LeadStatus[] = ['contacted', 'technical_visit', 'quote_sent', 'negotiation'];
if (!ALLOWED_FOR_SALE.includes(lead.status as LeadStatus)) {
  return NextResponse.json({
    error: `Lead en estado '${lead.status}' no puede confirmar venta. Estados permitidos: contactado, visita técnica, presupuesto enviado, negociación`,
  }, { status: 400 });
}
```

### (D) Work Order posterior a WON

**Problema**: Al marcar como `won`, no se crea ninguna orden de trabajo. El negocio requiere que cada venta genere una work order para cumplir el servicio.

**Solución**: Dentro de la misma transacción de confirm-sale, después de marcar el lead como `won` (línea 167) y antes de commit, crear un documento WorkOrder:

```ts
const workOrderNumber = await getNextWorkOrderNumber(tenantId);
const [workOrder] = await WorkOrderModel.create([{
  tenantId: new Types.ObjectId(tenantId),
  clientId, // creado en la misma transacción (paso 2)
  locationId: null, // opcional, el lead puede no tener ubicación
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

La WorkOrder se crea en estado `draft`. El usuario podrá programarla/editarla desde el módulo de Operaciones existente.

**Observación**: El `locationId` es `required` en el schema de WorkOrder (`requerido: true`). Habrá que hacerlo opcional o asignar un valor por defecto. Alternativa: requerir que el lead tenga una ubicación antes de confirmar venta. Esto se define en el diseño detallado.

## Impact analysis

### Files modified

| Archivo | Cambio |
|---------|--------|
| `src/leads/helpers/lead-state-machine.ts` | (A) Agregar `'won'` a `VALID_TRANSITIONS.contacted` |
| `src/leads/services/lead.service.ts` | (B) Bloquear `newStatus === 'won'` con mensaje claro antes de `validateTransition` |
| `src/app/api/crm/leads/[id]/confirm-sale/route.ts` | (C1) Filtro: `status: 'approved'` → `status: 'sent'`. (C2) Agregar `status: 'approved'` al `$set`. (C3) Validar `lead.status` contra `ALLOWED_FOR_SALE`. (D) Crear WorkOrder en la transacción |

### Files referenced (no change)

| Archivo | Propósito |
|---------|-----------|
| `src/operations/models/work-order.ts` | Modelo WorkOrder (ya existe, se usa `create`) |
| `src/operations/helpers/counter.ts` | `getNextWorkOrderNumber()` para numeración |
| `src/operations/schemas/work-order.ts` | Schema (verificar `locationId` required) |
| `src/operations/types/work-order.ts` | Tipos |

### New imports needed

| Archivo | Import |
|---------|--------|
| `confirm-sale/route.ts` | `WorkOrderModel` from `@/operations/models` |
| `confirm-sale/route.ts` | `getNextWorkOrderNumber` from `@/operations/helpers/counter` |
| `confirm-sale/route.ts` | `LeadStatus` from `@/leads/constants/lead-status.constants` |

### Design decision needed

**`locationId` required en WorkOrder**: El schema actual tiene `locationId: { type: Schema.Types.ObjectId, ref: 'Location', required: true }`. Pero un lead puede no tener ubicación. Opciones:
1. Hacer `locationId` opcional en el schema (`required: false`)
2. Asignar valor por defecto (ej: una ubicación "Sin dirección")
3. Requerir ubicación en el lead antes de confirmar venta

Opción recomendada: (1) `locationId: { ... required: false }`. Es el cambio más limpio y no rompe flujos existentes porque `WorkOrderService.create` ya resuelve la ubicación por ID.

## Non-goals

- No se implementa UI para el nuevo flujo de Work Orders desde leads
- No se modifica el flujo `convertToClient` existente en `lead.service.ts`
- No se agrega Work Order al `changeStatus` — solo desde confirm-sale
- No se implementa el estado `approved` de quotes en otras rutas (solo en confirm-sale)
- No se agrega lógica de facturación o contabilidad a la venta
- No se modifican los pipes/estadísticas de dashboard (ya contemplan Work Orders existentes)
- No se toca `CommercialProcessService` — sus handlers post-transacción se mantienen
