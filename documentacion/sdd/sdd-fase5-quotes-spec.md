# SDD Spec: Fase 5 — Cotizaciones Comerciales (Quotes)

> **Change name**: `fase-5-quotes`
> **Estado**: Spec (synced v0.4.0)
> **Stack**: Next.js, TypeScript, MongoDB Atlas, Mongoose
> **Basado en**: Fase 1 (Platform Foundation) + Fase 2 (CRM) + Fase 3 (Operations) + Fase 4 (Leads & Pipeline)
> **Archivo fuente**: `documentacion/sdd/sdd-fase5-quotes-spec.md`
> **Topic key**: `sdd/fase-5-quotes/spec`

---

## Tabla de Contenidos

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Capacidades](#2-capacidades)
   - [C1: Quote CRUD con tenant isolation y soft delete](#c1-quote-crud-con-tenant-isolation-y-soft-delete)
   - [C2: Status transitions con state machine](#c2-status-transitions-con-state-machine)
   - [C3: Versioning completo con QuoteVersion](#c3-versioning-completo-con-quoteversion)
   - [C4: Number generation con contador secuencial](#c4-number-generation-con-contador-secuencial)
   - [C5: Quote → WorkOrder conversion](#c5-quote--workorder-conversion)
   - [C6: Activity logging via ActivityLog](#c6-activity-logging-via-activitylog)
3. [Especificación Detallada de Entidades](#3-especificación-detallada-de-entidades)
4. [Tabla de Transiciones de Estado](#4-tabla-de-transiciones-de-estado)
5. [API Endpoints Detallados](#5-api-endpoints-detallados)
6. [Índices](#6-índices)
7. [Reglas de Conversión Quote → WorkOrder](#7-reglas-de-conversión-quote--workorder)
8. [Integración con ActivityLog](#8-integración-con-activitylog)
9. [Estructura de Archivos](#9-estructura-de-archivos)
10. [Estados de Error](#10-estados-de-error)
11. [Riesgos y Mitigaciones](#11-riesgos-y-mitigaciones)

---

## 1. Resumen Ejecutivo

La Fase 5 implementa el módulo de Cotizaciones Comerciales (Quotes) del CRM. Cubre el ciclo completo desde que se crea un borrador de cotización hasta su aprobación, rechazo, expiración o conversión a una Orden de Trabajo (WorkOrder).

El módulo `src/quotes/` es un nuevo módulo top-level dentro del dominio CRM, siguiendo la misma separación de concerns que `src/operations/` y `src/leads/`. Incluye:

- **Quote**: Entidad principal que mantiene el resumen y estado actual de la cotización. Contiene campos agregados (subtotal, discountAmount, taxAmount, total) y referencias a entidades CRM.
- **QuoteVersion**: Entidad separada (no embebida) que preserva el historial completo de revisiones. Cada vez que se modifica el contenido comercial de una Quote, se crea una nueva versión. Contiene los items como subdocumentos embebidos.
- **QuoteItem**: Subdocumento embebido dentro de QuoteVersion. Representa una línea de la cotización (producto, servicio, mano de obra, material, repuesto).
- **State Machine**: 5 estados con validación explícita por transición: `draft → sent → approved (terminal)`, con bifurcaciones a `rejected`, `expired` (terminales) y `cancelled` (terminal, desde draft o sent).
- **Number Generation**: Sistema de contador secuencial por tenant (reutilizando el patrón de `src/operations/helpers/counter.ts`), con prefijo configurable por tenant (default: `COT`).
- **Quote → WorkOrder Conversion**: Proceso transaccional que crea una WorkOrder a partir de una Quote en estado `approved`. Copia datos comerciales como información operativa, sin crear automáticamente equipos.

**Principios de diseño:**

- QuoteVersion como entidad separada para preservar historial completo de revisiones sin crecimiento excesivo del documento Quote.
- QuoteItems como subdocumentos embebidos en QuoteVersion (no entidad separada) porque siempre se consultan con su versión y no tienen identidad propia.
- Tax/discount a nivel de Quote (global), no por item — simplifica el modelo y cubre el caso de uso más común.
- `approved` es estado terminal, consistente con el patrón de `won` en Leads.
- `rejected` y `expired` también son terminales — no se puede reabrir una cotización rechazada o vencida. Para un nuevo intento, se crea una nueva Quote.
- `cancelled` desde `draft` o `sent`, sin restricciones adicionales.
- El contador secuencial NO resetea por año — es estrictamente incremental por tenant, usando el sistema existente de contadores atómicos de MongoDB.
- La conversión Quote → WorkOrder usa el mismo patrón transaccional que la conversión Lead → Client en Fase 4.

---

## 2. Capacidades

### C1: Quote CRUD con tenant isolation y soft delete

**Descripción**: Operaciones CRUD completas sobre Quotes con aislamiento multitenant, soft delete, y auditoría. Todos los filtros de listado incluyen automámicamente `tenantId` y excluyen soft-deleted.

**Entidades involucradas**: Quote, QuoteVersion, QuoteItem

**Reglas de negocio detalladas:**

- **Creación**: Al crear una Quote se debe proveer `clientId`, y opcionalmente `locationId`. El sistema inicializa `status` como `draft`. La creación genera automáticamente el `number` usando el contador secuencial del tenant. Se crea automáticamente la **QuoteVersion 1** con los items proporcionados. `validUntil` es opcional al crear, default 30 días desde la creación. `createdBy` y `updatedBy` se setean al usuario autenticado.
- **Lectura**: Filtros soportados: `status`, `clientId`, `createdBy`, rango de fechas (`createdAtGte`, `createdAtLte`). Siempre scoped a `tenantId` + `deletedAt: null`.
- **Actualización (PATCH general)**: NO permite cambiar `status`, `number`, `tenantId`. Si se modifican campos comerciales (items, title, description, notes, discountAmount, validUntil), se debe crear automáticamente una **nueva QuoteVersion** con versión incrementada. `updatedBy` se actualiza siempre. Los campos financieros calculados (subtotal, discountAmount, taxAmount, total) se recalculan automáticamente.
- **Soft delete**: Setea `deletedAt` y `deletedBy`. No se permite hard-delete. Solo se permite soft-delete si la Quote está en estado `draft` o `cancelled`. Quotes en `sent`, `approved`, `rejected` o `expired` NO pueden eliminarse.
- **Campos inmutables post-creación**: `tenantId`, `number`, `createdBy`.

**Escenarios:**

```
Escenario 1: Creación exitosa de Quote con versión inicial
  Dado un usuario autenticado con permiso QUOTES_CREATE
    y datos válidos: { clientId, items: [{ description: "Split 3000f", type: "product", quantity: 2, unitPrice: 45000 }] }
  Cuando envía POST /api/crm/quotes
  Entonces el sistema crea una Quote con status "draft"
    y number = "COT-0001" (primer contador del tenant)
    y currentVersion = 1
    y se crea una QuoteVersion con version = 1
    y los items se almacenan dentro de la QuoteVersion
    y se calcula subtotal = 90000
    y discountAmount = 0, taxAmount = 0, total = 90000
    y createdBy = ID del usuario
    y se registra una actividad con entityType "quote" y action "created"

Escenario 2: Actualización de contenido comercial crea nueva versión
  Dado una Quote en estado "draft" con currentVersion = 1
  Cuando envía PATCH /api/crm/quotes/:id { items: [ ...nuevos items... ], discountAmount: 5000 }
  Entonces el sistema:
    - incrementa currentVersion a 2
    - crea una nueva QuoteVersion con version = 2 y los nuevos items
    - recalcula total = subtotal - discountAmount + taxAmount
    - NO modifica QuoteVersion 1 (histórico preservado)
    - registra Activity indicando nueva versión

Escenario 3: Listado con filtros por estado
  Dado un tenant con 8 quotes en "draft" y 4 en "sent"
  Cuando envía GET /api/crm/quotes?status=draft
  Entonces devuelve solo las 8 quotes en estado "draft"
    y todas pertenecen al tenantId del usuario autenticado
    y ninguna tiene deletedAt populado

Escenario 4: Soft delete de quote en estado draft
  Dado una Quote en estado "draft"
  Cuando envía DELETE /api/crm/quotes/:id
  Entonces el sistema setea deletedAt con la fecha actual
    y setea deletedBy con el ID del usuario
    y devuelve 200 OK

Escenario 5: Soft delete bloqueado en estado sent
  Dado una Quote en estado "sent"
  Cuando envía DELETE /api/crm/quotes/:id
  Entonces el sistema rechaza con error 422
    y el mensaje indica que solo se pueden eliminar quotes en estado "draft" o "cancelled"

Escenario 6: Protección de campos inmutables
  Dado una Quote existente
  Cuando envía PATCH /api/crm/quotes/:id con { tenantId: otroTenant, number: "OTRO-0001" }
  Entonces el sistema rechaza con error 422
    y el mensaje indica que tenantId y number son inmutables
```

**Criterios de aceptación:**

- [ ] CRUD completo funciona con tenant isolation
- [ ] Soft delete no elimina físicamente el documento
- [ ] Listado excluye soft-deleted por defecto
- [ ] No se puede eliminar una Quote en estado `sent`, `approved`, `rejected` o `expired`
- [ ] No se puede hard-destroy una Quote (solo soft-delete)
- [ ] Los filtros de listado funcionan correctamente
- [ ] Los campos financieros se calculan automáticamente
- [ ] La modificación de contenido comercial crea una nueva QuoteVersion automáticamente
- [ ] Las QuoteVersions históricas son inmutables

---

### C2: Status transitions con state machine

**Descripción**: Los cambios de estado de Quote siguen una state machine explícita con validación de guard conditions. No se permite actualizar `status` vía PATCH general — solo mediante los endpoints específicos de transición.

**Entidades involucradas**: Quote

**Reglas de negocio detalladas:**

- La state machine se define en `src/quotes/helpers/state-machine.ts` siguiendo el mismo patrón que `src/operations/helpers/state-machine.ts` y `src/leads/helpers/state-machine.ts`.
- Transiciones válidas:

```
draft ──────► sent ──────► approved (terminal)
                  │
                  ├──► rejected (terminal)
                  │
                  ├──► expired (terminal)
                  │
draft ──────► cancelled (terminal)
sent  ──────► cancelled (terminal)
```

- **Transiciones masivas** (`sent → expired`): Un proceso batch (cron/scheduled job) debe ejecutarse diariamente para marcar como `expired` todas las Quotes en estado `sent` cuya `validUntil` sea anterior a la fecha actual.
- `approved`, `rejected`, `expired` y `cancelled` son estados terminales. No admiten transiciones salientes.
- Cada transición registra un ActivityLog con `entityType: "quote"`.
- Las transiciones se ejecutan mediante endpoints específicos, no vía PATCH general.

**Escenarios:**

```
Escenario 1: Transición draft → sent con validación de campos requeridos
  Dado una Quote en estado "draft"
    y la quote tiene al menos un item, clientId, y validUntil no vencido
  Cuando envía POST /api/crm/quotes/:id/send
  Entonces el sistema cambia el estado a "sent"
    y setea sentAt con la fecha actual
    y registra ActivityLog con action "status_changed" y metadata { from: "draft", to: "sent" }
    y devuelve la Quote actualizada

Escenario 2: Transición draft → sent sin items
  Dado una Quote en estado "draft" con items vacíos
  Cuando envía POST /api/crm/quotes/:id/send
  Entonces el sistema rechaza con error 422
    y el mensaje indica que se requiere al menos un item para enviar

Escenario 3: Transición sent → approved
  Dado una Quote en estado "sent"
    y validUntil es posterior a la fecha actual
  Cuando envía POST /api/crm/quotes/:id/approve
  Entonces el sistema cambia el estado a "approved"
    y setea approvedAt con la fecha actual
    y el estado es terminal

Escenario 4: Transición inválida draft → approved (salteando sent)
  Dado una Quote en estado "draft"
  Cuando envía POST /api/crm/quotes/:id/approve
  Entonces el sistema rechaza con error 422
    y el mensaje indica que la transición draft → approved no está permitida

Escenario 5: Intento de transición desde estado terminal
  Dado una Quote en estado "approved"
  Cuando envía POST /api/crm/quotes/:id/send
  Entonces el sistema rechaza con error 422
    y el mensaje indica que "approved" es un estado terminal

Escenario 6: Transición sent → rejected
  Dado una Quote en estado "sent"
  Cuando envía POST /api/crm/quotes/:id/status { status: "rejected", reason: "Precio muy alto" }
  Entonces el sistema cambia el estado a "rejected"
    y guarda rejectedReason: "Precio muy alto"
    y rejectedAt se setea automáticamente
    y el estado es terminal

Escenario 7: Expiración batch
  Dado una Quote en estado "sent" con validUntil = "2026-05-01"
    y la fecha actual es "2026-06-01"
  Cuando el job de expiración se ejecuta
  Entonces la Quote cambia a estado "expired"
    y se registra ActivityLog con action "expired"
```

**Criterios de aceptación:**

- [ ] State machine implementada con `VALID_TRANSITIONS` y `validateTransition()`
- [ ] `draft → sent` requiere al menos un item, clientId, validUntil no vencido
- [ ] `sent → approved` requiere validUntil vigente
- [ ] `sent → rejected` requiere razón opcional, se almacena en `rejectedReason` y `rejectedAt`
- [ ] Estados terminales (`approved`, `rejected`, `expired`, `cancelled`) no admiten transiciones
- [ ] Transiciones inválidas devuelven error 422 con mensaje explicativo
- [ ] Cada transición registra ActivityLog con action "status_changed"
- [ ] No se puede cambiar status vía PATCH genérico de Quote
- [ ] Expiración batch existe y se ejecuta periódicamente
- [ ] cancelled desde draft o sent (no desde approved/rejected/expired)

---

### C3: Versioning completo con QuoteVersion

**Descripción**: Cada modificación sustancial del contenido comercial de una Quote genera una nueva QuoteVersion preservando el historial completo. QuoteVersion es una entidad separada (no embebida) para evitar que el documento Quote crezca indefinidamente.

**Entidades involucradas**: Quote, QuoteVersion, QuoteItem

**Reglas de negocio detalladas:**

- **Creación de versión**: Se crea una QuoteVersion cada vez que se modifica: `items[]`, `title`, `description`, `discountAmount`, `validUntil`, o `notes`. La modificación de campos no comerciales (`clientId`, `assignedTo`, etc.) NO genera nueva versión — se actualiza directamente en Quote.
- **Numeración de versiones**: Incremental por Quote. La primera versión siempre es 1. Cada nueva versión incrementa en 1.
- **Quote.currentVersion**: Campo denormalizado en Quote que refleja la última versión activa. Se actualiza al crear cada nueva QuoteVersion.
- **Inmutabilidad**: Una vez creada, una QuoteVersion NO puede modificarse ni eliminarse. Es un registro histórico.
- **Items**: Los QuoteItem son subdocumentos embebidos dentro de cada QuoteVersion. No tienen entidad propia.
- **Campos financieros en Quote**: `subtotal`, `discountAmount`, `taxAmount`, `total` se almacenan en Quote (no en QuoteVersion). Representan el estado actual. La QuoteVersion también almacena sus propios campos financieros al momento de creación (snapshot financiero de esa versión).
- **Consulta de versiones**: Se puede obtener el historial completo de versiones de una Quote mediante un endpoint específico.
- **Copia de versión actual**: Al crear una nueva versión, el sistema parte de los datos de la versión actual como base y aplica los cambios del request. Si no se envían items, se copian de la versión anterior.

**Escenarios:**

```
Escenario 1: Creación de Quote genera Version 1
  Dado un usuario creando una Quote con 3 items
  Cuando el sistema crea la Quote
  Entonces se crea QuoteVersion con version = 1
    y QuoteVersion contiene los 3 items como subdocumentos
    y Quote.currentVersion = 1
    y QuoteVersion.items.length = 3

Escenario 2: Nueva versión por modificación de items
  Dado una Quote existente con currentVersion = 1 y 3 items
  Cuando se actualiza un item existente y se agrega uno nuevo
  Entonces el sistema:
    - crea QuoteVersion con version = 2
    - QuoteVersion 2 contiene los 4 items (3 originales con el modificado + 1 nuevo)
    - Quote.currentVersion = 2
    - QuoteVersion 1 permanece intacta con sus 3 items originales

Escenario 3: Actualización sin nueva versión
  Dado una Quote en estado "draft" con currentVersion = 1
  Cuando se actualiza solo assignedTo (campo no comercial)
  Entonces el sistema actualiza Quote.assignedTo directamente
    y NO crea una nueva QuoteVersion
    y Quote.currentVersion sigue siendo 1

Escenario 4: Consulta de historial de versiones
  Dado una Quote con 3 versiones creadas
  Cuando envía GET /api/crm/quotes/:id/versions
  Entonces devuelve 3 QuoteVersion ordenadas por version descendente
    y cada versión incluye sus items y valores financieros de ese momento

Escenario 5: Inmutabilidad de versiones históricas
  Dado una QuoteVersion con version = 1
  Cuando se intenta modificar mediante cualquier operación
  Entonces el sistema rechaza con error 405
    y QuoteVersion 1 permanece sin cambios
```

**Criterios de aceptación:**

- [ ] QuoteVersion es entidad separada con su propio schema/model
- [ ] QuoteItem es subdocumento embebido en QuoteVersion
- [ ] Cada modificación comercial crea una nueva QuoteVersion
- [ ] Quote.currentVersion se mantiene sincronizado
- [ ] QuoteVersions históricas son inmutables
- [ ] Campos financieros se snapshotan en cada QuoteVersion
- [ ] Endpoint de consulta de versiones funciona correctamente
- [ ] Actualizaciones no comerciales NO crean nueva versión

---

### C4: Number generation con contador secuencial

**Descripción**: Cada Quote recibe un número único generado automáticamente usando un contador secuencial atómico por tenant. El formato y prefijo son configurables por tenant.

**Entidades involucradas**: Quote, Counter (infraestructura existente)

**Reglas de negocio detalladas:**

- **Formato**: `{PREFIX}-{SEQUENTIAL}` donde:
  - `PREFIX`: Prefijo configurable por tenant (campo `quoteNumberPrefix` en Tenant). Default: `COT`.
  - `SEQUENTIAL`: Número secuencial zero-padded de 4 dígitos. Ej: `0001`, `0012`, `0123`, `9999`, `10000` (sin límite de dígitos más allá de 9999).
- **Contador**: Usa el mismo patrón que `src/operations/helpers/counter.ts` pero con un modelo específico para Quotes (`QuoteCounter`). La clave del contador es `COT-{tenantId}` (usando el prefijo del tenant).
- **Atomicidad**: La generación usa `findOneAndUpdate` con `$inc` para garantizar unicidad incluso bajo concurrencia.
- **Sin reset anual**: El contador es estrictamente incremental SIN reset por año calendario. Esto simplifica el modelo y evita colisiones.
- **Unicidad**: El `number` debe ser único dentro del tenant (enforced por índice único compuesto `{ tenantId, number }`).
- **Configuración del prefijo**: Se agrega el campo `quoteNumberPrefix` a la entidad Tenant (o a una configuración del tenant), con default `COT`. El cambio de prefijo SOLO afecta a Quotes nuevas, no retroactivo.

**Escenarios:**

```
Escenario 1: Generación del primer número
  Dado un tenant con prefijo "COT" y sin Quotes previas
  Cuando se crea la primera Quote
  Entonces el número generado es "COT-0001"

Escenario 2: Secuencia incremental
  Dado un tenant con prefijo "COT" que ya tiene Quotes con números "COT-0001" a "COT-0005"
  Cuando se crea una nueva Quote
  Entonces el número generado es "COT-0006"

Escenario 3: Prefijo personalizado
  Dado un tenant con prefijo configurado como "CLIMAX"
  Cuando se crea la primera Quote
  Entonces el número generado es "CLIMAX-0001"

Escenario 4: Concurrencia
  Dado 2 solicitudes simultáneas de creación de Quote
  Cuando ambas peticiones se procesan concurrentemente
  Entonces cada Quote recibe un número diferente y único
    y no hay colisiones por la operación atómica de MongoDB

Escenario 5: Sin reset anual
  Dado un tenant que creó Quotes en 2025 hasta "COT-0123"
  Cuando se crea una Quote en 2026
  Entonces el número generado es "COT-0124" (continúa, no resetea)
```

**Criterios de aceptación:**

- [ ] Número generado automáticamente al crear Quote
- [ ] Formato: `{PREFIX}-{SEQUENTIAL}` con zero-padding de 4 dígitos
- [ ] Prefijo configurable por tenant con default "COT"
- [ ] Contador atómico sin colisiones bajo concurrencia
- [ ] Sin reset anual
- [ ] Único dentro del tenant (índice único compuesto)
- [ ] Cambio de prefijo no afecta Quotes existentes
- [ ] El campo `quoteNumberPrefix` se agrega a la configuración del tenant

---

### C5: Quote → WorkOrder conversion

**Descripción**: Convierte una Quote en estado `approved` a una WorkOrder del módulo de Operaciones. Proceso transaccional: si falla algún paso, no queda estado inconsistente.

**Entidades involucradas**: Quote, QuoteVersion, WorkOrder (Operations), ActivityLog

**Reglas de negocio detalladas:**

- Solo se pueden convertir Quotes en estado `approved`. Cualquier otro estado devuelve error 422.
- Una Quote solo puede convertirse una vez. Si `convertedToWorkOrder` ya está seteado, devuelve error 409.
- El proceso es transaccional (usa transacción de MongoDB si está disponible, o enfoque de operación atómica):
  1. Leer la QuoteVersion actual (según `currentVersion`).
  2. Crear `WorkOrder` en estado `draft` con los datos mapeados.
  3. Actualizar Quote: `status = "approved"` (debe estar en approved), `convertedToWorkOrder = workOrder._id`, `convertedAt = now`.
- Mapeo de campos (detallado en sección 7).
- Si cualquier paso falla, la transacción revierte todo.
- Después de la conversión, la Quote no puede eliminarse (ya está en estado terminal `approved`).
- La conversión registra ActivityLog.
- NO se crean equipos automáticamente. Los items de la Quote se copian como texto en la descripción/notas de la WorkOrder — no se crean entidades Equipment.

**Escenarios:**

```
Escenario 1: Conversión exitosa
  Dado una Quote en estado "approved"
    con items: [ { description: "Split 3000f", type: "product", quantity: 2 }, { description: "Instalación", type: "service", quantity: 1 } ]
    y clientId, locationId válidos
  Cuando envía POST /api/crm/quotes/:id/convert
  Entonces el sistema:
    - crea una WorkOrder en estado "draft"
    - copia clientId y locationId a la WorkOrder
    - incluye número de Quote y versión en description/workPerformed
    - setea Quote.convertedToWorkOrder = workOrder._id
    - setea Quote.convertedAt = fecha actual
    - registra ActivityLog con action "converted"
    - devuelve la Quote actualizada con datos de la WorkOrder creada

Escenario 2: Conversión de Quote en estado incorrecto
  Dado una Quote en estado "sent"
  Cuando envía POST /api/crm/quotes/:id/convert
  Entonces el sistema rechaza con error 422
    y el mensaje indica que solo quotes "approved" pueden convertirse

Escenario 3: Conversión duplicada
  Dado una Quote ya convertida (convertedToWorkOrder seteado)
  Cuando envía POST /api/crm/quotes/:id/convert
  Entonces el sistema rechaza con error 409
    y el mensaje indica que la Quote ya fue convertida

Escenario 4: Conversión con items como descripción operativa
  Dado una Quote approved con 3 items
  Cuando se convierte a WorkOrder
  Entonces la WorkOrder.description incluye un resumen de los items
    y NO se crean entidades Equipment
    y los items no se convierten en operaciones individuales
```

**Criterios de aceptación:**

- [ ] Solo se convierte una Quote en estado `approved`
- [ ] Proceso transaccional (todo o nada)
- [ ] WorkOrder creada en estado `draft`
- [ ] `clientId` y `locationId` se copian a la WorkOrder
- [ ] Número de Quote y versión se incluyen en la WorkOrder
- [ ] `Quote.convertedToWorkOrder` y `Quote.convertedAt` seteados
- [ ] Quote ya convertida devuelve error 409
- [ ] No se crean equipos automáticamente
- [ ] Se registra ActivityLog de conversión

---

### C6: Activity logging via ActivityLog

**Descripción**: Todas las operaciones sobre Quotes registran automáticamente actividades en la entidad ActivityLog existente, usando `entityType: "quote"`. Esto permite tener un timeline unificado de actividades.

**Entidades involucradas**: Quote, ActivityLog

**Reglas de negocio detalladas:**

- La entidad ActivityLog (`src/core/models/activity-log`) ya soporta `entityType` polimórfico. Se usa `entityType: "quote"` para actividades de Quote.
- Eventos que registran ActivityLog:
  - Quote creada → `action: "created"`
  - Quote actualizada (campos no comerciales) → `action: "updated"`, `metadata: { changes: [...] }`
  - Nueva versión creada → `action: "version_created"`, `metadata: { version: 2, changes: [...] }`
  - Status change → `action: "status_changed"`, `metadata: { from: "draft", to: "sent" }`
  - Expiración → `action: "expired"`
  - Conversión → `action: "converted"`, `metadata: { workOrderId: ... }`
- `actorId` se setea al usuario autenticado que ejecutó la acción.
- Las actividades son append-only — no se modifican ni eliminan.
- El timeline de una Quote se consulta vía `getEntityHistory(tenantId, "quote", quoteId)`.

**Escenarios:**

```
Escenario 1: Timeline de Quote
  Dado una Quote que fue creada, actualizada (nueva versión), enviada y aprobada
  Cuando se consulta getEntityHistory(tenantId, "quote", quoteId)
  Entonces devuelve 4 actividades ordenadas por timestamp descendente:
    - status_changed: "sent → approved"
    - status_changed: "draft → sent"
    - version_created: "Versión 2 creada"
    - created: "Quote creada"

Escenario 2: ActivityLog sin extensión de schema
  Dado que ActivityLog ya soporta entityType string
  Cuando se crea una actividad con entityType "quote"
  Entonces el sistema la acepta sin errores
    y la actividad se persiste correctamente

Escenario 3: Vinculación de change description en nueva versión
  Dado una Quote actualizada con modificación de items
  Cuando se registra la ActivityLog
  Entonces metadata.changes contiene "items" y "discountAmount" si corresponden
    y la descripción indica qué cambió
```

**Criterios de aceptación:**

- [ ] Todas las operaciones de Quote registran ActivityLog
- [ ] entityType "quote" funciona con el schema existente
- [ ] Status changes usan action "status_changed"
- [ ] Las actividades son consultables por quoteId
- [ ] actorId se mapea correctamente
- [ ] metadata preserva contexto de la operación

---

## 3. Especificación Detallada de Entidades

### 3.1 Quote

**Archivo**: `src/quotes/types/quote.ts`

```typescript
import { Document, Types } from 'mongoose';
import { IAuditFields } from '../../crm/types/audit-fields';

export type QuoteStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'expired' | 'cancelled';

export interface IQuote extends Document, IAuditFields {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  clientId: Types.ObjectId;
  locationId: Types.ObjectId | null;
  number: string;
  status: QuoteStatus;
  currentVersion: number;
  validUntil: Date | null;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  sentAt: Date | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  rejectedReason: string | null;
  convertedToWorkOrder: Types.ObjectId | null;
  convertedAt: Date | null;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  deletedBy: Types.ObjectId | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateQuoteInput = {
  clientId: string;
  locationId?: string;
  validUntil?: string; // ISO date string
  title: string;
  description?: string;
  items: CreateQuoteItemInput[];
  discountAmount?: number;
  taxAmount?: number;
  notes?: string;
};

export type UpdateQuoteInput = Partial<{
  title: string;
  description: string;
  items: CreateQuoteItemInput[];
  discountAmount: number;
  taxAmount: number;
  validUntil: string;
  notes: string;
  locationId: string;
}>;
```

**Campos detallados:**

| Campo | Tipo | Requerido | Default | Validaciones |
|---|---|---|---|---|
| `_id` | `Types.ObjectId` | Auto | Auto | — |
| `tenantId` | `Types.ObjectId` (ref Tenant) | Sí | — | — |
| `clientId` | `Types.ObjectId` (ref Client) | Sí | — | — |
| `locationId` | `Types.ObjectId` (ref Location) | No | `null` | — |
| `number` | `string` | Sí (auto) | — | Formato: `{PREFIX}-{SEQUENTIAL}`, único por tenant |
| `status` | `QuoteStatus` (enum) | No | `draft` | `draft` \| `sent` \| `approved` \| `rejected` \| `expired` \| `cancelled` |
| `currentVersion` | `number` | Sí (auto) | `1` | >= 1 |
| `validUntil` | `Date` | No | `createdAt + 30 days` | Debe ser futuro al enviar |
| `subtotal` | `number` | Sí (auto) | `0` | >= 0, calculado: suma de (quantity * unitPrice) |
| `discountAmount` | `number` | No | `0` | >= 0 |
| `taxAmount` | `number` | No | `0` | >= 0 |
| `total` | `number` | Sí (auto) | `0` | >= 0, calculado: subtotal - discountAmount + taxAmount |
| `sentAt` | `Date` | No | `null` | Setear al hacer transición draft → sent |
| `approvedAt` | `Date` | No | `null` | Setear al hacer transición sent → approved |
| `rejectedAt` | `Date` | No | `null` | Setear al hacer transición sent → rejected |
| `rejectedReason` | `string` | No | `null` | Max 500 chars |
| `convertedToWorkOrder` | `Types.ObjectId` (ref WorkOrder) | No | `null` | Setear en conversión |
| `convertedAt` | `Date` | No | `null` | Setear en conversión |
| `createdBy` | `Types.ObjectId` (ref User) | Sí | — | — |
| `updatedBy` | `Types.ObjectId` (ref User) | Sí | — | — |
| `deletedBy` | `Types.ObjectId` (ref User) | No | — | — |
| `deletedAt` | `Date` | No | `null` | — |

### 3.2 QuoteVersion

**Archivo**: `src/quotes/types/quote-version.ts`

```typescript
import { Document, Types } from 'mongoose';

export type QuoteItemType = 'product' | 'service' | 'labor' | 'material' | 'part';

export interface IQuoteItem {
  description: string;
  type: QuoteItemType;
  quantity: number;
  unitPrice: number;
  subtotal: number; // calculated: quantity * unitPrice
}

export interface IQuoteVersion extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  quoteId: Types.ObjectId;
  version: number;
  title: string;
  description?: string;
  items: IQuoteItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  notes?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
}

export interface CreateQuoteVersionInput {
  quoteId: string;
  version: number;
  title: string;
  description?: string;
  items: CreateQuoteItemInput[];
  discountAmount?: number;
  taxAmount?: number;
  notes?: string;
  createdBy: string;
}

export interface CreateQuoteItemInput {
  description: string;
  type: QuoteItemType;
  quantity: number;
  unitPrice: number;
}
```

**Campos detallados — QuoteVersion:**

| Campo | Tipo | Requerido | Default | Validaciones |
|---|---|---|---|---|
| `_id` | `Types.ObjectId` | Auto | Auto | — |
| `tenantId` | `Types.ObjectId` (ref Tenant) | Sí | — | — |
| `quoteId` | `Types.ObjectId` (ref Quote) | Sí | — | — |
| `version` | `number` | Sí | — | >= 1, único por quoteId |
| `title` | `string` | Sí | — | Max 200 chars |
| `description` | `string` | No | — | Max 2000 chars |
| `items` | `IQuoteItem[]` | Sí | `[]` | Al menos 1 item para transition a sent |
| `subtotal` | `number` | Sí (auto) | `0` | >= 0 |
| `discountAmount` | `number` | No | `0` | >= 0 |
| `taxAmount` | `number` | No | `0` | >= 0 |
| `total` | `number` | Sí (auto) | `0` | >= 0 |
| `notes` | `string` | No | — | Max 2000 chars |
| `createdBy` | `Types.ObjectId` (ref User) | Sí | — | — |
| `createdAt` | `Date` | Auto | Auto | — |

**Campos detallados — QuoteItem (subdocumento):**

| Campo | Tipo | Requerido | Default | Validaciones |
|---|---|---|---|---|
| `description` | `string` | Sí | — | Max 500 chars |
| `type` | `QuoteItemType` (enum) | Sí | — | `product` \| `service` \| `labor` \| `material` \| `part` |
| `quantity` | `number` | Sí | — | > 0 |
| `unitPrice` | `number` | Sí | — | >= 0 |
| `subtotal` | `number` | Sí (auto) | — | Calculado: quantity * unitPrice |

### 3.3 QuoteCounter (infraestructura)

**Archivo**: `src/quotes/helpers/counter.ts`

Reutiliza el mismo patrón que `src/operations/helpers/counter.ts` pero con un modelo y claves específicas para Quotes.

```typescript
interface IQuoteCounter {
  _id: string;        // "COT-{tenantId}" — clave compuesta por prefijo + tenant
  seq: number;        // contador incremental
}
```

---

## 4. Tabla de Transiciones de Estado

### 4.1 State Machine

```
draft ──────► sent ──────► approved (terminal)
                  │
                  ├──► rejected (terminal)
                  │
                  ├──► expired (terminal)
                  │
draft ──────► cancelled (terminal)
sent  ──────► cancelled (terminal)
```

### 4.2 Tabla de Transiciones

| From | To | Guard / Precondición |
|---|---|---|
| `draft` | `sent` | Al menos 1 item en la versión actual, `clientId` presente, `validUntil` es futuro o null |
| `draft` | `cancelled` | Ninguna |
| `sent` | `approved` | `validUntil` es null o fecha futura (no expirada) |
| `sent` | `rejected` | Ninguna (razón opcional) |
| `sent` | `expired` | `validUntil` presente y fecha pasada (ejecutado por batch, no por usuario) |
| `sent` | `cancelled` | Ninguna |
| `approved` | — | Terminal — sin transiciones salientes |
| `rejected` | — | Terminal — sin transiciones salientes |
| `expired` | — | Terminal — sin transiciones salientes |
| `cancelled` | — | Terminal — sin transiciones salientes |

### 4.3 Guard Conditions Detalladas

| Transición | Validación |
|---|---|
| `draft → sent` | `items.length > 0` AND `clientId` no nulo AND (`validUntil` nulo OR `validUntil` > ahora) |
| `sent → approved` | (`validUntil` nulo OR `validUntil` > ahora) |
| `sent → rejected` | Sin validación técnica (razón opcional guardada en rejectedReason) |
| `sent → expired` | `validUntil` no nulo AND `validUntil` < ahora — solo ejecutable por batch job |
| `cualquiera → terminal` | `from !== to` (no auto-transición) |

### 4.4 Código de State Machine

```typescript
// src/quotes/helpers/state-machine.ts

import { QuoteStatus } from '../types/quote';

export const VALID_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  draft: ['sent', 'cancelled'],
  sent: ['approved', 'rejected', 'expired', 'cancelled'],
  approved: [],
  rejected: [],
  expired: [],
  cancelled: [],
};

export const TERMINAL_STATUSES: QuoteStatus[] = [
  'approved', 'rejected', 'expired', 'cancelled',
];

export const TRANSITION_ENDPOINTS: Partial<Record<QuoteStatus, string>> = {
  sent: 'send',
  approved: 'approve',
  rejected: 'status',
  cancelled: 'status',
};

export function canTransition(from: QuoteStatus, to: QuoteStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export class TransitionError extends Error {
  constructor(
    message: string,
    public readonly from: QuoteStatus,
    public readonly to: QuoteStatus,
    public readonly reason: string,
  ) {
    super(message);
    this.name = 'TransitionError';
  }
}

export function validateTransition(from: QuoteStatus, to: QuoteStatus): void {
  if (!canTransition(from, to)) {
    throw new TransitionError(
      `Transición inválida: ${from} → ${to}`,
      from, to,
      `La transición de '${from}' a '${to}' no está permitida por la máquina de estados.`,
    );
  }
}

// Guard: draft → sent
export function validateSendRequirements(quote: {
  items: unknown[];
  clientId: unknown;
  validUntil: Date | null;
}): void {
  const missing: string[] = [];
  if (!quote.items?.length) missing.push('items');
  if (!quote.clientId) missing.push('clientId');
  if (quote.validUntil && quote.validUntil <= new Date()) missing.push('validUntil no vencido');
  if (missing.length > 0) {
    throw new TransitionError(
      `Campos requeridos faltantes: ${missing.join(', ')}`,
      'draft', 'sent',
      `Se requiere ${missing.join(', ')} para enviar la cotización.`,
    );
  }
}

// Guard: sent → approved
export function validateApproveRequirements(quote: {
  validUntil: Date | null;
}): void {
  if (quote.validUntil && quote.validUntil <= new Date()) {
    throw new TransitionError(
      'La cotización ha expirado',
      'sent', 'approved',
      'No se puede aprobar una cotización vencida. Cree una nueva cotización.',
    );
  }
}
```

---

## 5. API Endpoints Detallados

### 5.1 POST /api/crm/quotes — Crear Quote

```
Request Body:
{
  "clientId": "client-object-id",          // required, ObjectId
  "locationId": "location-object-id",      // optional, ObjectId
  "validUntil": "2026-07-20T00:00:00Z",    // optional, ISO date (default: +30 days)
  "title": "Cotización Split 3000f",       // required, string
  "description": "Instalación completa",    // optional, string
  "items": [                                // required, array
    {
      "description": "Split 3000f",         // required, string
      "type": "product",                    // required, enum
      "quantity": 2,                        // required, number > 0
      "unitPrice": 45000                    // required, number >= 0
    },
    {
      "description": "Instalación básica",
      "type": "service",
      "quantity": 1,
      "unitPrice": 15000
    }
  ],
  "discountAmount": 5000,                   // optional, number >= 0 (default: 0)
  "taxAmount": 9000,                        // optional, number >= 0 (default: 0)
  "notes": "Incluye garantía de 1 año"     // optional, string
}

Response 201:
{
  "data": {
    "_id": "quote-object-id",
    "tenantId": "tenant-object-id",
    "clientId": "client-object-id",
    "locationId": "location-object-id",
    "number": "COT-0001",
    "status": "draft",
    "currentVersion": 1,
    "validUntil": "2026-07-20T00:00:00Z",
    "subtotal": 105000,
    "discountAmount": 5000,
    "taxAmount": 9000,
    "total": 109000,
    "sentAt": null,
    "approvedAt": null,
    "rejectedAt": null,
    "rejectedReason": null,
    "convertedToWorkOrder": null,
    "convertedAt": null,
    "createdBy": "user-object-id",
    "updatedBy": "user-object-id",
    "deletedAt": null,
    "createdAt": "2026-06-21T12:00:00.000Z",
    "updatedAt": "2026-06-21T12:00:00.000Z"
  },
  "version": {
    "version": 1,
    "items": [ /* items del request */ ],
    "subtotal": 105000,
    "discountAmount": 5000,
    "taxAmount": 9000,
    "total": 109000
  }
}

Errors:
- 400: validation error (clientId required, items required, item.type inválido, quantity <= 0)
- 403: insufficient permissions (QUOTES_CREATE)
```

### 5.2 GET /api/crm/quotes — Listar Quotes

```
Query Params:
- status: QuoteStatus (opcional, filtra por estado)
- clientId: ObjectId (opcional, filtra por cliente)
- createdBy: ObjectId (opcional, filtra por creador)
- createdAtGte: ISO Date (opcional, rango inicio)
- createdAtLte: ISO Date (opcional, rango fin)
- includeDeleted: boolean (default false, solo admin)
- page: number (default 1)
- limit: number (default 20, max 100)
- sort: string (default "-createdAt", valores: "createdAt", "-createdAt", "number", "-number", "total", "-total")

Response 200:
{
  "data": [ /* IQuote[] con resumen — SIN items para eficiencia */ ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 47,
    "totalPages": 3
  },
  "filters": { /* echo de filtros aplicados */ }
}

Errors:
- 403: insufficient permissions (QUOTES_READ)
```

### 5.3 GET /api/crm/quotes/:id — Obtener Quote

```
Response 200:
{
  "data": { /* IQuote completo */ },
  "currentVersion": { /* IQuoteVersion actual con items */ }
}

Errors:
- 404: quote not found (o soft-deleted)
- 403: insufficient permissions (QUOTES_READ)
```

### 5.4 PATCH /api/crm/quotes/:id — Actualizar Quote

```
Request Body (todos opcionales):
{
  "title": "Cotización Split 3000f - Actualizada",
  "description": "Instalación completa con materiales",
  "items": [ /* nuevos items — crea nueva QuoteVersion */ ],
  "discountAmount": 3000,
  "taxAmount": 8500,
  "validUntil": "2026-08-01T00:00:00Z",
  "notes": "Garantía extendida a 2 años",
  "locationId": "new-location-object-id"
}

Response 200:
{
  "data": { /* IQuote actualizado */ },
  "version": { /* IQuoteVersion creada (si aplica) */ },
  "newVersion": true  // o false si no hubo cambios comerciales
}

Notas:
- NO permite cambiar: status, number, tenantId, clientId, createdBy
- Si se modifican items, discountAmount, taxAmount, title, description, notes, validUntil → se crea nueva QuoteVersion
- Si solo se modifica locationId → NO se crea nueva versión
- updatedBy se actualiza siempre
- subtotal y total se recalculan automáticamente

Errors:
- 400: validation error
- 404: quote not found
- 422: intento de modificar campos protegidos (status, number, etc.)
- 422: quote en estado terminal (no se puede modificar)
- 403: insufficient permissions (QUOTES_EDIT)
```

### 5.5 POST /api/crm/quotes/:id/send — Enviar Quote (draft → sent)

```
Request Body: (opcional)
{
  "sendTo": ["email@cliente.com"],  // opcional, para futuro envío por email
  "message": "Adjunto cotización solicitada"  // opcional
}

Response 200:
{
  "data": { /* IQuote con status: "sent", sentAt seteado */ }
}

Errors:
- 404: quote not found
- 422: transición no permitida (no está en draft)
- 422: guard condition falla (sin items, sin clientId, validUntil vencido)
- 403: insufficient permissions (QUOTES_STATUS_CHANGE)
```

### 5.6 POST /api/crm/quotes/:id/approve — Aprobar Quote (sent → approved)

```
Request Body: (vacio o metadata opcional)

Response 200:
{
  "data": { /* IQuote con status: "approved", approvedAt seteado */ }
}

Errors:
- 404: quote not found
- 422: transición no permitida (no está en sent)
- 422: quote expirada (validUntil vencido)
- 403: insufficient permissions (QUOTES_APPROVE)
```

### 5.7 PATCH /api/crm/quotes/:id/status — Cambiar Estado (sent → rejected, draft/sent → cancelled)

```
Request Body:
{
  "status": "rejected",       // required, QuoteStatus
  "reason": "Precio muy alto" // optional, string (solo para rejected)
}

Response 200:
{
  "data": { /* IQuote con status actualizado */ }
}

Notas:
- Este endpoint maneja las transiciones que NO tienen endpoint dedicado:
  - sent → rejected (con razón opcional)
  - draft → cancelled
  - sent → cancelled
- approved, expired NO se hacen por este endpoint (approved tiene su endpoint, expired es batch)

Errors:
- 400: status requerido, status inválido
- 404: quote not found
- 422: transición no permitida por state machine
- 403: insufficient permissions (QUOTES_STATUS_CHANGE)
```

### 5.8 POST /api/crm/quotes/:id/convert — Convertir a WorkOrder

```
Request Body: (opcional)
{
  "priority": "normal",       // opcional, para la WorkOrder
  "category": "installation"  // opcional, para la WorkOrder
}

Response 201:
{
  "data": {
    "quote": { /* IQuote actualizado: status "approved", convertedToWorkOrder seteado */ },
    "workOrder": { /* IWorkOrder creada */ }
  }
}

Errors:
- 400: datos inválidos
- 404: quote not found
- 409: quote ya convertida (convertedToWorkOrder ya seteado)
- 422: quote no está en estado "approved"
- 500: error en transacción (rollback automático)
- 403: insufficient permissions (QUOTES_EDIT, WORKORDERS_CREATE)
```

### 5.9 GET /api/crm/quotes/:id/versions — Obtener Versiones

```
Response 200:
{
  "data": [ /* IQuoteVersion[] ordenado por version DESC */ ],
  "totalVersions": 3,
  "currentVersion": 3
}

Errors:
- 404: quote not found
- 403: insufficient permissions (QUOTES_READ)
```

### 5.10 DELETE /api/crm/quotes/:id — Soft Delete

```
Response 200:
{
  "data": { /* IQuote con deletedAt y deletedBy seteados */ }
}

Errors:
- 404: quote not found
- 422: quote en estado "sent", "approved", "rejected" o "expired"
- 403: insufficient permissions (QUOTES_DELETE)
```

---

## 6. Índices

### 6.1 Quote Indexes

| # | Index | Properties | Purpose |
|---|---|---|---|
| 1 | `{ tenantId: 1, status: 1, createdAt: -1 }` | No unique | Query principal: listar quotes por tenant + estado, ordenado por fecha |
| 2 | `{ tenantId: 1, number: 1 }` | **Unique** | Búsqueda exacta por número de cotización |
| 3 | `{ tenantId: 1, clientId: 1, status: 1 }` | No unique | Historial de quotes por cliente |
| 4 | `{ tenantId: 1, createdBy: 1, status: 1 }` | No unique | Quotes creadas por un usuario específico |
| 5 | `{ tenantId: 1, validUntil: 1, status: 1 }` | No unique | Batch de expiración: encontrar quotes "sent" con validUntil vencido |
| 6 | `{ tenantId: 1, deletedAt: 1 }` | No unique | Filtro global de soft-delete para consultas admin |
| 7 | `{ tenantId: 1, convertedToWorkOrder: 1 }` | No unique | Quotes convertidas a WorkOrder (sparce index — solo documentos con valor no null) |

**Justificación**:
- El índice #1 cubre el caso de uso más frecuente: el listado de cotizaciones del comercial (por estado, ordenado por fecha).
- El índice #2 es crítico para la unicidad del número generado por el contador secuencial.
- El índice #3 permite al usuario ver el historial de cotizaciones de un cliente.
- El índice #5 es fundamental para el batch de expiración — sin él, el job requeriría un collection scan.
- El índice #7 es sparse porque `convertedToWorkOrder` es null para la mayoría de las quotes.

### 6.2 QuoteVersion Indexes

| # | Index | Properties | Purpose |
|---|---|---|---|
| 1 | `{ tenantId: 1, quoteId: 1, version: -1 }` | No unique | Historial de versiones de una quote, ordenado por versión descendente |
| 2 | `{ tenantId: 1, quoteId: 1 }` | No unique | Búsqueda de todas las versiones de una quote |

**Justificación**:
- El índice #1 soporta la consulta de timeline de versiones con ordenamiento eficiente.
- QuoteVersion tiene un índice simple adicional para consultas sin orden específico.

### 6.3 QuoteCounter Indexes

| # | Index | Properties | Purpose |
|---|---|---|---|
| 1 | `{ _id: 1 }` | **Unique** (PK) | Búsqueda y actualización atómica del contador por clave |

**Justificación**:
- QuoteCounter usa `_id` como clave compuesta `{PREFIX}-{tenantId}`. La primary key única garantiza que `findOneAndUpdate` con `upsert` funcione correctamente.

---

## 7. Reglas de Conversión Quote → WorkOrder

### 7.1 Mapeo de Campos

| Origen (Quote) | Destino (WorkOrder) | Transformación |
|---|---|---|
| `clientId` | `clientId` | Directo |
| `locationId` | `locationId` | Directo (puede ser null) |
| `number` + `currentVersion` | `title` | `"COT-0001 v2: " + Quote.title` — se concatena número y versión al inicio |
| `title` | `title` | Se concatena con number+version |
| `description` | `description` | Directo |
| `items[].description` | `description` | Se agrega un resumen de items al final de description |
| `_id` | `quoteId` (nuevo campo en WorkOrder) | Referencia a la Quote origen |
| — | `status` | `"draft"` (siempre) |
| — | `priority` | Del request o `"normal"` default |
| — | `category` | Del request o `"installation"` default |

### 7.2 Valores Default de la WorkOrder Creada

| Campo | Valor | Justificación |
|---|---|---|
| `status` | `"draft"` | La WO nace como borrador para completar datos operativos |
| `priority` | `"normal"` | Default seguro; configurable en el request de conversión |
| `category` | `"installation"` | Default seguro; configurable en el request de conversión |
| `clientSnapshot` | Generado desde Client actual | Mismo patrón que Fase 3 — snapshot al momento de creación |
| `locationSnapshot` | Generado desde Location actual | Mismo patrón que Fase 3 |
| `equipmentSnapshot` | `null` | No se crean equipos automáticamente |

### 7.3 Proceso Paso a Paso

```
1. VALIDAR precondiciones:
   - Quote existe y no está soft-deleteada
   - Quote.status === "approved"
   - Quote.convertedToWorkOrder === null (no convertida previamente)

2. LEER QuoteVersion actual (currentVersion):
   - Obtener la versión vigente para acceder a items y contenido

3. INICIAR transacción MongoDB:

   3a. CREAR WorkOrder:
       WorkOrder.create({
         tenantId: quote.tenantId,
         clientId: quote.clientId,
         locationId: quote.locationId,
         quoteId: quote._id,
         title: `${quote.number} v${quote.currentVersion}: ${quoteVersion.title}`,
         description: buildDescription(quoteVersion),
         priority: request.priority || "normal",
         category: request.category || "installation",
         status: "draft",
         clientSnapshot: generar desde Client,
         locationSnapshot: generar desde Location,
         createdBy: authenticatedUserId,
         updatedBy: authenticatedUserId,
       })

   3b. ACTUALIZAR Quote:
       Quote.findByIdAndUpdate(quote._id, {
         convertedToWorkOrder: workOrder._id,
         convertedAt: new Date(),
         updatedBy: authenticatedUserId,
       })

   3c. REGISTRAR ActivityLog:
       logActivity({
         tenantId: quote.tenantId,
         entityType: "quote",
         entityId: quote._id,
         action: "converted",
         actorId: authenticatedUserId,
         metadata: { workOrderId: workOrder._id, workOrderNumber: workOrder.workOrderNumber },
       })

4. CONFIRMAR transacción

5. RETORNAR { quote, workOrder }
```

### 7.4 Función de Construcción de Description

```
function buildDescription(quoteVersion: IQuoteVersion): string {
  const parts: string[] = [];

  if (quoteVersion.description) {
    parts.push(quoteVersion.description);
  }

  if (quoteVersion.items.length > 0) {
    parts.push("--- Items de la cotización ---");
    quoteVersion.items.forEach(item => {
      parts.push(`- [${item.type}] ${item.description} x${item.quantity} @ $${item.unitPrice} = $${item.subtotal}`);
    });
    parts.push(`Subtotal: $${quoteVersion.subtotal}`);
    parts.push(`Total cotizado: $${quoteVersion.total}`);
  }

  if (quoteVersion.notes) {
    parts.push(`--- Notas ---\n${quoteVersion.notes}`);
  }

  return parts.join("\n");
}
```

### 7.5 Lo Que NO Ocurre en la Conversión

| Comportamiento | Excluido | Razón |
|---|---|---|
| Creación de equipos (Equipment) | ❌ No se crea | Los items comerciales no equivalen a activos físicos |
| Copia de items como operaciones separadas | ❌ No se copian | Se incluyen como texto en description |
| Cambio de estado de Quote | ❌ Quote sigue en approved | `approved` es terminal, no se mueve |
| Eliminación de QuoteVersion | ❌ Se preserva | El historial de versiones es inmutable |
| Validación de stock | ❌ No se valida | No hay inventario en esta fase |

---

## 8. Integración con ActivityLog

### 8.1 Mapeo de Eventos

| Evento | entityType | action | metadata |
|---|---|---|---|
| Quote creada | `"quote"` | `"created"` | `{ number, version: 1 }` |
| Quote actualizada (sin nueva versión) | `"quote"` | `"updated"` | `{ changes: ["locationId"] }` |
| Nueva versión creada | `"quote"` | `"version_created"` | `{ version: 2, changes: ["items", "discountAmount"] }` |
| Status change (draft → sent) | `"quote"` | `"status_changed"` | `{ from: "draft", to: "sent" }` |
| Status change (sent → approved) | `"quote"` | `"status_changed"` | `{ from: "sent", to: "approved" }` |
| Status change (sent → rejected) | `"quote"` | `"status_changed"` | `{ from: "sent", to: "rejected", reason: "..." }` |
| Status change (draft/sent → cancelled) | `"quote"` | `"status_changed"` | `{ from: "draft", to: "cancelled" }` |
| Expiración batch | `"quote"` | `"expired"` | `{ validUntil, expiredAt }` |
| Conversión a WorkOrder | `"quote"` | `"converted"` | `{ workOrderId, workOrderNumber }` |
| Soft delete | `"quote"` | `"deleted"` | `{ deletedBy }` |

### 8.2 Auditoría de ActivityLog

Todas las actividades registradas con `entityType: "quote"` son consultables mediante:

```typescript
import { getEntityHistory, logActivity } from '../../audit/activity-logger';

// Registrar actividad
await logActivity({
  tenantId: quote.tenantId,
  entityType: 'quote',
  entityId: quote._id,
  action: 'status_changed',
  actorId: authenticatedUserId,
  metadata: { from: 'draft', to: 'sent' },
});

// Consultar timeline
const history = await getEntityHistory(tenantId, 'quote', quoteId);
```

---

## 9. Estructura de Archivos

```
src/quotes/
├── types/
│   ├── index.ts                    # Barrel export
│   ├── quote.ts                    # IQuote, CreateQuoteInput, UpdateQuoteInput, QuoteStatus
│   └── quote-version.ts            # IQuoteVersion, IQuoteItem, QuoteItemType, CreateQuoteVersionInput
├── schemas/
│   ├── index.ts                    # Barrel export
│   ├── quote.ts                    # quoteSchema + indexes
│   └── quote-version.ts            # quoteVersionSchema + indexes
├── models/
│   ├── index.ts                    # Barrel export
│   ├── quote.ts                    # QuoteModel
│   └── quote-version.ts            # QuoteVersionModel
├── helpers/
│   ├── state-machine.ts            # VALID_TRANSITIONS, validateTransition(), guards
│   ├── counter.ts                  # QuoteCounter: generación atómica de números
│   └── calculator.ts               # calculateSubtotal(), calculateTotal()
├── services/
│   ├── quote.service.ts            # CRUD, status transitions, versioning logic
│   └── conversion.service.ts       # Quote → WorkOrder conversion
└── index.ts                        # Barrel público del módulo
```

### 9.1 Scope Boundaries

**Incluido en esta fase:**
- Types, schemas, models para Quote y QuoteVersion
- State machine con validación de transiciones
- Contador secuencial atómico
- Servicio de Quote (CRUD + versioning)
- Servicio de conversión a WorkOrder
- ActivityLog integration
- Endpoints API

**NO incluido en esta fase:**
- Frontend/UI (componentes React, páginas)
- Envío real de emails al enviar cotización
- PDF generation
- Firma digital
- Plantillas de cotización
- Histórico de cambios de precio por item
- Notificaciones en tiempo real

---

## 10. Estados de Error

### 10.1 Errores por Operación

#### POST /api/crm/quotes — Crear Quote

| HTTP | Código interno | Condición | Mensaje |
|---|---|---|---|
| 400 | VALIDATION_ERROR | clientId faltante | "clientId es requerido" |
| 400 | VALIDATION_ERROR | items vacío | "Se requiere al menos un item" |
| 400 | VALIDATION_ERROR | item.type inválido | "Tipo de item inválido. Valores: product, service, labor, material, part" |
| 400 | VALIDATION_ERROR | quantity <= 0 | "quantity debe ser mayor a 0" |
| 400 | VALIDATION_ERROR | unitPrice negativo | "unitPrice no puede ser negativo" |
| 400 | VALIDATION_ERROR | discountAmount negativo | "discountAmount no puede ser negativo" |
| 400 | VALIDATION_ERROR | taxAmount negativo | "taxAmount no puede ser negativo" |
| 400 | VALIDATION_ERROR | validUntil en pasado | "validUntil debe ser una fecha futura" |
| 403 | FORBIDDEN | Sin permiso QUOTES_CREATE | "No tienes permiso para crear cotizaciones" |

#### PATCH /api/crm/quotes/:id — Actualizar Quote

| HTTP | Código interno | Condición | Mensaje |
|---|---|---|---|
| 400 | VALIDATION_ERROR | Datos inválidos | (según campo) |
| 404 | NOT_FOUND | Quote no encontrada | "Cotización no encontrada" |
| 422 | IMMUTABLE_FIELD | Intento de modificar tenantId/number | "El campo 'number' no puede modificarse" |
| 422 | TERMINAL_STATE | Quote en estado terminal | "No se puede modificar una cotización en estado 'approved'" |
| 422 | STATUS_VIA_PATCH | Intento de modificar status | "Use el endpoint específico de estado para cambiar el status" |
| 403 | FORBIDDEN | Sin permiso QUOTES_EDIT | "No tienes permiso para editar cotizaciones" |

#### POST /api/crm/quotes/:id/send — Enviar Quote

| HTTP | Código interno | Condición | Mensaje |
|---|---|---|---|
| 404 | NOT_FOUND | Quote no encontrada | "Cotización no encontrada" |
| 422 | INVALID_TRANSITION | Status actual no es draft | "La cotización debe estar en estado 'draft' para enviarse" |
| 422 | GUARD_FAILED | Sin items | "Se requiere al menos un item para enviar la cotización" |
| 422 | GUARD_FAILED | Sin clientId | "La cotización debe tener un cliente asignado" |
| 422 | GUARD_FAILED | validUntil vencido | "La cotización tiene una fecha de validez vencida" |
| 403 | FORBIDDEN | Sin permiso QUOTES_STATUS_CHANGE | "No tienes permiso para cambiar el estado de cotizaciones" |

#### POST /api/crm/quotes/:id/approve — Aprobar Quote

| HTTP | Código interno | Condición | Mensaje |
|---|---|---|---|
| 404 | NOT_FOUND | Quote no encontrada | "Cotización no encontrada" |
| 422 | INVALID_TRANSITION | Status actual no es sent | "Solo cotizaciones en estado 'sent' pueden aprobarse" |
| 422 | GUARD_FAILED | Quote expirada | "No se puede aprobar una cotización vencida. Cree una nueva cotización" |
| 403 | FORBIDDEN | Sin permiso QUOTES_APPROVE | "No tienes permiso para aprobar cotizaciones" |

#### PATCH /api/crm/quotes/:id/status — Cambiar Estado (reject/cancel)

| HTTP | Código interno | Condición | Mensaje |
|---|---|---|---|
| 400 | VALIDATION_ERROR | status faltante | "status es requerido" |
| 400 | VALIDATION_ERROR | status inválido | "Status inválido. Valores: rejected, cancelled" |
| 404 | NOT_FOUND | Quote no encontrada | "Cotización no encontrada" |
| 422 | INVALID_TRANSITION | Transición no permitida | "Transición de 'approved' a 'cancelled' no está permitida" |
| 422 | TERMINAL_STATE | Estado terminal | "La cotización ya está en estado terminal 'approved'" |
| 403 | FORBIDDEN | Sin permiso QUOTES_STATUS_CHANGE | "No tienes permiso para cambiar el estado de cotizaciones" |

#### POST /api/crm/quotes/:id/convert — Convertir a WorkOrder

| HTTP | Código interno | Condición | Mensaje |
|---|---|---|---|
| 404 | NOT_FOUND | Quote no encontrada | "Cotización no encontrada" |
| 409 | ALREADY_CONVERTED | Ya convertida | "La cotización ya fue convertida a una Orden de Trabajo" |
| 422 | INVALID_TRANSITION | Status no es approved | "Solo cotizaciones en estado 'approved' pueden convertirse" |
| 500 | TRANSACTION_ERROR | Error en transacción | "Error al convertir la cotización. La operación fue revertida" |
| 403 | FORBIDDEN | Sin permisos | "No tienes permisos suficientes para esta operación" |

#### DELETE /api/crm/quotes/:id — Soft Delete

| HTTP | Código interno | Condición | Mensaje |
|---|---|---|---|
| 404 | NOT_FOUND | Quote no encontrada | "Cotización no encontrada" |
| 422 | DELETE_RESTRICTED | Estado no permitido | "Solo se pueden eliminar cotizaciones en estado 'draft' o 'cancelled'" |
| 403 | FORBIDDEN | Sin permiso QUOTES_DELETE | "No tienes permiso para eliminar cotizaciones" |

#### GET /api/crm/quotes/:id/versions — Obtener Versiones

| HTTP | Código interno | Condición | Mensaje |
|---|---|---|---|
| 404 | NOT_FOUND | Quote no encontrada | "Cotización no encontrada" |
| 403 | FORBIDDEN | Sin permiso QUOTES_READ | "No tienes permiso para ver cotizaciones" |

### 10.2 Errores Genéricos del Sistema

| HTTP | Código interno | Condición | Mensaje |
|---|---|---|---|
| 500 | INTERNAL_ERROR | Error inesperado del servidor | "Error interno del servidor" |
| 500 | DB_ERROR | Error de base de datos | "Error de base de datos. Intente nuevamente" |
| 429 | RATE_LIMITED | Demasiadas solicitudes | "Demasiadas solicitudes. Intente nuevamente en 60 segundos" |

---

## 11. Riesgos y Mitigaciones

### 11.1 Riesgos de Escalabilidad

| Riesgo | Severidad | Detalle | Mitigación |
|---|---|---|---|
| **Volumen de QuoteVersion** | Medio | Cada modificación comercial crea una nueva versión. Una cotización muy revisada podría tener 20+ versiones. | QuoteVersion es colección separada, no embebida. El índice `{ tenantId, quoteId, version }` soporta consultas eficientes. Las versiones viejas se pueden archivar futuro. |
| **Expiración batch** | Bajo | El job de expiración debe recorrer quotes "sent" con validUntil vencido. | Índice `{ tenantId, validUntil, status }` cubre esta consulta sin collection scan. |
| **Contador atómico** | Bajo | Alta concurrencia en creación de quotes. | `findOneAndUpdate` con `$inc` es atómico en MongoDB. No hay riesgo de colisión incluso bajo alta concurrencia. |

### 11.2 Riesgos de Concurrencia

| Riesgo | Severidad | Detalle | Mitigación |
|---|---|---|---|
| **Race condition en status transitions** | Alto | Dos requests concurrentes podrían leer el mismo status y transicionar a estados diferentes. | Usar `findOneAndUpdate` con filtro de status actual: `Quote.findOneAndUpdate({ _id, status: 'draft' }, { status: 'sent', sentAt: now })`. Si `matchedCount === 0`, el status ya cambió. |
| **Doble creación de QuoteVersion** | Medio | Dos actualizaciones concurrentes podrían crear dos versiones con el mismo número. | Será raro porque las actualizaciones requieren leer la Quote primero. Usar `findOneAndUpdate` con `$inc: { currentVersion: 1 }` para asegurar exclusividad. Si `matchedCount === 0`, reintentar. |
| **Conversión duplicada** | Bajo | Dos requests de conversión simultáneos. | Validar `convertedToWorkOrder === null` dentro de la transacción. El índice único en WorkOrder.quoteId (si se implementa) previene duplicados. |

### 11.3 Riesgos de Consistencia

| Riesgo | Severidad | Detalle | Mitigación |
|---|---|---|---|
| **Quote.currentVersion vs QuoteVersion desync** | Medio | Si falla la creación de QuoteVersion, currentVersion podría quedar desactualizado. | Usar transacción MongoDB para crear QuoteVersion y actualizar Quote.currentVersion atómicamente. Si la transacción falla, todo se revierte. |
| **Campos financieros inconsistentes** | Medio | subtotal, discountAmount, taxAmount, total en Quote vs QuoteVersion. | Los cálculos se hacen en el service layer. quote.calculator.ts centraliza la lógica. QuoteVersion preserva el snapshot financiero de ese momento. Quote tiene los valores actuales. |
| **Soft-delete vs quotes activas** | Bajo | Filtrar deletedAt: null en todas las queries. | El helper de tenant scope debe incluir automáticamente `{ deletedAt: null }`. |

### 11.4 Matriz de Mitigación

| Riesgo | Estrategia de Mitigación | Efectividad |
|---|---|---|
| Race condition en status transitions | `findOneAndUpdate` con `{ _id, status: current }` | Alta |
| Desync de currentVersion | Transacción MongoDB | Alta |
| Volumen de QuoteVersion | Colección separada + índices | Alta |
| Expiración batch | Índice compuesto `{ tenantId, validUntil, status }` | Alta |
| Colisión de contador | `findOneAndUpdate` atómico + índice único | Alta |
| Soft-delete olvidado | Helper de tenant scope | Media |

---

## 12. Escenarios de Aceptación

### 12.1 Ciclo de Vida Completo

```
Escenario: Crear → Enviar → Aprobar → Convertir

Dado un usuario autenticado con permisos QUOTES_CREATE, QUOTES_STATUS_CHANGE, QUOTES_APPROVE, QUOTES_EDIT
  y un tenant con prefijo "COT"

1. Crear Quote en draft:
   POST /api/crm/quotes { clientId, items: [ { description: "Split 3000f", type: "product", quantity: 1, unitPrice: 45000 } ] }
   → 201 { number: "COT-0001", status: "draft", currentVersion: 1, subtotal: 45000, total: 45000 }

2. Actualizar items (agregar instalación):
   PATCH /api/crm/quotes/:id { items: [ { description: "Split 3000f", type: "product", quantity: 1, unitPrice: 45000 }, { description: "Instalación", type: "service", quantity: 1, unitPrice: 15000 } ] }
   → 200 { currentVersion: 2, subtotal: 60000, version: { version: 2, items: [...] } }

3. Enviar Quote:
   POST /api/crm/quotes/:id/send
   → 200 { status: "sent", sentAt: "2026-06-21T12:00:00Z" }

4. Aprobar Quote:
   POST /api/crm/quotes/:id/approve
   → 200 { status: "approved", approvedAt: "2026-06-21T12:30:00Z" }

5. Convertir a WorkOrder:
   POST /api/crm/quotes/:id/convert { priority: "normal", category: "installation" }
   → 201 { quote: { status: "approved", convertedToWorkOrder: "wo-id", convertedAt: "..." }, workOrder: { ... } }

6. Verificar versiones históricas:
   GET /api/crm/quotes/:id/versions
   → 200 { data: [ { version: 2, ... }, { version: 1, ... } ], currentVersion: 2 }
```

### 12.2 Transiciones Inválidas

```
Escenario: Transiciones que DEBEN fallar

1. Draft → Approve (salteando sent):
   POST /api/crm/quotes/:id/approve (quote en draft)
   → 422 { error: "INVALID_TRANSITION", message: "La cotización debe estar en estado 'sent' para aprobarse" }

2. Approved → cualquier estado:
   POST /api/crm/quotes/:id/send (quote en approved)
   → 422 { error: "TERMINAL_STATE", message: "No se puede modificar una cotización en estado 'approved'" }

3. Sent → Sent (auto-transición):
   PATCH /api/crm/quotes/:id/status { status: "sent" } (quote ya en sent)
   → 422 { error: "INVALID_TRANSITION", message: "Transición de 'sent' a 'sent' no está permitida" }

4. Draft → Expired (solo batch):
   PATCH /api/crm/quotes/:id/status { status: "expired" } (quote en draft)
   → 422 { error: "INVALID_TRANSITION", message: "Transición de 'draft' a 'expired' no está permitida" }

5. Draft → Convert (sin aprobar):
   POST /api/crm/quotes/:id/convert (quote en draft)
   → 422 { error: "INVALID_TRANSITION", message: "Solo cotizaciones en estado 'approved' pueden convertirse" }
```

### 12.3 Versioning

```
Escenario: Comportamiento de versiones

1. Creación inicial:
   POST /api/crm/quotes { title: "Cotización A", items: [ item1 ] }
   → QuoteVersion 1 creada con item1

2. Modificar items:
   PATCH /api/crm/quotes/:id { items: [ item1, item2 ] }
   → QuoteVersion 2 creada con item1 + item2, Quote.currentVersion = 2
   → QuoteVersion 1 permanece con solo item1

3. Modificar solo locationId (campo no comercial):
   PATCH /api/crm/quotes/:id { locationId: "new-location" }
   → Quote actualizada, NO se crea QuoteVersion
   → Quote.currentVersion sigue siendo 2

4. Modificar discountAmount:
   PATCH /api/crm/quotes/:id { discountAmount: 5000 }
   → QuoteVersion 3 creada con discountAmount = 5000
   → Quote.currentVersion = 3

5. Consultar versión 1 (histórica):
   GET /api/crm/quotes/:id/versions
   → version 1: { items: [ item1 ], discountAmount: 0, subtotal: 45000 }
   → version 2: { items: [ item1, item2 ], discountAmount: 0, subtotal: 60000 }
   → version 3: { items: [ item1, item2 ], discountAmount: 5000, subtotal: 60000, total: 64000 }
```

### 12.4 Conversión

```
Escenario: Conversión exitosa y restricciones

1. Intentar convertir quote no aprobada:
   POST /api/crm/quotes/:id/convert (quote en sent)
   → 422 { error: "INVALID_TRANSITION" }

2. Convertir quote aprobada:
   POST /api/crm/quotes/:id/convert (quote en approved)
   → 201 {
       quote: { status: "approved", convertedToWorkOrder: "wo-123", convertedAt: "..." },
       workOrder: { title: "COT-0001 v2: Cotización Split", status: "draft", quoteId: "..." }
     }

3. Intentar convertir la misma quote otra vez:
   POST /api/crm/quotes/:id/convert
   → 409 { error: "ALREADY_CONVERTED", message: "La cotización ya fue convertida" }
```

### 12.5 Multi-tenant Isolation

```
Escenario: Aislamiento entre inquilinos

Dado Tenant A con prefijo "COT-A" y Tenant B con prefijo "COT-B"

1. Tenant A crea Quote:
   POST /api/crm/quotes { items: [...] }
   → number: "COT-A-0001"

2. Tenant B crea Quote:
   POST /api/crm/quotes { items: [...] }
   → number: "COT-B-0001" (independiente de Tenant A)

3. Tenant A consulta sus quotes:
   GET /api/crm/quotes
   → Solo quotes de Tenant A

4. Tenant B intenta acceder quote de Tenant A:
   GET /api/crm/quotes/quote-de-tenant-a
   → 404 (no existe para Tenant B, aunque exista en la base de datos)
```

### 12.6 Expiración Batch

```
Escenario: Job de expiración automática

Dado 3 quotes en estado "sent":
  - Quote A: validUntil = "2026-05-01" (vencida)
  - Quote B: validUntil = "2026-07-01" (vigente)
  - Quote C: validUntil = null (sin fecha de vencimiento)

Cuando el job de expiración se ejecuta el 2026-06-21
Entonces:
  - Quote A cambia a "expired"
  - Quote B permanece en "sent"
  - Quote C permanece en "sent"
  - Se registran ActivityLog para Quote A con action "expired"
  - Quote B y C no se modifican
```

---

> **Fin de SDD Spec: Fase 5 — Cotizaciones Comerciales (Quotes)**
>
> Próximo paso: SDD Design con decisiones de implementación detalladas (tipos, esquemas, modelos, servicios, controladores).
