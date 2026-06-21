# SDD Design: Fase 4 — Leads y Pipeline Comercial

> **Change name**: `fase-4-leads-pipeline`
> **Estado**: Design (synced v0.4.0)
> **Stack**: Next.js, TypeScript, MongoDB Atlas, Mongoose
> **Basado en**: Fase 1 (Platform Foundation) + Fase 2 (CRM) + Fase 3 (Operations)
> **Archivo fuente**: `documentacion/sdd/sdd-fase4-leads-pipeline-design.md`
> **Topic key**: `sdd/fase-4-leads-pipeline/design`

---

## 1. Resumen Ejecutivo

La Fase 4 agrega el módulo `src/leads/` como nuevo módulo top-level del dominio CRM. Cubre el ciclo comercial completo: captura de prospectos (Lead), seguimiento por pipeline de etapas, asignación a vendedores, detección de duplicados (warning), y conversión transaccional a Client.

El diseño sigue exactamente los mismos patrones establecidos en `src/operations/`:

- **State machine explícita**: Mismo patrón que `WorkOrder` — `VALID_TRANSITIONS`, `validateTransition()`, `TransitionError`. Guard conditions para `new→contacted` (requiere Activity) y `contacted→qualified` (requiere datos completos).
- **LeadAssignment como entidad separada**: Fuente de verdad histórica. `Lead.assignedTo` es denormalizado para reads rápidos, mismo patrón que `assignedTechnicians` denormalizado en WorkOrder.
- **Servicios con clases**: Cada operación recibe `tenantId`, `userId` como parámetros. Auditoría via `logActivity` de `../../audit/activity-logger`.
- **Transacciones MongoDB**: La conversión Lead→Client usa `session` + `abortTransaction` para garantizar atomicidad (Client + Contact + Activity + Lead update).
- **Optimistic concurrency**: `findOneAndUpdate` con filtro de status actual para race conditions en status transitions y conversión.

**Novelty respecto a Fase 3**:
- Duplicate detection como servicio independiente (no existía en Operations).
- Pipeline como entidad configurable por tenant con seeding automático.
- Conversión cross-dominio: crea entidades CRM (Client, Contact) desde leads.
- `deletedAt` cascade planning para soft delete (igual que en ClientService, pero por ahora Lead no tiene entidades hijas que cacadear).

---

## 2. Estructura de Archivos

```
src/leads/
├── types/
│   ├── index.ts                    # Barrel
│   ├── lead.ts                     # ILead, LeadStatus, LeadSource, inputs (plain interfaces, no Omit)
│   ├── lead-assignment.ts          # ILeadAssignment, CreateLeadAssignmentInput
│   └── pipeline.ts                 # IPipeline, IPipelineStage, inputs
├── schemas/
│   ├── index.ts                    # Barrel
│   ├── lead.ts                     # leadSchema + 4 índices (source+createdAt, deletedAt, companyName NO implementados)
│   ├── lead-assignment.ts          # leadAssignmentSchema + 1 índice (userId+unassignedAt, leadId+unassignedAt NO implementados)
│   └── pipeline.ts                 # pipelineSchema + 2 índices (tenantId+name unique, tenantId+isDefault)
├── models/
│   ├── index.ts                    # Barrel
│   ├── lead.ts                     # LeadModel
│   ├── lead-assignment.ts          # LeadAssignmentModel
│   └── pipeline.ts                 # PipelineModel
├── helpers/
│   ├── lead-state-machine.ts       # VALID_TRANSITIONS, canTransition, validateTransition con TransitionContext, TransitionError
│   └── duplicate-detection.ts      # normalizePhone(), findDuplicates() — sin excludeId
├── services/
│   ├── index.ts                    # Barrel
│   ├── lead.service.ts             # LeadService: createLead, getLead, listLeads, updateLead, changeStatus, convertToClient, softDelete
│   ├── lead-assignment.service.ts  # LeadAssignmentService: assign/reassign/unassign/getHistory/getActiveAssignments
│   └── pipeline.service.ts         # PipelineService: CRUD + stage management + default seed + reorder
├── pipelines/
│   └── default-pipeline.ts         # DEFAULT_STAGES (5 stages, position 0-based)
├── index.ts                        # Barrel público del módulo

src/app/api/crm/leads/
├── route.ts                        # GET (list via cursorPage) + POST (create)
├── [id]/
│   ├── route.ts                    # GET (by id) + PATCH (update) + DELETE (soft delete)
│   ├── status/route.ts             # PATCH (change status)
│   ├── assign/route.ts             # POST (assign only — no unassign endpoint)
│   └── convert/route.ts            # POST (convert to client)

src/app/api/crm/pipelines/
├── route.ts                        # GET (list + lazy seed) + POST (create)
└── [id]/
    ├── route.ts                    # PATCH (update) + DELETE (soft delete)
    └── stages/
        └── route.ts                # POST (add stage at max+1)
                                    # NOTA: No hay [stageId]/route.ts — update y deactivate se usan por stageIndex en service
```

---

## 3. Tipos TypeScript

### 3.1 `src/leads/types/lead.ts`

```typescript
import { Document, Types } from 'mongoose';

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'won' | 'lost' | 'disqualified';
export type LeadSource = 'whatsapp' | 'call' | 'form' | 'referral' | 'walk_in' | 'other';

export interface ILead extends Document {
  tenantId: Types.ObjectId;
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  source: LeadSource;
  status: LeadStatus;
  assignedTo?: Types.ObjectId;
  previousLeadId?: Types.ObjectId;
  estimatedValue?: number;
  notes?: string;
  convertedToClient?: Types.ObjectId;
  convertedAt?: Date;
  createdBy: string;
  updatedBy: string;
  deletedAt: Date | null;
  deletedBy: string | null;
}

// NOTA: No extiende IAuditFields — los campos audit son string inline
//       assignedTo es Types.ObjectId opcional (no null por defecto)

export interface CreateLeadInput {
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  source: LeadSource;
  assignedTo?: string;      // string, se convierte a ObjectId en service
  previousLeadId?: string;
  estimatedValue?: number;
  notes?: string;
}

export interface UpdateLeadInput {
  name?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  source?: LeadSource;
  assignedTo?: string;
  estimatedValue?: number;
  notes?: string;
}
```

### 3.2 `src/leads/types/lead-assignment.ts`

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

### 3.3 `src/leads/types/pipeline.ts`

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
  keyof Document | '_id' | 'createdAt' | 'updatedAt'
  | 'createdBy' | 'updatedBy' | 'deletedBy' | 'deletedAt' | 'isDefault'
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

---

## 4. Schemas Mongoose

