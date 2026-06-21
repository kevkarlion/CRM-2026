# SDD Spec: Fase 4 — Leads y Pipeline Comercial

> **Change name**: `fase-4-leads-pipeline`
> **Estado**: Spec (synced v0.4.0)
> **Stack**: Next.js, TypeScript, MongoDB Atlas, Mongoose
> **Basado en**: Fase 1 (Platform Foundation) + Fase 2 (CRM) + Fase 3 (Operations)
> **Archivo fuente**: `documentacion/sdd/sdd-fase4-leads-pipeline-spec.md`
> **Topic key**: `sdd/fase-4-leads-pipeline/spec`

---

## Tabla de Contenidos

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Capacidades](#2-capacidades)
   - [C1: Lead CRUD con tenant isolation y soft delete](#c1-lead-crud-con-tenant-isolation-y-soft-delete)
   - [C2: Status transitions con state machine](#c2-status-transitions-con-state-machine)
   - [C3: Lead assignment/reassignment con historial](#c3-lead-assignmentreassignment-con-historial)
   - [C4: Duplicate detection (warning no blocking)](#c4-duplicate-detection-warning-no-blocking)
   - [C5: Lead → Client conversion](#c5-lead--client-conversion)
   - [C6: Pipeline management (CRUD + default seeding)](#c6-pipeline-management-crud--default-seeding)
   - [C7: Activity logging via Activity entity](#c7-activity-logging-via-activity-entity)
3. [Especificación Detallada de Entidades](#3-especificación-detallada-de-entidades)
4. [Tabla de Transiciones de Estado](#4-tabla-de-transiciones-de-estado)
5. [API Endpoints Detallados](#5-api-endpoints-detallados)
6. [Índices](#6-índices)
7. [Reglas de Conversión Lead → Client](#7-reglas-de-conversión-lead--client)
8. [Integración con Activity](#8-integración-con-activity)
9. [Permisos RBAC](#9-permisos-rbac)
10. [Estructura de Archivos](#10-estructura-de-archivos)
11. [Riesgos y Mitigaciones](#11-riesgos-y-mitigaciones)

---

## 1. Resumen Ejecutivo

La Fase 4 implementa el módulo comercial del CRM: Leads (prospectos) y Pipeline Comercial. Cubre el ciclo completo desde que una consulta inicial entra al sistema hasta que se convierte en un Cliente formal.

El módulo `src/leads/` es un nuevo módulo top-level dentro del dominio CRM, siguiendo la misma separación de concerns que `src/operations/`. Incluye:

- **Lead**: Entidad principal con state machine de 5 estados (new → contacted → qualified → won/lost), soft delete, y denormalización selectiva.
- **LeadAssignment**: Entidad separada como fuente de verdad histórica de asignaciones. `Lead.assignedTo` es un campo denormalizado para consultas rápidas.
- **Pipeline**: Configuración de etapas comerciales. Cada tenant recibe un pipeline default de 5 etapas al crearse. Configurable post-creación.
- **Duplicate Detection**: Sistema híbrido — detección por email/teléfono/companyName, muestra warning, permite continuar.
- **Lead → Client Conversion**: Proceso transaccional que crea Client + Contact + Activity a partir de un Lead en estado `won`.

**Principios de diseño:**

- State machine explícita con validación centralizada (mismo patrón que WorkOrder en Fase 3).
- LeadAssignment como entidad separada (histórica), Lead.assignedTo como denormalizado para queries rápidas.
- Los leads `lost` que reingresan son NUEVOS leads, con `previousLeadId` opcional apuntando al anterior — no se reabre el lead perdido.
- Conversión transaccional: o se crea todo (Client + Contact + Activity) o no se crea nada.
- Pipeline preconfigurado al crear Tenant (5 etapas: Nueva Consulta → Contactado → Calificado → Cotización → Cerrado). Configurable por tenant.
- Las actividades (Activity CRM) se registran con `entityType: "lead"` para mantener el timeline unificado.

---

## 2. Capacidades

### C1: Lead CRUD con tenant isolation y soft delete

**Descripción**: Operaciones CRUD completas sobre Leads con aislamiento multitenant, soft delete, y auditoría. Todos los filtros de listado incluyen automáticamente `tenantId` y excluyen soft-deleted.

**Entidades involucradas**: Lead

**Reglas de negocio detalladas:**

- **Creación**: `name` es obligatorio. `status` se inicializa como `new`. `source` es obligatorio con valores fijos del enum. Si se provee `assignedTo`, se debe crear automáticamente un registro en LeadAssignment. `createdBy` y `updatedBy` se setean al usuario autenticado.
- **Lectura**: Filtros soportados: `status`, `assignedTo`, `source`, rango de fechas (`createdAtGte`, `createdAtLte`). Siempre scoped a `tenantId` + `deletedAt: null`.
- **Actualización**: `updatedBy` se actualiza siempre. `tenantId` es inmutable. `status` NO se actualiza por este endpoint — usa el endpoint específico de status. Si se actualiza `assignedTo`, se debe crear/cerrar registros en LeadAssignment según corresponda (ver C3).
- **Soft delete**: Setea `deletedAt` y `deletedBy`. No se permite hard-delete. Los soft-deleted no se devuelven en queries normales. Se puede incluir con flag explícito `includeDeleted=true`.
- **Campos inmutables post-creación**: `tenantId`, `convertedToClient`, `convertedAt`, `previousLeadId`. Estos solo se setean durante la conversión.

**Escenarios:**

```
Escenario 1: Creación exitosa de Lead
  Dado un usuario autenticado con permiso LEADS_CREATE
    y datos válidos: { name: "Juan Pérez", email: "juan@example.com", phone: "+5491112345678", source: "whatsapp" }
  Cuando envía POST /api/crm/leads
  Entonces el sistema crea un Lead con status "new"
    y createdBy = ID del usuario
    y updatedBy = ID del usuario
    y deletedAt = null
    y se registra una actividad con entityType "lead" y action "created"

Escenario 2: Listado con filtros
  Dado un tenant con 5 leads en estado "new" y 3 en estado "contacted"
  Cuando envía GET /api/crm/leads?status=new
  Entonces devuelve solo los 5 leads en estado "new"
    y todos pertenecen al tenantId del usuario autenticado
    y ninguno tiene deletedAt populado

Escenario 3: Soft delete con restricción
  Dado un Lead en estado "won" (convertido a cliente)
  Cuando envía DELETE /api/crm/leads/:id
  Entonces el sistema rechaza con error 422
    y explica que no se puede eliminar un lead convertido

Escenario 4: Soft delete exitoso
  Dado un Lead en estado "lost"
  Cuando envía DELETE /api/crm/leads/:id
  Entonces el sistema setea deletedAt con la fecha actual
    y setea deletedBy con el ID del usuario
    y devuelve 200 OK
```

**Criterios de aceptación:**

- [ ] CRUD completo funciona con tenant isolation
- [ ] Soft delete no elimina físicamente el documento
- [ ] Listado excluye soft-deleted por defecto
- [ ] No se puede eliminar un lead en estado `won`
- [ ] No se puede hard-destroy un lead (solo soft-delete)
- [ ] Los filtros de listado funcionan correctamente
- [ ] Se valida que `name` y `source` son obligatorios al crear

---

### C2: Status transitions con state machine

**Descripción**: Los cambios de estado de Lead siguen una state machine explícita con validación de guard conditions. No se permite actualizar `status` vía PATCH general — solo mediante el endpoint específico.

**Entidades involucradas**: Lead

**Reglas de negocio detalladas:**

- La state machine se define en un helper centralizado (`src/leads/helpers/state-machine.ts`) con el mismo patrón que `src/operations/helpers/state-machine.ts`.
- Transiciones válidas:

```
new → contacted      (requiere: haber registrado un primer contacto como Activity)
new → lost           (terminal, sin requisitos adicionales)
contacted → qualified (requiere: name, email/phone, companyName completos)
contacted → lost     (terminal)
qualified → won      (terminal, requiere: ejecutar conversión a Client)
qualified → lost     (terminal)
won                  (terminal — no se puede mover a ningún otro estado)
lost                 (terminal — no se puede mover a ningún otro estado)
```

- Si un lead `lost` debe reingresar, se crea un NUEVO lead con `previousLeadId` opcional. NO se reabre.
- `won`, `lost` y `disqualified` son estados terminales. No admiten transiciones salientes.
- `disqualified` es un estado adicional para leads que no califican (ej. fuera de zona de servicio, no cumple perfil). Misma semántica que `lost` pero con intención diferente.
- Cada transición registra un Activity en la entidad Activity existente.

**Escenarios:**

```
Escenario 1: Transición válida new → contacted
  Dado un Lead en estado "new"
    y existe al menos una Activity con entityType "lead" y entityId = lead._id
  Cuando envía PATCH /api/crm/leads/:id/status { status: "contacted" }
  Entonces el sistema cambia el estado a "contacted"
    y registra una Activity tipo "status_change"
    y devuelve el Lead actualizado

Escenario 2: Transición new → contacted sin actividad
  Dado un Lead en estado "new"
    y NO existe ninguna Activity para este Lead
  Cuando envía PATCH /api/crm/leads/:id/status { status: "contacted" }
  Entonces el sistema rechaza con error 422
    y el mensaje indica que se requiere al menos un registro de contacto

Escenario 3: Transición inválida contacted → won (salteando qualified)
  Dado un Lead en estado "contacted"
  Cuando envía PATCH /api/crm/leads/:id/status { status: "won" }
  Entonces el sistema rechaza con error 422
    y el mensaje indica que la transición contacted → won no está permitida

Escenario 4: Intento de transición desde estado terminal
  Dado un Lead en estado "won"
  Cuando envía PATCH /api/crm/leads/:id/status { status: "contacted" }
  Entonces el sistema rechaza con error 422
    y el mensaje indica que "won" es un estado terminal

Escenario 5: Transición contacted → qualified con datos incompletos
  Dado un Lead en estado "contacted"
    y el Lead tiene email pero no companyName
  Cuando envía PATCH /api/crm/leads/:id/status { status: "qualified" }
  Entonces el sistema rechaza con error 422
    y el mensaje indica que companyName es requerido para calificar
```

**Criterios de aceptación:**

- [ ] State machine implementada con `VALID_TRANSITIONS` y `validateTransition()`
- [ ] `new → contacted` requiere al menos una Activity de tipo call/email/whatsapp
- [ ] `contacted → qualified` requiere name + (email o phone) + companyName
- [ ] `qualified → won` requiere pasar por el proceso de conversión (endpoint POST /convert)
- [ ] Estados terminales (`won`, `lost`, `disqualified`) no admiten transiciones
- [ ] Transiciones inválidas devuelven error 422 con mensaje explicativo
- [ ] Cada transición registra Activity con activityType "status_change"
- [ ] No se puede cambiar status vía PATCH genérico de Lead

---

### C3: Lead assignment/reassignment con historial

**Descripción**: Cada asignación o reasignación de un Lead a un usuario queda registrada en LeadAssignment como fuente de verdad histórica. `Lead.assignedTo` es un campo denormalizado para consultas rápidas.

**Entidades involucradas**: Lead, LeadAssignment, User

**Reglas de negocio detalladas:**

- **Asignación inicial**: Al crear un Lead con `assignedTo` poblado, se crea un LeadAssignment con `unassignedAt: null`.
- **Reasignación**: Al cambiar `assignedTo` vía POST /assign:
  1. Se setea `unassignedAt` en el LeadAssignment activo actual (el que tiene `unassignedAt: null`).
  2. Se crea un nuevo LeadAssignment con `assignedAt = now`, `unassignedAt: null`.
  3. Se actualiza `Lead.assignedTo` al nuevo usuario.
- **Desasignación**: Al llamar POST /assign con `userId: null`:
  1. Se setea `unassignedAt` en el LeadAssignment activo actual.
  2. Se setea `Lead.assignedTo = null`.
- **Historial**: Se puede consultar el historial completo de asignaciones de un Lead vía LeadAssignment.
- `assignedBy` siempre es el usuario autenticado que ejecuta la acción.
- Cada asignación/reasignación registra un Activity.

**Escenarios:**

```
Escenario 1: Asignación inicial
  Dado un Lead recién creado sin assignedTo
  Cuando envía POST /api/crm/leads/:id/assign { userId: "user-123" }
  Entonces el sistema:
    - crea un LeadAssignment con leadId, userId, assignedBy, assignedAt
    - unassignedAt queda null
    - actualiza Lead.assignedTo = "user-123"
    - registra Activity tipo "assignment"

Escenario 2: Reasignación a otro usuario
  Dado un Lead asignado a "user-123" con LeadAssignment activo
  Cuando envía POST /api/crm/leads/:id/assign { userId: "user-456" }
  Entonces el sistema:
    - cierra el LeadAssignment activo seteando unassignedAt
    - crea un NUEVO LeadAssignment para "user-456"
    - actualiza Lead.assignedTo = "user-456"
    - registra Activity con detalle del cambio

Escenario 3: Desasignación
  Dado un Lead asignado a "user-123"
  Cuando envía POST /api/crm/leads/:id/assign { userId: null }
  Entonces el sistema:
    - cierra el LeadAssignment activo con unassignedAt
    - setea Lead.assignedTo = null
    - registra Activity indicando desasignación

Escenario 4: Consulta de historial
  Dado un Lead que fue asignado 3 veces a diferentes usuarios
  Cuando se consulta LeadAssignment.find({ leadId })
  Entonces devuelve 3 documentos, ordenados por assignedAt descendente
    y exactamente uno tiene unassignedAt = null (el activo)
```

**Criterios de aceptación:**

- [ ] Asignación crea LeadAssignment + actualiza Lead.assignedTo
- [ ] Reasignación cierra el activo, crea uno nuevo, actualiza denormalizado
- [ ] Desasignación (userId: null) cierra el activo, pone assignedTo = null
- [ ] Historial completo preservado en LeadAssignment
- [ ] assignedBy siempre es el usuario autenticado
- [ ] Cada operación de asignación registra Activity

---

### C4: Duplicate detection (warning no blocking)

**Descripción**: Al crear o actualizar un Lead, el sistema detecta potenciales duplicados basándose en coincidencias de `email`, `phone`, o `companyName`. Muestra un warning al usuario pero permite continuar.

**Entidades involucradas**: Lead

**Reglas de negocio detalladas:**

- **Detección**: Se buscan leads activos (no soft-deleted) del mismo tenant que tengan el mismo valor en al menos uno de estos campos: `email`, `phone`, `companyName`.
- **Coincidencia exacta**: La comparación es case-insensitive para email y companyName. El phone se normaliza eliminando espacios, guiones y signos `+` antes de comparar.
- **Múltiples coincidencias**: Se devuelven TODOS los leads coincidentes, no solo el primero.
- **No bloqueante**: El sistema NO impide la creación/actualización. Devuelve los duplicados en un array `duplicates` en la respuesta, junto con el resultado exitoso.
- **Auto-coincidencia**: Al actualizar, se excluye el propio `_id` de la búsqueda.
- **Campos evaluados**: `email`, `phone`, `companyName`. Se evalúan SOLO los campos que el request está enviando (al crear: todos los presentes; al actualizar: solo los que se están modificando).
- Si ningún campo de duplicado está presente en el request (ej. solo se envía `name` y `source`), no se ejecuta detección.

**Escenarios:**

```
Escenario 1: Creación con email duplicado
  Dado un lead existente con email "cliente@example.com"
  Cuando se crea un nuevo lead con email "cliente@example.com"
  Entonces el lead se crea exitosamente
    y la respuesta incluye "duplicates" con los datos del lead existente
    y el status code es 201 (no 409)

Escenario 2: Creación sin duplicados
  Dado que NO existen leads con email "nuevo@example.com"
  Cuando se crea un nuevo lead con email "nuevo@example.com"
  Entonces el lead se crea exitosamente
    y la respuesta incluye "duplicates: []"

Escenario 3: Actualización que introduce duplicado
  Dado Lead A con email "a@example.com"
    y Lead B con email "b@example.com"
  Cuando se actualiza Lead B cambiando email a "a@example.com"
  Entonces el lead B se actualiza exitosamente
    y la respuesta incluye "duplicates" con Lead A
    y Lead A NO aparece en duplicates (auto-coincidencia)

Escenario 4: Coincidencia por companyName
  Dado un lead existente con companyName "Climatización ABC"
  Cuando se crea un nuevo lead con companyName "climatización abc"
  Entonces el sistema detecta la coincidencia case-insensitive
    y devuelve "duplicates" con el lead existente
```

**Criterios de aceptación:**

- [ ] Detección por email, phone, companyName
- [ ] Comparación case-insensitive para email y companyName
- [ ] Normalización de phone (sin espacios, guiones, +)
- [ ] No bloqueante — el lead se crea/actualiza igual
- [ ] Respuesta incluye array `duplicates` con leads coincidentes
- [ ] Auto-exclusión en actualizaciones
- [ ] No ejecuta detección si ningún campo relevante está en el request
- [ ] Devuelve todas las coincidencias, no solo la primera

---

### C5: Lead → Client conversion

**Descripción**: Convierte un Lead en estado `qualified` a un Client completo con su Contact primario. Proceso transaccional: si falla algún paso, no queda estado inconsistente.

**Entidades involucradas**: Lead, Client, Contact, Activity

**Reglas de negocio detalladas:**

- Solo se pueden convertir Leads en estado `qualified`. Cualquier otro estado devuelve error 422.
- El proceso es transaccional (usa transacción de MongoDB):
  1. Crear `Client` con `customerType: "residential"` por defecto, `status: "active"`.
  2. Crear `Contact` primario asociado al Client.
  3. Copiar `notes` del Lead como Activity tipo `note` con `entityType: "client"`.
  4. Actualizar Lead: `status = "won"`, `convertedToClient = client._id`, `convertedAt = now`.
- Mapeo de campos (detallado en sección 7).
- Si cualquier paso falla, la transacción revierte todo.
- Después de la conversión, el Lead no puede modificarse ni eliminarse.
- registra Activity de conversión.

**Escenarios:**

```
Escenario 1: Conversión exitosa
  Dado un Lead en estado "qualified"
    con name: "Juan Pérez", email: "juan@example.com", phone: "+5491112345678", companyName: "Climax SA"
  Cuando envía POST /api/crm/leads/:id/convert
  Entonces el sistema:
    - crea un Client con companyName: "Climax SA"
    - crea un Contact con email: "juan@example.com", phone: "+5491112345678"
    - actualiza Lead.status = "won"
    - setea Lead.convertedToClient = client._id
    - setea Lead.convertedAt = fecha actual
    - devuelve el Lead actualizado con datos del Client creado

Escenario 2: Conversión de Lead en estado incorrecto
  Dado un Lead en estado "new"
  Cuando envía POST /api/crm/leads/:id/convert
  Entonces el sistema rechaza con error 422
    y el mensaje indica que solo leads "qualified" pueden convertirse

Escenario 3: Conversión con notas
  Dado un Lead en estado "qualified" con notes = "Cliente interesado en split de 3000 frigorías"
  Cuando envía POST /api/crm/leads/:id/convert
  Entonces el sistema:
    - copia las notas a una Activity tipo "note" con entityType "client"
    - el Client creado NO tiene notes (se mueven a Activity)
    - la Activity tiene description = notes del Lead
    - la Activity tiene metadata = { sourceLeadId: lead._id }
```

**Criterios de aceptación:**

- [ ] Solo se convierte un Lead en estado `qualified`
- [ ] Proceso transaccional (todo o nada)
- [ ] Client creado con `customerType: "residential"`, `status: "active"`
- [ ] Contact primario creado asociado al Client
- [ ] Notes del Lead → Activity de tipo note (no se copian a Client.notes)
- [ ] estimatedValue NO pasa a ningún lado (se pierde intencionalmente)
- [ ] Lead.convertedToClient y Lead.convertedAt seteados
- [ ] Lead.status = "won"
- [ ] Estado terminal: no se puede modificar ni eliminar el lead convertido
- [ ] Se registra Activity de conversión

---

### C6: Pipeline management (CRUD + default seeding)

**Descripción**: Los pipelines definen las etapas del proceso comercial. Cada tenant tiene al menos un pipeline. Al crear un tenant, se seedea un pipeline default con 5 etapas. Los pipelines son configurables por tenant.

**Entidades involucradas**: Pipeline, PipelineStage (subdocument)

**Reglas de negocio detalladas:**

- **Default seeding**: Al crear un Tenant, se ejecuta un hook que crea el pipeline default si no existe.
- **Pipeline default**: Un tenant puede tener múltiples pipelines, pero solo uno marcado como `isDefault: true`.
- **PipelineStage**: Subdocumento embebido en Pipeline. `position` determina el orden. `probability` es un entero 0-100 que representa la probabilidad de cierre en esa etapa.
- **Etapas del pipeline default**:

| position | name              | probability |
|----------|-------------------|-------------|
| 1        | Nueva Consulta    | 10          |
| 2        | Contactado        | 25          |
| 3        | Calificado        | 50          |
| 4        | Cotización        | 75          |
| 5        | Cerrado           | 100         |

- **CRUD**: Se pueden crear pipelines personalizados, actualizar, agregar/quitar etapas.
- **Desactivación de etapas**: No se eliminan físicamente. Se setea `isActive: false`. Esto preserva referencias históricas.
- **Protección del default**: No se puede eliminar el pipeline marcado como `isDefault`. Se puede cambiar el default a otro pipeline y luego eliminar el anterior.
- **Validación**: `position` debe ser único dentro del pipeline. `probability` debe ser 0-100. Debe haber al menos una etapa activa.

**Escenarios:**

```
Escenario 1: Seeding de pipeline default al crear Tenant
  Dado un nuevo Tenant creado
  Cuando el hook post-creación se ejecuta
  Entonces se crea un Pipeline con isDefault = true
    y name = "Pipeline Default"
    y contiene exactamente 5 PipelineStage con las etapas predefinidas

Escenario 2: Agregar etapa personalizada
  Dado un Pipeline default existente
  Cuando envía POST /api/crm/pipelines/:id/stages { name: "Demo Técnica", position: 3, probability: 60 }
  Entonces el sistema agrega la etapa en position 3
    y las etapas existentes con position >= 3 se incrementan en 1
    y el pipeline ahora tiene 6 etapas

Escenario 3: Desactivar etapa
  Dado un Pipeline con una etapa activa
  Cuando envía DELETE /api/crm/pipelines/:id/stages/:stageId
  Entonces la etapa se setea como isActive = false
    y no se elimina del documento
    y el pipeline aún tiene la etapa pero inactiva

Escenario 4: Eliminar pipeline default
  Dado un Pipeline marcado como isDefault = true
  Cuando envía DELETE /api/crm/pipelines/:id
  Entonces el sistema rechaza con error 422
    y el mensaje indica que no se puede eliminar el pipeline default
```

**Criterios de aceptación:**

- [ ] Pipeline default se seedea al crear Tenant
- [ ] CRUD completo de pipelines con tenant isolation
- [ ] Stages son subdocumentos embebidos
- [ ] Desactivación de stages (no eliminación física)
- [ ] Protección de pipeline default contra eliminación
- [ ] position único por pipeline
- [ ] probability validado 0-100
- [ ] Al menos una etapa activa por pipeline

---

### C7: Activity logging via Activity entity

**Descripción**: Todas las operaciones sobre Leads registran automáticamente actividades en la entidad Activity existente (CRM), usando `entityType: "lead"`. Esto permite tener un timeline unificado de actividades.

**Entidades involucradas**: Lead, Activity (CRM)

**Reglas de negocio detalladas:**

- La entidad Activity (`src/crm/models/activity.ts`) ya soporta `entityType` polimórfico. Se usa `entityType: "lead"` para actividades de Lead.
- Eventos que registran Activity:
  - Lead creado → `activityType: "note"`, `title: "Lead creado"`
  - Lead actualizado (campos editables) → `activityType: "note"`, `title: "Lead actualizado"`, `metadata: { changes: [...] }`
  - Status change → `activityType: "status_change"`, `title: "Estado cambiado: X → Y"`
  - Asignación → `activityType: "note"`, `title: "Asignado a [user.name]"`
  - Desasignación → `activityType: "note"`, `title: "Desasignado"`
  - Conversión → `activityType: "note"`, `title: "Convertido a Cliente: [client.name]"`
  - Contacto registrado (para transición new→contacted) → `activityType: "call" | "email"`, según corresponda
- `performedBy` se setea al usuario autenticado que ejecutó la acción.
- Las actividades son append-only — no se modifican ni eliminan.
- El timeline de un Lead se consulta vía `ActivityService.findByEntity("lead", leadId, tenantId)`.

**Escenarios:**

```
Escenario 1: Timeline de Lead
  Dado un Lead que fue creado, asignado, y cambiado a "contacted"
  Cuando se consulta ActivityService.findByEntity("lead", leadId, tenantId)
  Entonces devuelve 3 actividades ordenadas por createdAt descendente:
    - status_change: "Estado cambiado: new → contacted"
    - note: "Asignado a [user.name]"
    - note: "Lead creado"

Escenario 2: Activity sin extension de schema
  Dado que ActivitySchema ya soporta entityType string sin restricción de enum
  Cuando se crea una Activity con entityType "lead"
  Entonces el sistema la acepta sin errores
    y la activity se persiste correctamente

Escenario 3: Vinculación de change description
  Dado un Lead actualizado (cambio de email y phone)
  Cuando se registra la Activity
  Entonces metadata.changes contiene ["email", "phone"]
    y la descripción indica qué cambió
```

**Criterios de aceptación:**

- [ ] Todas las operaciones de Lead registran Activity
- [ ] entityType "lead" funciona con el schema existente
- [ ] Status changes usan activityType "status_change"
- [ ] Las actividades son consultables por leadId
- [ ] performedBy se mapea correctamente
- [ ] metadata preserva contexto de la operación

---

## 3. Especificación Detallada de Entidades

### 3.1 Lead

**Archivo**: `src/leads/types/lead.ts`

```typescript
import { Document, Types } from 'mongoose';
import { IAuditFields } from '../../crm/types/audit-fields';

export type LeadSource = 'whatsapp' | 'call' | 'form' | 'referral' | 'walk_in' | 'other';

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'won' | 'lost' | 'disqualified';

export interface ILead extends Document, IAuditFields {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  source: LeadSource;
  status: LeadStatus;
  assignedTo: Types.ObjectId | null;
  previousLeadId: Types.ObjectId | null;
  estimatedValue?: number;
  notes?: string;
  convertedToClient: Types.ObjectId | null;
  convertedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateLeadInput = Omit<
  ILead,
  keyof Document
  | '_id'
  | 'createdAt'
  | 'updatedAt'
  | 'createdBy'
  | 'updatedBy'
  | 'deletedBy'
  | 'deletedAt'
  | 'status'
  | 'assignedTo'
  | 'previousLeadId'
  | 'convertedToClient'
  | 'convertedAt'
>;

export type UpdateLeadInput = Partial<
  Omit<CreateLeadInput, 'tenantId'>
>;

// Input específico para cambio de estado
export interface ChangeLeadStatusInput {
  status: LeadStatus;
}

// Input específico para asignación
export interface AssignLeadInput {
  userId: string | null;
  reason?: string;
}
```

**Campos detallados:**

| Campo             | Tipo                        | Requerido | Default    | Validaciones                                      |
|-------------------|-----------------------------|-----------|------------|---------------------------------------------------|
| `_id`             | `Types.ObjectId`            | Auto      | Auto       | —                                                 |
| `tenantId`        | `Types.ObjectId` (ref Tenant) | Sí       | —          | —                                                 |
| `name`            | `string`                    | Sí        | —          | Max 200 chars                                     |
| `companyName`     | `string`                    | No        | —          | Max 200 chars                                     |
| `email`           | `string`                    | No        | —          | Formato email válido                              |
| `phone`           | `string`                    | No        | —          | Max 30 chars                                      |
| `source`          | `LeadSource` (enum)         | Sí        | —          | `whatsapp` \| `call` \| `form` \| `referral` \| `walk_in` \| `other` |
| `status`          | `LeadStatus` (enum)         | No        | `new`      | `new` \| `contacted` \| `qualified` \| `won` \| `lost` \| `disqualified` |
| `assignedTo`      | `Types.ObjectId` (ref User) | No        | `null`     | Denormalizado                                    |
| `previousLeadId`  | `Types.ObjectId` (ref Lead) | No        | `null`     | Solo setear al crear lead desde lost             |
| `estimatedValue`  | `number`                    | No        | —          | >= 0                                              |
| `notes`           | `string`                    | No        | —          | Max 2000 chars                                    |
| `convertedToClient` | `Types.ObjectId` (ref Client) | No     | `null`     | Solo setear en conversión                         |
| `convertedAt`     | `Date`                      | No        | `null`     | Solo setear en conversión                         |
| `createdBy`       | `Types.ObjectId` (ref User) | Sí        | —          | —                                                 |
| `updatedBy`       | `Types.ObjectId` (ref User) | Sí        | —          | —                                                 |
| `deletedBy`       | `Types.ObjectId` (ref User) | No        | —          | —                                                 |
| `deletedAt`       | `Date`                      | No        | `null`     | —                                                 |

### 3.2 LeadAssignment

**Archivo**: `src/leads/types/lead-assignment.ts`

```typescript
import { Document, Types } from 'mongoose';

export interface ILeadAssignment extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  leadId: Types.ObjectId;
  userId: Types.ObjectId;
  assignedBy: Types.ObjectId;
  assignedAt: Date;
  unassignedAt: Date | null;
  reason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateLeadAssignmentInput = Omit<
  ILeadAssignment,
  keyof Document | '_id' | 'createdAt' | 'updatedAt' | 'unassignedAt'
>;
```

**Campos detallados:**

| Campo          | Tipo                        | Requerido | Default    | Validaciones          |
|----------------|-----------------------------|-----------|------------|-----------------------|
| `_id`          | `Types.ObjectId`            | Auto      | Auto       | —                     |
| `tenantId`     | `Types.ObjectId` (ref Tenant) | Sí      | —          | —                     |
| `leadId`       | `Types.ObjectId` (ref Lead) | Sí        | —          | —                     |
| `userId`       | `Types.ObjectId` (ref User) | Sí        | —          | —                     |
| `assignedBy`   | `Types.ObjectId` (ref User) | Sí        | —          | —                     |
| `assignedAt`   | `Date`                      | Sí        | —          | —                     |
| `unassignedAt` | `Date`                      | No        | `null`     | —                     |
| `reason`       | `string`                    | No        | —          | Max 500 chars         |

### 3.3 Pipeline

**Archivo**: `src/leads/types/pipeline.ts`

```typescript
import { Document, Types } from 'mongoose';
import { IAuditFields } from '../../crm/types/audit-fields';

export interface IPipelineStage {
  name: string;
  position: number;
  probability: number; // 0-100
  isActive: boolean;
}

export interface IPipeline extends Document, IAuditFields {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  name: string;
  isDefault: boolean;
  stages: IPipelineStage[];
  createdAt: Date;
  updatedAt: Date;
}

export type CreatePipelineInput = Omit<
  IPipeline,
  keyof Document | '_id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedBy' | 'deletedAt' | 'isDefault'
>;

export type UpdatePipelineInput = Partial<
  Omit<CreatePipelineInput, 'tenantId'>
>;

export interface AddStageInput {
  name: string;
  position: number;
  probability: number;
}

export interface UpdateStageInput {
  name?: string;
  position?: number;
  probability?: number;
  isActive?: boolean;
}
```

**Campos detallados — Pipeline:**

| Campo       | Tipo                           | Requerido | Default    | Validaciones          |
|-------------|--------------------------------|-----------|------------|-----------------------|
| `_id`       | `Types.ObjectId`               | Auto      | Auto       | —                     |
| `tenantId`  | `Types.ObjectId` (ref Tenant)  | Sí        | —          | —                     |
| `name`      | `string`                       | Sí        | —          | Max 100 chars         |
| `isDefault` | `boolean`                      | No        | `false`    | Solo uno true por tenant |
| `stages`    | `IPipelineStage[]`             | Sí        | —          | Al menos 1 activo     |

**Campos detallados — PipelineStage (subdocumento):**

| Campo        | Tipo      | Requerido | Default    | Validaciones            |
|--------------|-----------|-----------|------------|-------------------------|
| `name`       | `string`  | Sí        | —          | Max 100 chars           |
| `position`   | `number`  | Sí        | —          | >= 1, único por pipeline |
| `probability`| `number`  | Sí        | —          | 0-100 (entero)          |
| `isActive`   | `boolean` | No        | `true`     | —                       |

---

## 4. Tabla de Transiciones de Estado

### 4.1 State Machine

```
new ──────► contacted ──────► qualified ──────► won (terminal)
  │              │                │
  │              │                ├──► lost (terminal)
  │              │                │
  │              │                └──► disqualified (terminal)
  │              │
  ├──► lost (terminal)        (terminal → nada)
  │
  └──► disqualified (terminal)
```

### 4.2 Tabla de Transiciones

| From          | To            | Guard / Precondición                                            |
|---------------|---------------|------------------------------------------------------------------|
| `new`         | `contacted`   | Requiere al menos una Activity (tipo call/email/whatsapp) para el lead |
| `new`         | `lost`        | Ninguna                                                          |
| `new`         | `disqualified`| Ninguna                                                          |
| `contacted`   | `qualified`   | `name` presente, (`email` o `phone`) presente, `companyName` presente |
| `contacted`   | `lost`        | Ninguna                                                          |
| `contacted`   | `disqualified`| Ninguna                                                          |
| `qualified`   | `won`         | Ejecutar POST /convert (no se puede llamar directo a /status con won) |
| `qualified`   | `lost`        | Ninguna                                                          |
| `qualified`   | `disqualified`| Ninguna                                                          |
| `won`         | —             | Terminal — sin transiciones salientes                            |
| `lost`        | —             | Terminal — sin transiciones salientes                            |
| `disqualified`| —             | Terminal — sin transiciones salientes                            |

### 4.3 Guard Conditions Detalladas

| Transición                  | Validación                                                                 |
|-----------------------------|---------------------------------------------------------------------------|
| `new → contacted`           | `Activity.exists({ entityType: "lead", entityId: leadId, activityType: { $in: ["call", "email"] } })` |
| `contacted → qualified`     | `lead.name` no vacío AND (`lead.email` no vacío OR `lead.phone` no vacío) AND `lead.companyName` no vacío |
| `qualified → won`           | Solo vía POST /convert — valida end-to-end, no es un simple status change |
| `cualquiera → terminal`     | `from !== to` (no auto-transición)                                       |

### 4.4 Código de State Machine

```typescript
// src/leads/helpers/state-machine.ts

import { LeadStatus } from '../types/lead';

export const VALID_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  new: ['contacted', 'lost', 'disqualified'],
  contacted: ['qualified', 'lost', 'disqualified'],
  qualified: ['won', 'lost', 'disqualified'],
  won: [],
  lost: [],
  disqualified: [],
};

export const TERMINAL_STATUSES: LeadStatus[] = ['won', 'lost', 'disqualified'];

export function canTransition(from: LeadStatus, to: LeadStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export class TransitionError extends Error {
  constructor(
    message: string,
    public readonly from: LeadStatus,
    public readonly to: LeadStatus,
    public readonly reason: string,
  ) {
    super(message);
    this.name = 'TransitionError';
  }
}

export function validateTransition(
  from: LeadStatus,
  to: LeadStatus,
): void {
  if (!canTransition(from, to)) {
    throw new TransitionError(
      `Transición inválida: ${from} → ${to}`,
      from, to,
      `La transición de '${from}' a '${to}' no está permitida por la máquina de estados.`,
    );
  }
}

// Guard: new → contacted
export function canMarkContacted(leadId: string, tenantId: string): Promise<boolean> {
  // Verifica que exista al menos una Activity tipo call/email para este lead
}

// Guard: contacted → qualified
export function validateQualifiedRequirements(lead: ILead): void {
  const missing: string[] = [];
  if (!lead.name?.trim()) missing.push('name');
  if (!lead.email?.trim() && !lead.phone?.trim()) missing.push('email/phone');
  if (!lead.companyName?.trim()) missing.push('companyName');
  if (missing.length > 0) {
    throw new TransitionError(
      `Campos requeridos faltantes: ${missing.join(', ')}`,
      'contacted', 'qualified',
      `Se requiere ${missing.join(', ')} para calificar el lead.`,
    );
  }
}
```

---

## 5. API Endpoints Detallados

### 5.1 POST /api/crm/leads — Crear Lead

```
Request Body:
{
  "name": "Juan Pérez",                    // required, string
  "companyName": "Climax SA",              // optional, string
  "email": "juan@example.com",             // optional, string
  "phone": "+5491112345678",               // optional, string
  "source": "whatsapp",                    // required, enum
  "assignedTo": "user-object-id",          // optional, ObjectId
  "estimatedValue": 15000,                 // optional, number >= 0
  "notes": "Cliente interesado en split"   // optional, string
}

Response 201:
{
  "data": {
    "_id": "lead-object-id",
    "tenantId": "tenant-object-id",
    "name": "Juan Pérez",
    "email": "juan@example.com",
    "phone": "+5491112345678",
    "source": "whatsapp",
    "status": "new",
    "assignedTo": "user-object-id",
    "previousLeadId": null,
    "estimatedValue": 15000,
    "notes": "Cliente interesado en split",
    "convertedToClient": null,
    "convertedAt": null,
    "createdBy": "user-object-id",
    "updatedBy": "user-object-id",
    "deletedAt": null,
    "createdAt": "2026-06-20T12:00:00.000Z",
    "updatedAt": "2026-06-20T12:00:00.000Z"
  },
  "duplicates": []  // o array con leads duplicados detectados
}

Errors:
- 400: validation error (name required, source inválido, email inválido)
- 403: insufficient permissions (LEADS_CREATE)
```

### 5.2 GET /api/crm/leads — Listar Leads

```
Query Params:
- status: LeadStatus (opcional, filtra por estado)
- assignedTo: ObjectId (opcional, filtra por responsable)
- source: LeadSource (opcional, filtra por origen)
- createdAtGte: ISO Date (opcional, rango inicio)
- createdAtLte: ISO Date (opcional, rango fin)
- includeDeleted: boolean (default false, solo admin)
- page: number (default 1)
- limit: number (default 20, max 100)
- sort: string (default "-createdAt", valores: "createdAt", "-createdAt", "name", "-name")

Response 200:
{
  "data": [ /* ILead[] */ ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 47,
    "totalPages": 3
  },
  "filters": { /* echo de filtros aplicados */ }
}

Errors:
- 403: insufficient permissions (LEADS_READ)
```

### 5.3 GET /api/crm/leads/:id — Obtener Lead

```
Response 200:
{
  "data": { /* ILead completo */ }
}

Errors:
- 404: lead not found (o soft-deleted)
- 403: insufficient permissions (LEADS_READ)
```

### 5.4 PATCH /api/crm/leads/:id — Actualizar Lead

```
Request Body (todos opcionales):
{
  "name": "Juan Pérez Actualizado",
  "companyName": "Nueva Razón Social",
  "email": "nuevo@example.com",
  "phone": "+5491112345678",
  "source": "call",
  "estimatedValue": 20000,
  "notes": "Notas actualizadas"
}

Response 200:
{
  "data": { /* ILead actualizado */ },
  "duplicates": []  // o array con duplicados detectados por los campos modificados
}

Notas:
- NO permite cambiar status, assignedTo, previousLeadId, convertedToClient, convertedAt
- Si se actualiza email/phone/companyName, ejecuta duplicate detection
- updatedBy se actualiza automáticamente
- Si se actualiza source, se registra Activity

Errors:
- 400: validation error
- 404: lead not found
- 409: conflict (optimistic locking via version si se implementa)
- 422: intento de modificar campos protegidos
- 403: insufficient permissions (LEADS_EDIT)
```

### 5.5 PATCH /api/crm/leads/:id/status — Cambiar Estado

```
Request Body:
{
  "status": "contacted"  // required, LeadStatus
}

Response 200:
{
  "data": { /* ILead con status actualizado */ }
}

Errors:
- 400: status requerido, status inválido
- 404: lead not found
- 422: transición no permitida por state machine, guard condition falla
- 403: insufficient permissions (LEADS_STATUS_CHANGE)

Nota: qualified → won NO se hace por este endpoint. Usar POST /convert.
```

### 5.6 POST /api/crm/leads/:id/assign — Asignar Responsable

```
Request Body:
{
  "userId": "user-object-id",  // required, string | null (null para desasignar)
  "reason": "Reasignación por carga de trabajo"  // optional, string
}

Response 200:
{
  "data": { /* ILead con assignedTo actualizado */ },
  "assignment": { /* LeadAssignment creado */ }
}

Errors:
- 400: userId inválido
- 404: lead not found
- 403: insufficient permissions (LEADS_ASSIGN)
```

### 5.7 POST /api/crm/leads/:id/convert — Convertir a Client

```
Request Body:
{
  // Opcional: permite override de campos del Client a crear
  "customerType": "residential",  // opcional, default "residential"
  "tags": ["converted-from-lead"]  // opcional, default []
}

Response 201:
{
  "data": {
    "lead": { /* ILead actualizado: status "won", convertedToClient seteado */ },
    "client": { /* IClient creado */ },
    "contact": { /* IContact creado */ }
  }
}

Errors:
- 400: datos inválidos
- 404: lead not found
- 409: lead ya convertido (convertedToClient ya seteado)
- 422: lead no está en estado "qualified"
- 500: error en transacción (rollback automático)
- 403: insufficient permissions (LEADS_EDIT, CLIENTS_CREATE)
```

### 5.8 DELETE /api/crm/leads/:id — Soft Delete

```
Response 200:
{
  "data": { /* ILead con deletedAt y deletedBy seteados */ }
}

Errors:
- 404: lead not found
- 422: lead en estado "won" (no se puede eliminar un lead convertido)
- 403: insufficient permissions (LEADS_DELETE)
```

### 5.9 GET /api/crm/pipelines — Listar Pipelines

```
Response 200:
{
  "data": [ /* IPipeline[] */ ]
}

Errors:
- 403: insufficient permissions (LEADS_READ)
```

### 5.10 POST /api/crm/pipelines — Crear Pipeline

```
Request Body:
{
  "name": "Pipeline Ventas Directas",     // required, string
  "stages": [
    { "name": "Contacto Inicial", "position": 1, "probability": 10 },
    { "name": "Cierre", "position": 2, "probability": 90 }
  ]
}

Response 201:
{
  "data": { /* IPipeline creado */ }
}

Errors:
- 400: validation error (name required, stages at least 1, probability 0-100)
- 403: insufficient permissions (SETTINGS_MANAGE)
```

### 5.11 PATCH /api/crm/pipelines/:id — Actualizar Pipeline

```
Request Body:
{
  "name": "Pipeline Renombrado"
}

Response 200:
{
  "data": { /* IPipeline actualizado */ }
}

Errors:
- 400: validation error
- 404: pipeline not found
- 403: insufficient permissions (SETTINGS_MANAGE)
```

### 5.12 DELETE /api/crm/pipelines/:id — Eliminar Pipeline

```
Response 200:
{ "success": true }

Errors:
- 404: pipeline not found
- 422: pipeline marcado como isDefault
- 403: insufficient permissions (SETTINGS_MANAGE)
```

### 5.13 POST /api/crm/pipelines/:id/stages — Agregar Stage

```
Request Body:
{
  "name": "Demo Técnica",   // required
  "position": 3,             // required, number >= 1
  "probability": 60          // required, number 0-100
}

Response 200:
{
  "data": { /* IPipeline con stages actualizado */ }
}

Nota: Si position ya está ocupado, los stages existentes se desplazan (position+1).
```

### 5.14 PATCH /api/crm/pipelines/:id/stages/:stageId — Actualizar Stage

```
Request Body:
{
  "name": "Demo Técnica Renombrada",
  "probability": 65,
  "position": 2,
  "isActive": true
}

Response 200:
{
  "data": { /* IPipeline con stage actualizado */ }
}
```

### 5.15 DELETE /api/crm/pipelines/:id/stages/:stageId — Desactivar Stage

```
Response 200:
{
  "data": { /* IPipeline con stage isActive = false */ }
}

Nota: No se elimina el subdocumento, se setea isActive = false.
Si es la única etapa activa, se rechaza la operación.
```

---

## 6. Índices

### 6.1 Lead Indexes

| # | Index                                      | Properties  | Purpose                                                                 |
|---|--------------------------------------------|-------------|-------------------------------------------------------------------------|
| 1 | `{ tenantId: 1, status: 1, createdAt: -1 }` | No unique   | Query principal: listar leads por tenant + estado, ordenado por fecha   |
| 2 | `{ tenantId: 1, assignedTo: 1, status: 1 }`  | No unique   | Filtro por responsable + estado (mi pipeline, leads del vendedor)       |
| 3 | `{ tenantId: 1, email: 1 }`                  | No unique   | Duplicate detection por email + búsqueda                                |
| 4 | `{ tenantId: 1, phone: 1 }`                  | No unique   | Duplicate detection por teléfono                                        |
| 5 | `{ tenantId: 1, source: 1, createdAt: -1 }`  | No unique   | Análisis por fuente de origen                                           |
| 6 | `{ tenantId: 1, deletedAt: 1 }`              | No unique   | Filtro global de soft-delete para consultas admin                       |
| 7 | `{ tenantId: 1, companyName: 1 }`            | No unique   | Duplicate detection por companyName + búsqueda textual                  |

**Justificación**:
- El índice #1 cubre el caso de uso más frecuente: el pipeline visual del vendedor (leads activos por estado).
- Los índices #3, #4, #7 son críticos para duplicate detection — sin ellos, cada creación/actualización requeriría un collection scan.
- El índice #5 soporta reportes de origen de leads.
- El índice #2 permite al vendedor ver "mis leads" agrupados por estado eficientemente.

### 6.2 LeadAssignment Indexes

| # | Index                                      | Properties | Purpose                                               |
|---|--------------------------------------------|------------|-------------------------------------------------------|
| 1 | `{ tenantId: 1, leadId: 1, assignedAt: -1 }` | No unique  | Historial de asignaciones de un lead, ordenado por fecha |
| 2 | `{ tenantId: 1, userId: 1, unassignedAt: 1 }`| No unique  | Asignaciones activas de un usuario (donde unassignedAt is null) |
| 3 | `{ tenantId: 1, leadId: 1, unassignedAt: 1 }`| No unique  | Encontrar la asignación activa actual de un lead      |

**Justificación**:
- El índice #1 soporta la consulta de timeline de asignaciones de un lead.
- El índice #2 permite responder "¿a qué usuarios está asignado este lead?" y "carga actual del usuario".
- El índice #3 permite encontrar rápidamente la asignación activa (la que tiene `unassignedAt: null`) para cerrarla en reasignaciones.

### 6.3 Pipeline Indexes

| # | Index                                | Properties | Purpose                                |
|---|--------------------------------------|------------|----------------------------------------|
| 1 | `{ tenantId: 1, isDefault: 1 }`      | No unique  | Buscar pipeline default del tenant     |
| 2 | `{ tenantId: 1 }`                    | No unique  | Listar pipelines del tenant            |

**Justificación**:
- Pipeline es una colección de baja cardinalidad (pocos documentos por tenant). Índices simples son suficientes.

---

## 7. Reglas de Conversión Lead → Client

### 7.1 Mapeo de Campos

| Origen (Lead)          | Destino               | Transformación                                       |
|------------------------|-----------------------|------------------------------------------------------|
| `name`                 | `Client.fullName`     | Directo                                              |
| `companyName`          | `Client.companyName`  | Directo                                              |
| `email`                | `Contact.email`       | Directo, Contact.isPrimary = true                    |
| `phone`                | `Contact.phone`       | Directo, Contact.isPrimary = true                    |
| `estimatedValue`       | —                     | **NO se transfiere** — valor solo contextual del lead |
| `notes`                | `Activity`            | Se crea Activity tipo `note` con `entityType: "client"` |
| `assignedTo`           | —                     | No se transfiere — el lead assignedTo no es el account manager |
| `source`               | —                     | No se transfiere — metadata del lead                  |
| `createdAt`            | —                     | Se preserva en lead, no se transfiere                 |

### 7.2 Valores Default del Client Creado

| Campo          | Valor           | Justificación                                               |
|----------------|-----------------|--------------------------------------------------------------|
| `customerType` | `"residential"` | Default seguro; el usuario puede cambiarlo post-conversión   |
| `status`       | `"active"`      | Cliente nuevo convertido desde lead = activo                 |
| `tags`         | `[]`            | Vacío por defecto; opcional pasar tags en el request         |

### 7.3 Proceso Paso a Paso

```
1. VALIDAR precondiciones:
   - Lead existe y no está soft-deleteado
   - Lead.status === "qualified"
   - Lead.convertedToClient === null (no convertido previamente)

2. INICIAR transacción MongoDB:

   2a. CREAR Client:
       Client.create({
         tenantId: lead.tenantId,
         customerType: request.customerType || "residential",
         status: "active",
         fullName: lead.name,
         companyName: lead.companyName,
         createdBy: authenticatedUserId,
         updatedBy: authenticatedUserId,
       })

   2b. CREAR Contact primario:
       Contact.create({
         tenantId: lead.tenantId,
         clientId: client._id,
         isPrimary: true,
         email: lead.email,
         phone: lead.phone,
         createdBy: authenticatedUserId,
         updatedBy: authenticatedUserId,
       })

   2c. CREAR Activity por notas (si lead.notes existe):
       Activity.create({
         tenantId: lead.tenantId,
         entityType: "client",
         entityId: client._id,
         activityType: "note",
         title: "Notas del Lead original",
         description: lead.notes,
         performedBy: authenticatedUserId,
         metadata: { sourceLeadId: lead._id },
       })

   2d. CREAR Activity de conversión:
       Activity.create({
         tenantId: lead.tenantId,
         entityType: "lead",
         entityId: lead._id,
         activityType: "note",
         title: "Convertido a Cliente",
         description: `Cliente creado: ${client.fullName || client.companyName}`,
         performedBy: authenticatedUserId,
         metadata: { clientId: client._id },
       })

   2e. ACTUALIZAR Lead:
       Lead.updateOne({
         _id: lead._id,
       }, {
         $set: {
           status: "won",
           convertedToClient: client._id,
           convertedAt: new Date(),
           updatedBy: authenticatedUserId,
         }
       })

   3. COMMIT transacción.
      3a. Si falla: ROLLBACK (ningún cambio persistido).
      3b. Si éxito: devolver lead actualizado + client + contact.
```

### 7.4 Restricciones Post-Conversión

- El Lead en estado `won` NO puede:
  - Cambiar de estado (terminal)
  - Ser actualizado en campos de negocio (protegido)
  - Ser eliminado (soft-delete rechazado)
- El Client creado es un Client normal — puede ser actualizado, tener más contacts, locations, etc.

---

## 8. Integración con Activity

### 8.1 Schema Existente

La entidad Activity (`src/crm/models/activity.ts`) usa `entityType` como string simple sin restricción de enum en el schema:

```typescript
entityType: { type: String, required: true },
```

Esto significa que `entityType: "lead"` funciona sin modificaciones al schema existente.

### 8.2 Tipos de Activity para Leads

| Operación              | entityType | activityType | title                                      | metadata                                     |
|------------------------|------------|--------------|--------------------------------------------|----------------------------------------------|
| Lead creado            | `"lead"`   | `"note"`     | "Lead creado"                              | `{ source: "whatsapp" }`                     |
| Lead actualizado       | `"lead"`   | `"note"`     | "Lead actualizado"                         | `{ changes: ["email", "phone"] }`            |
| Status change          | `"lead"`   | `"status_change"` | "Estado: new → contacted"               | `{ from: "new", to: "contacted" }`           |
| Asignación             | `"lead"`   | `"note"`     | "Asignado a: Nombre Usuario"              | `{ assignedTo: "user-id" }`                  |
| Desasignación          | `"lead"`   | `"note"`     | "Desasignado"                              | `{}`                                         |
| Contacto registrado    | `"lead"`   | `"call"`     | "Llamada realizada"                        | `{ callDuration: 180 }`                      |
| Email enviado          | `"lead"`   | `"email"`    | "Email: Propuesta comercial"              | `{ emailTemplate: "quote" }`                 |
| Nota agregada          | `"lead"`   | `"note"`     | Título libre                               | `{}`                                         |
| Lead convertido        | `"lead"`   | `"status_change"` | "Convertido a Cliente"                  | `{ clientId: "client-id" }`                  |

### 8.3 Consulta de Timeline

```typescript
// Obtener timeline completo de un Lead
const timeline = await ActivityService.findByEntity(
  "lead",
  leadId,
  tenantId,
  { limit: 50 }
);
```

### 8.4 Sin Cambios al Schema de Activity

No se requieren cambios al schema de Activity. La validación de `activityType` ya incluye todos los valores necesarios (`note`, `call`, `email`, `status_change`, `follow_up`). No se agregan valores nuevos.

### 8.5 Activity Logger (Audit)

Además de las Activities del módulo CRM, las operaciones de Lead también se registran en el ActivityLogger de auditoría (append-only):

| Operación          | entityType | action          | changes                                  |
|--------------------|------------|-----------------|------------------------------------------|
| Crear Lead         | `"lead"`   | `"created"`     | —                                        |
| Actualizar Lead    | `"lead"`   | `"updated"`     | `{ before: {...}, after: {...} }`         |
| Cambiar status     | `"lead"`   | `"status.change"`| `{ before: { status: "new" }, after: { status: "contacted" } }` |
| Asignar            | `"lead"`   | `"assigned"`    | `{ before: { assignedTo: null }, after: { assignedTo: "user-id" } }` |
| Convertir          | `"lead"`   | `"converted"`   | `{ clientId: "client-id" }`              |
| Soft delete        | `"lead"`   | `"deleted"`     | —                                        |

---

## 9. Permisos RBAC

### 9.1 Permisos Existentes (ya definidos en `src/rbac/permissions.ts`)

```typescript
LEADS_CREATE: 'leads.create',
LEADS_READ: 'leads.read',
LEADS_EDIT: 'leads.edit',
LEADS_DELETE: 'leads.delete',
LEADS_ASSIGN: 'leads.assign',
```

### 9.2 Nuevo Permiso Requerido

```typescript
LEADS_STATUS_CHANGE: 'leads.statusChange',
```

### 9.3 PermissionGroups Actualizado

```typescript
leads: [
  Permissions.LEADS_CREATE,
  Permissions.LEADS_READ,
  Permissions.LEADS_EDIT,
  Permissions.LEADS_DELETE,
  Permissions.LEADS_ASSIGN,
  Permissions.LEADS_STATUS_CHANGE,  // NUEVO
],
```

### 9.4 RoleDefaultPermissions Afectados

| Role            | LEADS_STATUS_CHANGE incluido? | Notas                                    |
|-----------------|-------------------------------|------------------------------------------|
| Owner           | Sí (tiene todos)              | —                                        |
| Administrator   | Sí (hereda PermissionGroups.leads) | —                                    |
| Supervisor      | Sí (hereda PermissionGroups.leads) | —                                    |
| Dispatcher      | Sí (hereda PermissionGroups.leads) | —                                    |
| Sales           | Sí (hereda PermissionGroups.leads) | —                                    |
| Technician      | No                            | No maneja leads                          |
| Accounting      | No                            | Solo lectura                             |

---

## 10. Estructura de Archivos

```
src/leads/
├── types/
│   ├── index.ts              # Barrel export
│   ├── lead.ts               # ILead, CreateLeadInput, UpdateLeadInput, ChangeLeadStatusInput, AssignLeadInput
│   ├── lead-assignment.ts    # ILeadAssignment, CreateLeadAssignmentInput
│   └── pipeline.ts           # IPipeline, IPipelineStage, CreatePipelineInput, etc.
├── schemas/
│   ├── index.ts              # Barrel export
│   ├── lead.ts               # leadSchema + indexes
│   ├── lead-assignment.ts    # leadAssignmentSchema + indexes
│   └── pipeline.ts           # pipelineSchema + indexes
├── models/
│   ├── index.ts              # Barrel export
│   ├── lead.ts               # LeadModel
│   ├── lead-assignment.ts    # LeadAssignmentModel
│   └── pipeline.ts           # PipelineModel
├── helpers/
│   ├── state-machine.ts      # VALID_TRANSITIONS, canTransition, validateTransition, TransitionError
│   └── duplicate-detection.ts # detectDuplicates(): busca coincidencias por email/phone/companyName
├── services/
│   ├── index.ts              # Barrel export
│   ├── lead.service.ts       # LeadService: CRUD, status transitions, soft delete
│   ├── lead-assignment.service.ts  # LeadAssignmentService: assign, reassign, unassign
│   ├── lead-conversion.service.ts  # LeadConversionService: convert qualified lead → client
│   ├── pipeline.service.ts   # PipelineService: CRUD, stage management, default seeding
│   └── duplicate.service.ts  # DuplicateService: detección con normalización
└── index.ts                  # Barrel público del módulo
```

**Scope boundaries — NO incluido en esta fase:**
- APIs, Controllers, Route Handlers (serán parte de las tasks de implementación)
- Frontend components, UI, vistas de pipeline
- Tests (serán parte de las tasks de implementación)
- Reportes/análisis de pipeline (futuro)

---

## 11. Riesgos y Mitigaciones

### 11.1 Riesgos de Escalabilidad

| Riesgo                                     | Severidad | Detalle                                                                  | Mitigación                                                               |
|---------------------------------------------|-----------|--------------------------------------------------------------------------|--------------------------------------------------------------------------|
| **Volumen de Leads**                        | Baja      | Un tenant HVAC genera ~100-500 leads/mes. Incluso a 10K leads, MongoDB maneja bien | Índices cubren todos los patrones de query. Sin problemas previsibles.   |
| **LeadAssignment histórico**                | Baja      | Cada lead puede tener múltiples asignaciones. A 50 asigs/lead × 10K leads = 500K docs | Índice `{ leadId, assignedAt }` soporta queries de historial eficientes. |
| **Pipeline es baja cardinalidad**           | Muy baja  | Pocos pipelines por tenant (1-5). Casi sin impacto en performance.       | Sin riesgo.                                                              |
| **Duplicate detection en creación masiva**   | Baja      | Escanea colección de leads por email/phone/companyName. Con índices, es O(log n). | Índices parciales cubren los campos de búsqueda.                         |

### 11.2 Riesgos de Concurrencia

| Riesgo                                     | Severidad | Detalle                                                                  | Mitigación                                                               |
|---------------------------------------------|-----------|--------------------------------------------------------------------------|--------------------------------------------------------------------------|
| **Doble conversión del mismo Lead**          | Alta      | Dos requests simultáneos de /convert sobre el mismo lead.               | Usar `findOneAndUpdate` con filtro `{ _id, status: "qualified", convertedToClient: null }`. Si matchedCount = 0, ya fue convertido. |
| **Race condition en status transition**      | Media     | Dos requests intentan cambiar el estado simultáneamente.                | `findOneAndUpdate` con `{ _id, status: currentStatus }` — mismo patrón que WorkOrder. |
| **Doble asignación simultánea**              | Media     | Dos dispatchers asignan el mismo lead a diferentes usuarios al mismo tiempo. | Primero en cerrar la asignación activa gana. El segundo encuentra unassignedAt !== null y debe refrescar. |

### 11.3 Riesgos de Consistencia

| Riesgo                                     | Severidad | Detalle                                                                  | Mitigación                                                               |
|---------------------------------------------|-----------|--------------------------------------------------------------------------|--------------------------------------------------------------------------|
| **Lead.assignedTo vs LeadAssignment desync**  | Media    | Si Lead.assignedTo se actualiza sin crear LeadAssignment, o viceversa.  | Toda mutación pasa por el servicio. El servicio SIEMPRE actualiza ambos atómicamente. |
| **Lead convertido pero Client falló**        | Alta     | Si la creación de Client falla después de actualizar el Lead.           | Transacción MongoDB — o se crea todo o no se crea nada.                  |
| **Pipeline default faltante**                | Baja     | Un tenant antiguo (creado antes de Fase 4) no tiene pipeline.           | Lazy seeding: verificar al primer acceso y crear si no existe.           |

### 11.4 Matriz de Mitigación

| Riesgo                                       | Estrategia                                                    | Efectividad |
|----------------------------------------------|---------------------------------------------------------------|-------------|
| Doble conversión                             | `findOneAndUpdate` con filtro de estado + flag                | Alta        |
| Race en status transition                    | `findOneAndUpdate` con status actual como filtro              | Alta        |
| Desync assignedTo vs LeadAssignment          | Servicio único que actualiza ambos                           | Alta        |
| Conversión parcial                           | Transacción MongoDB (session + abortTransaction)              | Alta        |
| Pipeline default faltante en tenants viejos  | Lazy seeding al primer GET /pipelines                         | Media       |

---

---

## 12. Implementation Status

### 12.1 Resumen General

| Ítem | Estado |
|---|---|
| Capacidades implementadas | ✅ C1 (CRUD), C2 (State Machine), C3 (Assignment), C4 (Duplicates), C5 (Conversion), C6 (Pipeline), C7 (Activity) |
| Archivos de código | 20 en `src/leads/`, 8 API routes en `src/app/api/crm/` |
| Tests | ✅ 93 tests, 6 files, 0 failures (via `vitest`) |
| Líneas de código fuente | ~1.745 |
| Líneas de tests | ~1.498 |

### 12.2 Desviaciones entre Spec y Código

| # | Aspecto | Spec | Implementación |
|---|---|---|---|
| 1 | **State Machine — disqualified** | Transiciones `new/contacted/qualified → disqualified` incluidas como válidas | `VALID_TRANSITIONS` no incluye `disqualified` como destino — solo está como estado terminal sin transiciones de entrada |
| 2 | **ILead interface** | Extiende `IAuditFields` | No extiende `IAuditFields`; los campos audit (`createdBy`, `updatedBy`, `deletedAt`, `deletedBy`) son `string` inline |
| 3 | **CreateLeadInput** | Tipo derivado vía `Omit<ILead, ...>` | `interface` plana sin `Omit` |
| 4 | **Índices Lead** | 7 índices especificados | 4 implementados: faltan `{tenantId, source, createdAt}`, `{tenantId, deletedAt}`, `{tenantId, companyName}` |
| 5 | **Índices LeadAssignment** | 3 índices especificados | 1 implementado: `{tenantId, leadId, assignedAt}`. Faltan `{tenantId, userId, unassignedAt}` y `{tenantId, leadId, unassignedAt}` |
| 6 | **Pipeline default stages** | `position` 1-based (1-5) | 0-based (0-4) en `default-pipeline.ts` |
| 7 | **Pipeline stages — nombres** | "Nueva Consulta", "Calificado", "Cotización", "Cerrado" | "Nuevo contacto", "Visita técnica", "Presupuesto", "Ganado" |
| 8 | **Pipeline schema validator** | Valida al menos 1 stage activa | No implementado |
| 9 | **Pipeline addStage** | Inserta en posición específica, reordena existentes | Agrega al final (`maxPosition + 1`) |
| 10 | **Paginación** | `page`/`limit`/`totalPages` | Cursor-based con `cursorPage()` helper |
| 11 | **Duplicate detection** | `detectDuplicates()` con `excludeId` | `findDuplicates()` sin `excludeId` |
| 12 | **Separación de servicios** | `DuplicateService`, `LeadConversionService` como clases separadas | Lógica in-line en `LeadService.createLead()` y `LeadService.convertToClient()` |
| 13 | **Nombres de métodos** | `findById()`, `findByTenant()`, `create()`, `update()`, `changeStatus()`, `softDelete()` | `getLead()`, `listLeads()`, `createLead()`, `updateLead()`, `changeStatus()`, `softDelete()` |
| 14 | **Formato de respuesta API** | Envuelto en `{ data, duplicates }`, `{ data, pagination }` | Plano (objeto directo) o `{ data }` según ruta |
| 15 | **Audit fields (createdBy/updatedBy)** | `Types.ObjectId` (ref User) | `string` — ID plano, sin populate |
| 16 | **Stage management API** | `stages/[stageId]/route.ts` con PATCH y DELETE por stageId | Usa `stageIndex` numérico en PipelineService, sin ruta específica por stageId |

### 12.3 Decisiones de Implementación No Documentadas

- **Conversión in-line**: `convertToClient()` vive en `LeadService` (no en servicio separado) para mantener coherencia transaccional.
- **Paginación cursor-based**: Se adoptó `cursorPage` del módulo CRM para consistencia con otras listas del sistema.
- **State machine con TransitionContext**: En lugar de guards separados (`canMarkContacted`, `validateQualifiedRequirements`), la implementación inyecta un `context` opcional con `hasActivity`, `hasRequiredFields`, `hasClient`.
- **Audit fields como string**: Se usan IDs planos en lugar de ObjectIds con ref para evitar population queries innecesarias en reads frecuentes.
- **Métodos con prefijo**: Se nombraron `createLead`, `updateLead`, `getLead`, `listLeads` para evitar conflictos de naming si se componen servicios.

### 12.4 Cobertura de Tests

| Archivo | Tests | Tipo |
|---|---|---|
| `tests/leads/lead-state-machine.test.ts` | 28 | Unit — transiciones, guards, terminales |
| `tests/leads/duplicate-detection.test.ts` | 9 | Unit — detección por email/phone/companyName |
| `tests/leads/lead.service.test.ts` | 21 | Integration mockeada — CRUD, status, soft delete |
| `tests/leads/lead-assignment.service.test.ts` | 8 | Integration mockeada — assign, unassign, history |
| `tests/leads/pipeline.service.test.ts` | 18 | Integration mockeada — CRUD, stages, default protection |
| `tests/leads/conversion.test.ts` | 9 | Integration mockeada — transaccional, errores, concurrencia |
| **Total** | **93** | **6 files, 0 failures** |

---

> **Fin de SDD Spec: Fase 4 — Leads y Pipeline Comercial (synced v0.4.0)**