### 4.1 `src/leads/schemas/lead.ts`

```typescript
import { Schema } from 'mongoose';
import { ILead, LeadStatus, LeadSource } from '../types/lead';

const auditFields = {
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  deletedAt: { type: Date, default: null },
};

export const leadSchema = new Schema<ILead>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: {
      type: String,
      required: true,
      maxlength: 200,
      trim: true,
    },
    companyName: {
      type: String,
      maxlength: 200,
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      // Validación: match con regex de email, no required
    },
    phone: {
      type: String,
      maxlength: 30,
      trim: true,
    },
    source: {
      type: String,
      enum: ['whatsapp', 'call', 'form', 'referral', 'walk_in', 'other'] satisfies LeadSource[],
      required: true,
    },
    status: {
      type: String,
      enum: ['new', 'contacted', 'qualified', 'won', 'lost', 'disqualified'] satisfies LeadStatus[],
      required: true,
      default: 'new',
    },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    previousLeadId: { type: Schema.Types.ObjectId, ref: 'Lead', default: null },
    estimatedValue: { type: Number, min: 0 },
    notes: { type: String, maxlength: 2000 },
    convertedToClient: { type: Schema.Types.ObjectId, ref: 'Client', default: null },
    convertedAt: { type: Date, default: null },
    ...auditFields,
  },
  { timestamps: true }
);

// Índices (7 total)
leadSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
leadSchema.index({ tenantId: 1, assignedTo: 1, status: 1 });
leadSchema.index({ tenantId: 1, email: 1 });
leadSchema.index({ tenantId: 1, phone: 1 });
leadSchema.index({ tenantId: 1, source: 1, createdAt: -1 });
leadSchema.index({ tenantId: 1, deletedAt: 1 });
leadSchema.index({ tenantId: 1, companyName: 1 });
```

### 4.2 `src/leads/schemas/lead-assignment.ts`

```typescript
import { Schema } from 'mongoose';
import { ILeadAssignment } from '../types/lead-assignment';

export const leadAssignmentSchema = new Schema<ILeadAssignment>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assignedAt: { type: Date, required: true, default: Date.now },
    unassignedAt: { type: Date, default: null },
    reason: { type: String, maxlength: 500 },
  },
  { timestamps: true }
);

// Índices (3 total)
leadAssignmentSchema.index({ tenantId: 1, leadId: 1, assignedAt: -1 });
leadAssignmentSchema.index({ tenantId: 1, userId: 1, unassignedAt: 1 });
leadAssignmentSchema.index({ tenantId: 1, leadId: 1, unassignedAt: 1 });
```

### 4.3 `src/leads/schemas/pipeline.ts`

```typescript
import { Schema } from 'mongoose';
import { IPipeline } from '../types/pipeline';

const auditFields = {
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  deletedAt: { type: Date, default: null },
};

const pipelineStageSchema = new Schema(
  {
    name: { type: String, required: true, maxlength: 100 },
    position: { type: Number, required: true, min: 1 },
    probability: { type: Number, required: true, min: 0, max: 100 },
    isActive: { type: Boolean, default: true },
  },
  { _id: true } // Necesitamos _id para referenciar stages individualmente en PATCH/DELETE
);

export const pipelineSchema = new Schema<IPipeline>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, maxlength: 100 },
    isDefault: { type: Boolean, default: false },
    stages: {
      type: [pipelineStageSchema],
      validate: {
        validator: function (stages: { isActive: boolean }[]) {
          return stages.some(s => s.isActive);
        },
        message: 'Pipeline must have at least one active stage.',
      },
    },
    ...auditFields,
  },
  { timestamps: true }
);

// Índices (2 total)
pipelineSchema.index({ tenantId: 1, isDefault: 1 });
pipelineSchema.index({ tenantId: 1 });
```

---

## 5. Modelos

Siguen el patrón estándar de Fase 3:

```typescript
// src/leads/models/lead.ts
import mongoose, { Model } from 'mongoose';
import { ILead } from '../types/lead';
import { leadSchema } from '../schemas/lead';
const LeadModel: Model<ILead> = mongoose.model<ILead>('Lead', leadSchema);
export default LeadModel;

// src/leads/models/lead-assignment.ts
// LeadAssignmentModel: mongoose.model<ILeadAssignment>('LeadAssignment', leadAssignmentSchema)

// src/leads/models/pipeline.ts
// PipelineModel: mongoose.model<IPipeline>('Pipeline', pipelineSchema)
```

Barrel `src/leads/models/index.ts`:

```typescript
export { default as LeadModel } from './lead';
export { default as LeadAssignmentModel } from './lead-assignment';
export { default as PipelineModel } from './pipeline';
```

---

## 6. State Machine Helper

`src/leads/helpers/lead-state-machine.ts` — sigue el patrón de `src/operations/helpers/state-machine.ts` pero **usa TransitionContext en lugar de guards separados**.

**Desviación del diseño original**: En lugar de funciones guard separadas (`canMarkContacted`, `validateQualifiedRequirements`), la implementación inyecta un objeto `TransitionContext` opcional en `validateTransition()`. Esto centraliza toda la validación en un solo punto.

```typescript
import { LeadStatus } from '../types/lead';

export const VALID_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  new: ['contacted', 'lost'],
  contacted: ['qualified', 'lost'],
  qualified: ['won', 'lost'],
  won: [],
  lost: [],
  disqualified: [],
};

// NOTA: disqualified NO es alcanzable como destino (falta en VALID_TRANSITIONS)
// Solo figura como estado terminal sin transiciones de entrada

export const TERMINAL_STATUSES: LeadStatus[] = ['won', 'lost', 'disqualified'];

export class TransitionError extends Error {
  constructor(from: LeadStatus, to: LeadStatus, reason: string) {
    super(`Cannot transition from ${from} to ${to}: ${reason}`);
    this.name = 'TransitionError';
  }
}

export interface TransitionContext {
  hasActivity?: boolean;
  hasRequiredFields?: boolean;
  hasClient?: boolean;
}

export function canTransition(from: LeadStatus, to: LeadStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function validateTransition(from: LeadStatus, to: LeadStatus, context?: TransitionContext): void {
  if (!canTransition(from, to)) {
    throw new TransitionError(from, to, `Invalid transition`);
  }

  if (from === 'new' && to === 'contacted' && context && !context.hasActivity) {
    throw new TransitionError(from, to, 'Requires at least one activity record');
  }

  if (from === 'contacted' && to === 'qualified' && context && !context.hasRequiredFields) {
    throw new TransitionError(from, to, 'Requires complete minimum information (name, email/phone, source)');
  }

  if (from === 'qualified' && to === 'won' && context && !context.hasClient) {
    throw new TransitionError(from, to, 'Cannot mark as won without converting to Client first');
  }
}
```

**Diferencia clave con Operations**: Se usa `TransitionContext` (objeto) en lugar de funciones guard separadas. Los guards se evalúan dentro de `validateTransition()` según el par `from→to`. El servicio construye el context antes de llamar a validateTransition, consultando ActivityModel y verificando campos del lead.

---

## 7. LeadService

`src/leads/services/lead.service.ts` — Clase con los siguientes métodos. **NOTA**: La implementación fusiona en un solo servicio lo que el diseño original separaba en `LeadService`, `DuplicateService`, y `LeadConversionService`. `convertToClient()` vive aquí para mantener coherencia transaccional.

### 7.1 `createLead(data: CreateLeadInput, userId: string, tenantId: string) → Promise<CreateLeadResult>`

1. **Duplicate detection in-line**: Si `data.email || data.phone || data.companyName`, llama a `findDuplicates(tenantId, email, phone, companyName)` y construye array de `DuplicateWarning` con `leadId`, `matchedField`, `matchedValue`. NO bloquea.
2. Setea `status = 'new'`, `createdBy = userId`, `updatedBy = userId`.
3. Si `data.assignedTo` está presente, llama a `LeadAssignmentService.assign()`.
4. Registra audit: `logActivity({ entityType: 'lead', action: 'created', ... })`.
5. Devuelve `{ lead, warnings? }`.

**Desviaciones**: No normaliza email/phone explícitamente. No crea Activity CRM (solo audit log). DuplicateWarning es un objeto con `leadId`, `matchedField`, `matchedValue` (no `ILead[]`).

### 7.2 `getLead(leadId: string, tenantId: string) → Promise<ILead | null>`

Query: `{ _id, tenantId, deletedAt: null }` con `.populate('assignedTo', 'name email').lean()`. No soporta `includeDeleted`.

### 7.3 `listLeads(filters: LeadListFilters, tenantId: string) → Promise<LeadListResult>`

```typescript
interface LeadListFilters {
  status?: LeadStatus;
  assignedTo?: string;
  source?: string;
  createdAtGte?: string;
  createdAtLte?: string;
  search?: string;
  cursor?: string;
  limit?: number;
}
```

Construye query con filtros dinámicos. **Usa paginación cursor-based via `cursorPage()`** (no skip/limit). Soporta filtro `search` textual sobre name/companyName. Siempre excluye `deletedAt: null`. Devuelve `{ data, cursor?, total }`.

### 7.4 `updateLead(leadId: string, data: UpdateLeadInput, userId: string, tenantId: string) → Promise<ILead | null>`

1. **Protege campos**: Rechaza `status` en body con ValidationError. Si `assignedTo` está presente, delega en `LeadAssignmentService.assign()`.
2. Ignora `previousLeadId`, `convertedToClient`, `convertedAt` (no están en UpdateLeadInput).
3. Setea `updatedBy = userId`.
4. Ejecuta `findOneAndUpdate` con `{ _id, tenantId, deletedAt: null }`.
5. Registra audit: `logActivity({ action: 'updated', changes: { after: updateData } })`.

**Desviaciones**: No protege contra update de lead won. No ejecuta duplicate detection en update. No registra Activity CRM.

### 7.5 `changeStatus(leadId: string, newStatus: LeadStatus, userId: string, tenantId: string) → Promise<ILead>`

1. Lee lead actual: `findOne({ _id, tenantId, deletedAt: null }).lean()`.
2. **Guards vía TransitionContext**: Evalúa condiciones antes de llamar a `validateTransition()`.
   - `new→contacted`: consulta `ActivityModel.exists({ entityType: 'lead', entityId, activityType: { $in: ['call', 'email'] } })` → `hasActivity`.
   - `contacted→qualified`: verifica `lead.name`, `(lead.email || lead.phone)`, `lead.companyName` → `hasRequiredFields`.
   - `qualified→won`: verifica `lead.convertedToClient` → `hasClient`.
3. Llama `validateTransition(currentStatus, newStatus, { hasActivity, hasRequiredFields, hasClient })`.
4. Concurrencia: `findOneAndUpdate({ _id, tenantId, status: currentStatus, deletedAt: null }, { $set: { status: newStatus, updatedBy: userId } })`. Si null → `ConflictError`.
5. Registra audit: `logActivity({ action: 'statusChanged', changes: { before: { status }, after: { status } } })`.

**Desviaciones**: No rechaza específicamente `qualified→won` con mensaje especial (lo maneja el guard `hasClient=false` en validateTransition). El error si no existe lead es genérico `Error('Lead not found')`.

### 7.6 `softDelete(leadId: string, userId: string, tenantId: string) → Promise<ILead | null>`

1. Lee lead actual.
2. Si `lead.status === 'won'` → lanza `ValidationError`.
3. Setea `deletedAt = new Date()`, `deletedBy = userId`.
4. Registra audit: `logActivity({ action: 'deleted' })`.

### 7.7 `convertToClient(leadId: string, userId: string, tenantId: string) → Promise<{ client, contact, lead }>`

**Diseño original separaba esto en `LeadConversionService` — la implementación lo fusionó en LeadService.**

1. Lee lead con `findOne({ _id, tenantId, deletedAt: null, status: 'qualified', convertedToClient: null })`.
2. Si null, determina causa (not found / not qualified / already converted) y lanza ValidationError o Error.
3. Inicia sesión MongoDB: `mongoose.startSession()`, `session.startTransaction()`.
4. **Dentro de la transacción**:
   - Crea Client con `customerType: 'residential'`, `status: 'active'`, `fullName: lead.name`.
   - Crea Contact primario (firstName/lastName desde split de name).
   - Si lead.notes existe, crea Activity CRM tipo 'note' con entityType 'client'.
   - Crea Activity CRM de conversión: entityType 'lead', activityType 'note', title 'Convertido a Cliente'.
   - Actualiza Lead: `findOneAndUpdate({ _id: lead._id, status: 'qualified', convertedToClient: null }, { status: 'won', convertedToClient, convertedAt })`.
   - Si update falla → `ConflictError` (otro usuario ya convirtió).
5. `commitTransaction()`, audit log, retorna `{ client, contact, lead }`.
6. catch → `abortTransaction()`, finally → `endSession()`.

### 7.8 Errores custom

```typescript
export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
```

---

## 8. LeadAssignmentService

`src/leads/services/lead-assignment.service.ts`

### 8.1 `assign(leadId: string, userId: string, assignedBy: string, tenantId: string, reason?: string) → Promise<{ lead: ILead; assignment: ILeadAssignment }>`

1. Verifica que el lead existe: `LeadModel.findOne({ _id, tenantId, deletedAt: null })`.
2. **Cierra asignación activa previa**: `findOneAndUpdate({ leadId, tenantId, unassignedAt: null }, { $set: { unassignedAt: new Date() } })`.
3. Crea nuevo `LeadAssignment` con `assignedAt = new Date()`, `unassignedAt: null`.
4. Actualiza `Lead.assignedTo = userId`.
5. Registra audit: `logActivity({ action: 'assigned', metadata: { userId, assignmentId, reason } })`.
6. Devuelve `{ assignment, lead }`.

**Desviaciones**: El orden de parámetros es `(leadId, userId, assignedBy, tenantId, reason?)` — difiere del diseño original que era `(leadId, userId, tenantId, assignedBy, reason?)`.

### 8.2 `unassign(leadId: string, tenantId: string, userId: string) → Promise<{ lead: ILead; assignment: ILeadAssignment }>`

1. Busca asignación activa: `findOneAndUpdate({ leadId, tenantId, unassignedAt: null }, { $set: { unassignedAt: new Date() } }, { new: true })`. Si no existe → error.
2. Setea `Lead.assignedTo = null`.
3. Registra audit: `logActivity({ action: 'unassigned', metadata: { previousUserId } })`.

**Desviaciones**: NO recibe `assignedBy` ni `reason`. El parámetro `userId` es el que ejecuta la acción (no el desasignado). No recibe `reason`.

### 8.3 `reassign(leadId: string, newUserId: string, assignedBy: string, tenantId: string, reason?: string) → Promise<{ lead; assignment }>`

Delega en `this.assign()` — alias semántico.

### 8.4 `getAssignmentHistory(leadId: string, tenantId: string) → Promise<ILeadAssignment[]>`

`find({ tenantId, leadId }).sort({ assignedAt: -1 })`.

### 8.5 `getActiveAssignments(userId: string, tenantId: string) → Promise<ILeadAssignment[]>`

`find({ userId, tenantId, unassignedAt: null })`.

---

## 9. PipelineService

`src/leads/services/pipeline.service.ts`

### 9.1 `getPipelines(tenantId: string) → Promise<IPipeline[]>`

`find({ tenantId, deletedAt: null })`. Si el array está vacío, ejecuta **lazy seeding**: llama a `seedDefaultPipeline(tenantId)` y retorna el pipeline creado en un array.

### 9.2 `getDefaultPipeline(tenantId: string) → Promise<IPipeline | null>`

`findOne({ tenantId, isDefault: true, deletedAt: null })`. Si no existe, ejecuta lazy seeding via `seedDefaultPipeline()`.

### 9.3 `seedDefaultPipeline(tenantId: string, userId?: string) → Promise<IPipeline>`

Crea pipeline con. Es **idempotente**: verifica si ya existe un default antes de crear.

```typescript
{
  tenantId,
  name: 'Pipeline Default',
  isDefault: true,
  stages: [
    { name: 'Nuevo contacto', position: 0, probability: 10, isActive: true },
    { name: 'Contactado', position: 1, probability: 25, isActive: true },
    { name: 'Visita técnica', position: 2, probability: 50, isActive: true },
    { name: 'Presupuesto', position: 3, probability: 75, isActive: true },
    { name: 'Ganado', position: 4, probability: 100, isActive: true },
  ],
  createdBy: userId || 'system',
  updatedBy: userId || 'system',
}
```

**Desviaciones**: Nombres de stages diferentes al spec. Position 0-based. Es función standalone exportada (no método de clase).

### 9.4 `createPipeline(data: CreatePipelineInput, userId: string, tenantId: string) → Promise<IPipeline>`

Crea pipeline personalizado. `isDefault` se setea automáticamente: `true` si es el primer pipeline del tenant, `false` si ya existen.

### 9.5 `updatePipeline(pipelineId: string, data: Partial<CreatePipelineInput>, userId: string, tenantId: string) → Promise<IPipeline | null>`

Actualiza nombre y/o stages. `findOneAndUpdate` con `$set`.

### 9.6 `addStage(pipelineId: string, stage: { name, probability }, userId: string, tenantId: string) → Promise<IPipeline | null>`

1. Lee pipeline actual para obtener `maxPosition`.
2. Agrega stage al final con `position = maxPosition + 1` usando `$push`.
3. **Desviación**: No inserta en posición específica ni reordena existentes — siempre agrega al final.

### 9.7 `updateStage(pipelineId: string, stageIndex: number, data: Partial<IPipelineStage>, userId: string, tenantId: string) → Promise<IPipeline | null>`

**Desviación**: Usa `stageIndex` numérico (no `stageId` string). Construye `$set` dinámico con `stages.${stageIndex}.${key}`.

### 9.8 `deactivateStage(pipelineId: string, stageIndex: number, userId: string, tenantId: string) → Promise<IPipeline | null>`

Setea `stages.${stageIndex}.isActive = false`. **Desviación**: No verifica que quede al menos 1 stage activa.

### 9.9 `reorderStages(pipelineId: string, stageOrder: { stageId: string; position: number }[], userId: string, tenantId: string) → Promise<IPipeline | null>`

Reordena stages según array de `{ stageId, position }`. Lee pipeline actual, construye nuevo array de stages con posiciones actualizadas, y persiste con `findOneAndUpdate`.

### 9.10 `deletePipeline(pipelineId: string, userId: string, tenantId: string) → Promise<IPipeline | null>`

1. Valida que `pipeline.isDefault !== true` (lanza ValidationError si es default).
2. No implementa `setAsDefault` — no hay ruta para cambiar el pipeline default.

---

## 10. Duplicate Detection

**NOTA**: No existe `DuplicateService` como clase separada. La detección se invoca directamente desde `LeadService.createLead()` usando el helper.

### 10.1 `src/leads/helpers/duplicate-detection.ts`

```typescript
export function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-\+]/g, '');
}

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function findDuplicates(
  tenantId: string,
  email?: string,
  phone?: string,
  companyName?: string,
): Promise<unknown[]> {
  const conditions: Record<string, unknown>[] = [];

  if (email) {
    conditions.push({
      email: { $regex: new RegExp(`^${escapeRegex(email.toLowerCase())}$`, 'i') },
    });
  }

  if (phone) {
    conditions.push({ phone: { $regex: new RegExp(escapeRegex(phone), 'i') } });
  }

  if (companyName) {
    conditions.push({
      companyName: { $regex: new RegExp(`^${escapeRegex(companyName.trim())}$`, 'i') },
    });
  }

  if (conditions.length === 0) return [];

  const query: Record<string, unknown> = {
    tenantId,
    deletedAt: null,
    $or: conditions,
  };

  return LeadModel.find(query).lean().exec();
}
```

**Desviaciones**: La función se llama `findDuplicates` (no `detectDuplicates`). Los parámetros son `(tenantId, email?, phone?, companyName?)` en lugar de `(tenantId, fields, excludeId?)`. **No soporta auto-exclusión** (no hay parámetro `excludeId`).

### 10.2 Detección en LeadService.createLead()

La lógica de detección está in-line en `createLead()`:

1. Si `data.email || data.phone || data.companyName`, llama a `findDuplicates()`.
2. Por cada duplicado, compara los campos individualmente y construye `DuplicateWarning[]` con `leadId`, `matchedField`, `matchedValue`.
3. Si hay warnings, se incluyen en el resultado como `result.warnings`.

### 10.3 Uso en actualizaciones

`updateLead()` **NO ejecuta detección de duplicados**. Solo la ejecuta `createLead()`.

**Decisión de diseño**: La normalización de phone NO se hace a nivel de schema (no guardamos un campo `phoneNormalized` separado). En su lugar, la detección usa regex con escape de caracteres especiales. Si en el futuro la detección de duplicados por phone se vuelve un bottleneck, se agrega un campo `phoneDigest` con hash normalizado + índice.

---

## 11. Conversión Lead → Client

**NOTA**: No existe `LeadConversionService` como clase separada. El método `convertToClient()` vive en `LeadService`.

### Algoritmo transaccional (en `LeadService.convertToClient()`)

```typescript
async convertToClient(
  leadId: string,
  userId: string,
  tenantId: string,
): Promise<{ client: Record<string, unknown>; contact: Record<string, unknown>; lead: Record<string, unknown> }> {

  // 1. Leer lead con optimistic lock
  const lead = await LeadModel.findOne({
    _id: leadId, tenantId, deletedAt: null,
    status: 'qualified', convertedToClient: null,
  }).exec();

  if (!lead) {
    // Determinar causa con queries adicionales
    const existing = await LeadModel.findOne({
      _id: leadId, tenantId, deletedAt: null,
    }).lean().exec();
    if (!existing) throw new Error('Lead not found');
    if (existing.status !== 'qualified') throw new ValidationError(`Lead must be in 'qualified' status to convert. Current status: '${existing.status}'`);
    if (existing.convertedToClient) throw new ValidationError('Lead has already been converted to a client');
    throw new Error('Cannot convert lead');
  }

  // 2. Iniciar sesión de transacción MongoDB
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 2a. Crear Client (customerType fijo 'residential', sin options)
    const [client] = await ClientModel.create([{
      tenantId: lead.tenantId,
      customerType: 'residential',
      status: 'active',
      fullName: lead.name,
      companyName: lead.companyName || undefined,
      createdBy: userId,
      updatedBy: userId,
    }], { session });

    // 2b. Crear Contact primario
    const nameParts = lead.name.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || firstName;

    const [contact] = await ContactModel.create([{
      tenantId: lead.tenantId,
      clientId: client._id,
      firstName,
      lastName,
      email: lead.email || undefined,
      phone: lead.phone || undefined,
      isPrimary: true,
      createdBy: userId,
      updatedBy: userId,
    }], { session });

    // 2c. Si lead tiene notes, crear Activity
    if (lead.notes) {
      await ActivityModel.create([{
        tenantId: lead.tenantId,
        entityType: 'client',
        entityId: client._id,
        activityType: 'note',
        title: 'Notas del Lead original',
        description: lead.notes,
        performedBy: userId,
        metadata: { sourceLeadId: lead._id },
      }], { session });
    }

    // 2d. Activity de conversión
    await ActivityModel.create([{
      tenantId: lead.tenantId,
      entityType: 'lead',
      entityId: lead._id,
      activityType: 'note',
      title: 'Convertido a Cliente',
      description: `Cliente creado: ${client.fullName || client.companyName}`,
      performedBy: userId,
      metadata: { clientId: client._id },
    }], { session });

    // 2e. Actualizar Lead
    const updatedLead = await LeadModel.findOneAndUpdate(
      { _id: lead._id, status: 'qualified', convertedToClient: null },
      {
        $set: {
          status: 'won',
          convertedToClient: client._id,
          convertedAt: new Date(),
          updatedBy: userId,
        },
      },
      { new: true, session }
    ).exec();

    if (!updatedLead) {
      throw new ConflictError('Lead was already converted by another user');
    }

    // 3. Commit
    await session.commitTransaction();

    // 4. Audit log (fuera de transacción)
    await logActivity({
      tenantId,
      entityType: 'lead',
      entityId: leadId,
      action: 'converted',
      actorId: userId,
      metadata: { clientId: String(client._id) },
    });

    return {
      client: client.toObject(),
      contact: contact.toObject(),
      lead: updatedLead.toObject(),
    };

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
```

**Desviaciones**: No acepta `options` (customerType/tags). `customerType` es siempre `'residential'`. La Activity de conversión usa `activityType: 'note'` (no `'status_change'`). Retorna `Record<string, unknown>` (no tipos específicos).

### Concurrencia

El `findOneAndUpdate` con filtro `{ status: 'qualified', convertedToClient: null }` garantiza que solo el primer request en ejecutar el update gane. El segundo encuentra `matchedCount === 0` y lanza `ConflictError`. Esto es análogo al patrón de optimistic concurrency usado en `WorkOrderService.changeStatus`.

---

## 12. API Routes

### Estructura real (8 archivos, no 9)

```
src/app/api/crm/leads/
├── route.ts                        # GET → LeadService.listLeads(), POST → LeadService.createLead()
├── [id]/
│   ├── route.ts                    # GET → LeadService.getLead(), PATCH → LeadService.updateLead(), DELETE → LeadService.softDelete()
│   ├── status/route.ts             # PATCH → LeadService.changeStatus()
│   ├── assign/route.ts             # POST → LeadAssignmentService.assign() (solo assign, no unassign)
│   └── convert/route.ts            # POST → LeadService.convertToClient()

src/app/api/crm/pipelines/
├── route.ts                        # GET → PipelineService.getPipelines(), POST → PipelineService.createPipeline()
└── [id]/
    ├── route.ts                    # PATCH → PipelineService.updatePipeline(), DELETE → PipelineService.deletePipeline()
    └── stages/
        └── route.ts                # POST → PipelineService.addStage()
                                    # NOTA: No existe stages/[stageId]/route.ts
                                    # updateStage y deactivateStage se invocan por stageIndex desde el service
```

### 12.1 `src/app/api/crm/leads/route.ts`

```
GET  → LeadService.listLeads() con cursorPage (no paginación page/limit)
POST → LeadService.createLead() → retorna { lead, warnings? } (no { data, duplicates })
```

### 12.2 `src/app/api/crm/leads/[id]/route.ts`

```
GET    → LeadService.getLead() con populate('assignedTo')
PATCH  → LeadService.updateLead() — retorna lead plano (no { data, duplicates })
DELETE → LeadService.softDelete() — ValidationError → 422
```

### 12.3 `src/app/api/crm/leads/[id]/status/route.ts`

```
PATCH → LeadService.changeStatus() — TransitionError → 422, ConflictError → 409
```

### 12.4 `src/app/api/crm/leads/[id]/assign/route.ts`

```
POST → LeadAssignmentService.assign() — SOLO assign (no soporta unassign con userId:null)
```

**Desviación**: La ruta solo recibe `userId` (obligatorio). No implementa desasignación vía `userId: null`.

### 12.5 `src/app/api/crm/leads/[id]/convert/route.ts`

```
POST → LeadService.convertToClient() — ValidationError → 422, ConflictError → 409
Retorna objeto plano { client, contact, lead } (no envuelto en { data })
```

### 12.6 `src/app/api/crm/pipelines/route.ts`

```
GET  → PipelineService.getPipelines() — retorna { data } (objeto envuelto)
POST → PipelineService.createPipeline() — retorna { data }, status 201
```

### 12.7 `src/app/api/crm/pipelines/[id]/route.ts`

```
PATCH  → PipelineService.updatePipeline() — PipelineValidationError → 422
DELETE → PipelineService.deletePipeline() — PipelineValidationError → 422 (default protection)
```

### 12.8 `src/app/api/crm/pipelines/[id]/stages/route.ts`

```
POST → PipelineService.addStage() — stage agregado al final
      Valida name requerido y probability definido → 400 si faltan
      Retorna { data }, status 201
```

### 12.9 NO IMPLEMENTADO: `stages/[stageId]/route.ts`

No existe ruta para PATCH/DELETE individual de stages. `updateStage()` y `deactivateStage()` existen en el servicio pero no tienen route handler. Se invocan por `stageIndex` (numérico), no por `stageId` (string).

### Patrón de ruta (aplicado en todas)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { LeadService, ValidationError } from '@/src/leads/services/lead.service';
import { TransitionError } from '@/src/leads/helpers/lead-state-machine';
import { ConflictError } from '@/src/leads/services/lead.service';

const service = new LeadService();

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'x-tenant-id and x-user-id headers are required' }, { status: 400 });
    }

    const body = await request.json();
    const result = await service.updateLead(params.id, body, userId, tenantId);

    if (!result) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json(result);  // plano, sin { data } wrapper
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof TransitionError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof ConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
```

**Desviaciones del diseño original**: No retorna `{ data }` wrapper consistente. No usa `duplicates` en la respuesta. Algunas rutas retornan 401 para headers faltantes en lugar de 400. No hay manejo de 403 (permisos) — se delega al middleware.

---

## 13. Tests

### 13.1 Archivos de test (6 archivos, ~1.498 líneas)

| Archivo | Tests | Tipo | Qué cubre |
|---------|-------|------|-----------|
| `tests/leads/lead-state-machine.test.ts` | 28 | Unit | `VALID_TRANSITIONS`, `canTransition`, `validateTransition`, `TransitionError`, guards via TransitionContext |
| `tests/leads/duplicate-detection.test.ts` | 9 | Unit (mocks) | `findDuplicates` por email/phone/companyName, case-insensitive, múltiples criterios, empty, tenant+deleted filter |
| `tests/leads/lead.service.test.ts` | 21 | Integration (mocks) | createLead, getLead, listLeads, updateLead, changeStatus, softDelete, warnings |
| `tests/leads/lead-assignment.service.test.ts` | 8 | Integration (mocks) | assign, unassign, reassign, getAssignmentHistory |
| `tests/leads/pipeline.service.test.ts` | 18 | Integration (mocks) | createPipeline, getPipelines, getDefaultPipeline, updatePipeline, addStage, updateStage, deactivateStage, reorderStages, deletePipeline |
| `tests/leads/conversion.test.ts` | 9 | Integration (mocks) | convertToClient exitoso, errores (status, ya convertido, not found), concurrencia, rollback |
| **Total** | **93** | — | **6 files, 0 failures** |

**NOTA**: No existen tests para `stages/[stageId]`, `status/route.ts`, `assign/route.ts`, `convert/route.ts` como route handlers separados. Todos los tests son de servicios/helpers, no de rutas HTTP.

### 13.2 Estrategia de mocks

- **Mongoose mockeado globalmente**: Todos los tests importan `vi.mock('mongoose')` con `MockObjectId` para evitar dependencia con MongoDB real.
- **ActivityModel.exists**: Mockeado en `lead.service.test.ts` para simular presencia/ausencia de actividades en transición `new→contacted`.
- **ClientModel, ContactModel, ActivityModel**: Mockeados en `conversion.test.ts` para probar transacciones sin base de datos real.
- **`logActivity`**: Mockeado siempre (efecto secundario no crítico).
- **`LeadAssignmentService`**: Mockeado en `lead.service.test.ts` (no se prueba el servicio real de assignments dentro de LeadService).
- **`cursorPage`**: Mockeado en `lead.service.test.ts` para `listLeads`.

### 13.3 Escenarios cubiertos

| Capacidad | Tests que la cubren |
|-----------|---------------------|
| State machine | 28 tests — todas las transiciones válidas/inválidas, terminales, guards |
| Duplicate detection | 9 tests — cada campo, case-insensitive, múltiples criterios, filtro tenant+deleted |
| CRUD + Soft delete | 7 tests — create, get, list, update, delete, restricciones |
| Status changes | 4 tests — válidas, inválidas, concurrentes |
| Assignment | 8 tests — assign, unassign, reassign, history |
| Pipeline | 18 tests — CRUD, stages, lazy seeding, default protection |
| Conversion | 9 tests — exitosa, errores, concurrencia, rollback |

---

## 14. Orden de Implementación

Las dependencias entre archivos determinan el orden. Las flechas indican "depende de":

```
Fase 4 — Orden de implementación
═════════════════════════════════

1. types/lead.ts, types/lead-assignment.ts, types/pipeline.ts
   └── Sin dependencias. Se pueden crear en paralelo.

2. schemas/lead.ts, schemas/lead-assignment.ts, schemas/pipeline.ts
   └── Dependen de: (1) types
   └── Se pueden crear en paralelo.

3. models/*.ts (lead.ts, lead-assignment.ts, pipeline.ts)
   └── Dependen de: (2) schemas
   └── Se pueden crear en paralelo.

4. helpers/state-machine.ts, helpers/duplicate-detection.ts
   └── helpers/state-machine.ts depende de (1) types (LeadStatus)
   └── helpers/duplicate-detection.ts depende de (3) LeadModel
   └── Se pueden crear en paralelo.

5. services/duplicate.service.ts
   └── Depende de: (4) duplicate-detection helper
   └── Depende de: (3) LeadModel

6. services/lead-assignment.service.ts
   └── Depende de: (3) LeadAssignmentModel, LeadModel

7. services/lead.service.ts
   └── Depende de: (4) state-machine, (5) duplicate.service, (6) lead-assignment.service
   └── Depende de: ActivityService (CRM) para guard new→contacted

8. services/pipeline.service.ts
   └── Depende de: (3) PipelineModel

9. services/lead-conversion.service.ts
   └── Depende de: (3) LeadModel, ClientModel, ContactModel, ActivityModel
   └── Depende de: (4) state-machine (validar que solo qualified→won)

10. src/leads/index.ts (barrel)
    └── Depende de: todos los services, models, schemas, types

11. API Routes (pueden ir después de que el service correspondiente existe)
    └── /api/crm/leads/route.ts                    ← depende de (7)
    └── /api/crm/leads/[id]/route.ts               ← depende de (7)
    └── /api/crm/leads/[id]/status/route.ts        ← depende de (7)
    └── /api/crm/leads/[id]/assign/route.ts        ← depende de (6)
    └── /api/crm/leads/[id]/convert/route.ts       ← depende de (9)
    └── /api/crm/pipelines/route.ts                ← depende de (8)
    └── /api/crm/pipelines/[id]/route.ts           ← depende de (8)
    └── /api/crm/pipelines/[id]/stages/route.ts    ← depende de (8)

12. Tests (se escriben en paralelo a cada capa)
    └── Tests de helpers: después de (4)
    └── Tests de servicios: después de (7), (6), (8), (9)

13. RBAC / Permissions
    └── Agregar LEADS_STATUS_CHANGE a Permissions, PermissionGroups, RoleDefaultPermissions
    └── Independiente, se puede hacer en cualquier momento antes de los endpoints.
```

**Secuencia recomendada (agrupada por PR)**:

| PR | Archivos | Rationale |
|----|----------|-----------|
| PR 1 | Types + Schemas + Models + index barrels | Base del módulo, sin lógica de negocio. Fácil de revisar. |
| PR 2 | Helpers (state-machine + duplicate-detection) | Lógica pura, testable en aislamiento. |
| PR 3 | DuplicateService + LeadAssignmentService | Servicios sin dependencias circulares, testables. |
| PR 4 | LeadService (CRUD + status + soft delete) | Core del módulo. Depende de PR 2 + PR 3. |
| PR 5 | PipelineService | Independiente de LeadService. Incluye seed + lazy seed. |
| PR 6 | LeadConversionService | Último servicio porque depende de modelos CRM externos. |
| PR 7 | API Routes + RBAC | Integración con App Router y permisos. |
| PR 8 | Tests completos + integración | Verificación end-to-end de todos los escenarios. |

---

## 15. Riesgos Técnicos y Mitigaciones

### 15.1 Concurrencia en conversión

**Riesgo**: Dos requests simultáneos de POST /convert sobre el mismo lead. El primero lo convierte, el segundo crea otro Client fantasma.

**Mitigación**: El `findOneAndUpdate` con filtro `{ status: 'qualified', convertedToClient: null }` dentro de la transacción garantiza que solo uno gane. El segundo ve `matchedCount === 0` y lanza `ConflictError`. Además, la transacción de MongoDB asegura que si falla el paso 2a (crear Client), el lead no queda marcado como convertido.

### 15.2 Race condition en status transitions

**Riesgo**: Dos PATCH /status simultáneos. Ej: pasa de `new` a `contacted`, y simultáneamente de `new` a `lost`. Ambos leen el mismo status actual.

**Mitigación**: Mismo patrón que WorkOrder — `findOneAndUpdate` con `{ _id, tenantId, status: currentStatus }`. Si el status ya cambió, el segundo request falla con `matchedCount === 0` y lanza `ConflictError`.

### 15.3 Desync entre Lead.assignedTo y LeadAssignment

**Riesgo**: Si el servicio actualiza Lead pero falla antes de crear LeadAssignment (o viceversa), quedan inconsistentes.

**Mitigación**: Toda mutación de `assignedTo` pasa por `LeadAssignmentService.assign()` / `.unassign()`. El método SIEMPRE actualiza LeadAssignment primero (dentro de la misma operación) y Lead después. Si el update de Lead falla, el LeadAssignment queda con `unassignedAt: null` — en la siguiente asignación, el servicio detecta que hay un assignment activo y lo cierra antes de crear el nuevo. Esto es consistente aunque quede un assignment "huérfano" por un lead que no se actualizó.

### 15.4 Lazy seeding de Pipeline en tenants viejos

**Riesgo**: Tenants creados antes de Fase 4 no tienen pipeline. Si el frontend carga sin pipeline, se rompe.

**Mitigación**: El método `getDefaultPipeline()` (llamado desde el GET /pipelines) detecta la ausencia y ejecuta el seed automáticamente. El seed es idempotente: verifica que no exista un pipeline default antes de crear. Esto cubre tanto tenants viejos como un eventual error en el hook de creación de tenants nuevos.

### 15.5 Phone normalization para duplicados

**Riesgo**: La detección de duplicados por phone usa regex, que es computacionalmente más caro que una comparación exacta. Con el volumen esperado (~500 leads/mes) no es problema, pero podría escalar mal.

**Mitigación**: Para la primera iteración, usamos regex. Si se detecta lentitud, se agrega un campo `phoneDigest` al schema de Lead, que se setea en el hook `pre('save')` y `pre('findOneAndUpdate')`. El índice sobre `{ tenantId: 1, phoneDigest: 1 }` haría la detección O(log n).

### 15.6 Soft delete de Lead sin cascade a Activity

**Riesgo**: Al soft-deletear un Lead, las Activities vinculadas (`entityType: "lead"`, `entityId: lead._id`) quedan huérfanas en el timeline.

**Decisión**: NO se cacadea. Las Activities son append-only e inmutables. El timeline del lead desaparece porque el lead ya no se consulta, pero si un admin consulta con `includeDeleted=true`, las activities siguen estando. Esto es intencional — las activities son históricas y no deben eliminarse. Mismo comportamiento que en WorkOrder (las activities de workOrder no se eliminan al soft-deletear).

### 15.7 Transacciones MongoDB en replica set

**Riesgo**: Las transacciones de MongoDB requieren replica set (no funcionan en standalone). El entorno de desarrollo local podría no tener replica set configurado.

**Mitigación**: En desarrollo, usar `MongoMemoryServer` con replica set (soportado por `mongodb-memory-server` con `--replSet`). Alternativamente, wrap de la transacción con fallback: intentar con transacción, si falla porque no hay replica set, ejecutar sin transacción (con el riesgo de consistencia reducida). Esto se documenta claramente como una limitación de desarrollo local.

### 15.8 Permiso faltante LEADS_STATUS_CHANGE

**Riesgo**: La Spec agrega `LEADS_STATUS_CHANGE` que no existe en el código actual de `permissions.ts`. Si no se agrega antes de implementar las rutas, los guards RBAC fallan.

**Mitigación**: Agregar al inicio de la implementación (o en PR 1). Es una línea en `Permissions`, una línea en `PermissionGroups.leads`, y actualizaciones en `RoleDefaultPermissions`. Bajo riesgo, fácil de pasar por alto.

---

---

## 16. Implementation Notes

### 16.1 Decisiones de Implementación (Post-Design)

| # | Decisión | Alternativa Considerada | Razón |
|---|---|---|---|
| 1 | `convertToClient()` en LeadService (no servicio separado) | LeadConversionService separado | Mantener coherencia transaccional sin dependencias circulares |
| 2 | `TransitionContext` en validateTransition | Guards separados (canMarkContacted, validateQualifiedRequirements) | Centralizar validación; el servicio construye el context antes de llamar |
| 3 | Cursor-based pagination via `cursorPage()` | Skip/limit tradicional | Consistencia con módulo CRM existente |
| 4 | `ILead` sin `IAuditFields` | Extender IAuditFields | `IAuditFields` usa ObjectIds para ref; la implementación usa strings |
| 5 | `createBy`/`updatedBy` como `string` | Types.ObjectId | Simplificar integración con auth existente |
| 6 | Solo 4/7 índices en Lead | Todos los 7 índices | Los 3 faltantes son de análisis/reportes, no críticos para funcionalidad core |
| 7 | addStage siempre al final | Inserción con reorden posicional | Simplicidad; el reorden se maneja vía reorderStages() |
| 8 | Pipeline schema sin validator de stages activas | Validator de al menos 1 activa | Se omite por simplicidad; la validación se hace en el servicio |

### 16.2 Desviaciones del Diseño Original

| Aspecto | Diseño Original | Implementación |
|---|---|---|
| `LeadService` métodos | `create()`, `findById()`, `findByTenant()`, `update()`, `changeStatus()`, `softDelete()` | `createLead()`, `getLead()`, `listLeads()`, `updateLead()`, `changeStatus()`, `softDelete()`, `convertToClient()` |
| `DuplicateService` | Clase separada con detectOnCreate/detectOnUpdate | No existe — lógica in-line en LeadService.createLead() |
| `LeadConversionService` | Clase separada con convert() | No existe — lógica en LeadService.convertToClient() |
| `stages/[stageId]/route.ts` | PATCH y DELETE individuales por stageId | No implementado |
| `PipelineService.findByTenant()` | Método findById separado | No implementado como método público |
| `getActiveAssignments()` | Método en LeadAssignmentService | Implementado pero sin route handler |
| `getAssignmentHistory()` | Método en LeadAssignmentService | Implementado pero sin route handler |

### 16.3 Comportamiento No Documentado en Diseño Original

- **Assign route solo soporta assign**: No implementa `userId: null` para desasignar. Si se envía `userId` vacío o ausente, retorna error 400.
- **Pipeline `isDefault` se auto-asigna**: Al crear el primer pipeline de un tenant, `isDefault` se setea automáticamente a `true`.
- **seedDefaultPipeline es idempotente**: Verifica que no exista un default antes de crear.
- **logActivity como único side effect**: No se crean Activity CRM en `createLead()` ni `updateLead()` — solo audit log via `logActivity()`.
- **Error en changeStatus sin lead**: Lanza `Error('Lead not found')` genérico (no ValidationError).
- **deletePipeline no verifica stages activas**: Solo verifica isDefault.

### 16.4 Cobertura de Tests (93 tests, 6 files, 0 failures)

| Archivo | Tests | Cubre |
|---|---|---|
| `tests/leads/lead-state-machine.test.ts` | 28 | canTransition (7), validateTransition (6), guards (7), VALID_TRANSITIONS consistency (5), TERMINAL_STATUSES (3) |
| `tests/leads/duplicate-detection.test.ts` | 9 | findDuplicates por email/phone/companyName, case-insensitive, múltiples criterios, empty, filtro tenant+deleted |
| `tests/leads/lead.service.test.ts` | 21 | createLead (3: success, assignedTo, warnings), getLead (2), listLeads (4: paginated, status, search, date range, default limit), updateLead (4: success, status rejection, assignedTo, not found), changeStatus (4: valid, invalid, concurrent, not found), softDelete (3: success, won rejection, not found) |
| `tests/leads/lead-assignment.service.test.ts` | 8 | assign (3: success, not found, previous close), unassign (2: success, no active), reassign (1), getAssignmentHistory (2) |
| `tests/leads/pipeline.service.test.ts` | 18 | createPipeline (3), getPipelines (2), getDefaultPipeline (2), updatePipeline (2), addStage (2), updateStage (1), deactivateStage (1), reorderStages (2), deletePipeline (3) |
| `tests/leads/conversion.test.ts` | 9 | Successful (4: basic, field mapping, contact email/phone, notes copy), Errors (5: wrong status, already converted, not found, concurrent, rollback) |

### 16.5 Archivos de Código (20 archivos fuente, 8 routes, ~1.745 líneas)

| Componente | Archivos | Líneas |
|---|---|---|
| Types | 4 | ~112 |
| Schemas | 4 | ~88 |
| Models | 4 | ~24 |
| Helpers | 2 | ~91 |
| Pipelines config | 1 | 7 |
| Services | 3 | ~1.029 |
| Barrels | 5 | ~17 |
| API Routes | 8 | ~389 |
| **Total** | **28** | **~1.745** |

---

> **Fin de SDD Design: Fase 4 — Leads y Pipeline Comercial (synced v0.4.0)**
