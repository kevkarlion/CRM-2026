# SDD Spec: Fase 3 — Operaciones, Work Orders y Dispatching

> **Change name**: `fase-3-operaciones`
> **Estado**: Spec (aprobado)
> **Stack**: Next.js, TypeScript, MongoDB Atlas, Mongoose
> **Basado en**: Fase 1 (v0.1.0 — Platform Foundation) + Fase 2 (v0.2.0 — CRM Business Model)
> **Archivo fuente**: `documentacion/sdd/sdd-fase3-operaciones-spec.md`
> **Topic key**: `sdd/fase-3-operaciones/spec`

---

## Tabla de Contenidos

1. [Intent](#1-intent)
2. [File Structure](#2-file-structure)
3. [Type Definitions](#3-type-definitions)
4. [Schema Specifications](#4-schema-specifications)
5. [Model Specifications](#5-model-specifications)
6. [Index Specifications](#6-index-specifications)
7. [State Machine Specification](#7-state-machine-specification)
8. [Snapshot Field Specifications](#8-snapshot-field-specifications)
9. [Business Rules and Integrity Rules](#9-business-rules-and-integrity-rules)
10. [Relationship Specifications](#10-relationship-specifications)
11. [Risk Review](#11-risk-review)

---

## 1. Intent

Construir el núcleo operativo del sistema — Work Orders, Scheduling, Dispatching, Technician Assignments, Checklists, Workflow Operacional e Historial Operacional.

El modulo `src/operations/` habilita el ciclo de vida completo de una orden de trabajo: desde su creacion en estado `draft`, pasando por asignacion, ruteo, ejecucion en sitio, hasta su cierre y reporte de visita. Es el puente entre la gestion comercial (CRM, Phase 2) y la ejecucion tecnica en campo.

**Principios de diseno:**

- Separacion estricta: `src/operations/` es un modulo top-level nuevo, no mezclado con CRM.
- Los Work Orders referencian entidades CRM (Client, Location, Equipment) via `ObjectId`, pero no las poseen.
- **Snapshots**: Al crear una WorkOrder, se captura un snapshot del estado actual de Client, Location y Equipment (si aplica). Esto preserva el contexto historico aunque esos registros cambien despues.
- El timeline operacional (`WorkOrderEvent`) coexiste con `ActivityLog` de core — `WorkOrderEvent` es especifico de operaciones, `ActivityLog` es audit cross-entity generico.
- Attachments se reusan via el sistema polimorfico existente (`entityType: "workOrder"`).
- Soft-delete en todas las entidades de negocio siguiendo el patron de Phase 2, con restricciones adicionales para WorkOrder.

---

## 2. File Structure

```
src/operations/
├── types/
│   ├── index.ts                          # Barrel export
│   ├── work-order.ts                     # IWorkOrder, CreateWorkOrderInput, UpdateWorkOrderInput
│   ├── work-order-assignment.ts          # IWorkOrderAssignment, CreateWorkOrderAssignmentInput
│   ├── pre-visit-checklist.ts            # IPreVisitChecklist, CreatePreVisitChecklistInput
│   ├── work-order-event.ts               # IWorkOrderEvent, CreateWorkOrderEventInput
│   └── visit-report.ts                   # IVisitReport, CreateVisitReportInput, UpdateVisitReportInput
├── schemas/
│   ├── index.ts                          # Barrel export
│   ├── work-order.ts                     # workOrderSchema + indexes
│   ├── work-order-assignment.ts          # workOrderAssignmentSchema + indexes
│   ├── pre-visit-checklist.ts            # preVisitChecklistSchema + indexes
│   ├── work-order-event.ts               # workOrderEventSchema + indexes
│   └── visit-report.ts                   # visitReportSchema + indexes
├── models/
│   ├── index.ts                          # Barrel export
│   ├── work-order.ts                     # WorkOrderModel
│   ├── work-order-assignment.ts          # WorkOrderAssignmentModel
│   ├── pre-visit-checklist.ts            # PreVisitChecklistModel
│   ├── work-order-event.ts               # WorkOrderEventModel
│   └── visit-report.ts                   # VisitReportModel
└── index.ts                              # Barrel publico del modulo
```

**Scope boundaries — NO incluido en esta fase:**
- Quotes, Invoicing, Leads, Commercial Pipeline
- APIs, Controllers, Services, Frontend
- Tests (seran parte de las tasks de implementacion)

---

## 3. Type Definitions

### 3.1 Audit Fields (reused from CRM)

Reutilizar `src/crm/types/audit-fields.ts` existente:

```typescript
import { Types } from 'mongoose';

export interface IAuditFields {
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  deletedBy?: Types.ObjectId;
  deletedAt: Date | null;
}
```

### 3.2 Enums and Union Types

```typescript
// src/operations/types/work-order.ts

export type WorkOrderPriority = 'low' | 'normal' | 'high' | 'urgent' | 'emergency';

export type WorkOrderCategory =
  | 'installation'
  | 'maintenance'
  | 'repair'
  | 'inspection'
  | 'warranty'
  | 'emergency';

export type WorkOrderStatus =
  | 'draft'
  | 'scheduled'
  | 'confirmed'
  | 'assigned'
  | 'en_route'
  | 'on_site'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'closed';

export interface IClientSnapshot {
  name?: string;
  email?: string;
  phone?: string;
  taxId?: string;
  customerType?: string;
  status?: string;
}

export interface ILocationSnapshot {
  name?: string;
  address?: string;
  city?: string;
  province?: string;
  country?: string;
  postalCode?: string;
}

export interface IEquipmentSnapshot {
  equipmentType?: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  status?: string;
}
```

### 3.3 IWorkOrder

```typescript
// src/operations/types/work-order.ts

import { Document, Types } from 'mongoose';
import { IAuditFields } from '../../crm/types/audit-fields';

export interface IWorkOrder extends Document, IAuditFields {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  clientId: Types.ObjectId;
  locationId: Types.ObjectId;
  equipmentId: Types.ObjectId | null;
  /** Snapshot of client data at creation time */
  clientSnapshot: IClientSnapshot;
  /** Snapshot of location data at creation time */
  locationSnapshot: ILocationSnapshot;
  /** Snapshot of equipment data at creation time (nullable) */
  equipmentSnapshot: IEquipmentSnapshot | null;
  /** Auto-generated: WO-{TENANTPREFIX}-{YYYYMMDD}-{XXXX} */
  workOrderNumber: string;
  title: string;
  description?: string;
  priority: WorkOrderPriority;
  category: WorkOrderCategory;
  status: WorkOrderStatus;
  scheduledDate?: Date;
  scheduledStart?: Date;
  scheduledEnd?: Date;
  estimatedDuration?: number; // minutes
  /** SLA: optional, for future time-to-respond metrics */
  responseDueAt?: Date;
  /** SLA: optional, for future time-to-resolve metrics */
  resolutionDueAt?: Date;
  assignedTechnicians: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

export type CreateWorkOrderInput = Omit<
  IWorkOrder,
  keyof Document
  | '_id'
  | 'createdAt'
  | 'updatedAt'
  | 'createdBy'
  | 'updatedBy'
  | 'deletedBy'
  | 'deletedAt'
  | 'workOrderNumber'
  | 'assignedTechnicians'
  | 'status'
>;

export type UpdateWorkOrderInput = Partial<
  Omit<
    CreateWorkOrderInput,
    'tenantId' | 'clientId' | 'clientSnapshot' | 'locationSnapshot' | 'equipmentSnapshot' | 'workOrderNumber'
  >
>;
```

### 3.4 IWorkOrderAssignment

```typescript
// src/operations/types/work-order-assignment.ts

import { Document, Types } from 'mongoose';

export type AssignmentStatus = 'assigned' | 'acknowledged' | 'declined' | 'replaced';

export interface IWorkOrderAssignment extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  workOrderId: Types.ObjectId;
  technicianId: Types.ObjectId;
  assignedBy: Types.ObjectId;
  assignedAt: Date;
  status: AssignmentStatus;
  acknowledgedAt?: Date;
  declinedAt?: Date;
  replacedAt?: Date;
  replacedByAssignmentId?: Types.ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateWorkOrderAssignmentInput = Omit<
  IWorkOrderAssignment,
  keyof Document
  | '_id'
  | 'createdAt'
  | 'updatedAt'
  | 'status'
  | 'acknowledgedAt'
  | 'declinedAt'
  | 'replacedAt'
  | 'replacedByAssignmentId'
>;
```

### 3.5 IPreVisitChecklist

```typescript
// src/operations/types/pre-visit-checklist.ts

import { Document, Types } from 'mongoose';

export interface IPreVisitChecklist extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  workOrderId: Types.ObjectId;
  workOrderReviewed: boolean;
  toolsPrepared: boolean;
  partsAvailable: boolean;
  routeConfirmed: boolean;
  vehicleAssigned: boolean;
  safetyEquipmentChecked: boolean;
  notes?: string;
  completedBy: Types.ObjectId;
  completedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type CreatePreVisitChecklistInput = Omit<
  IPreVisitChecklist,
  keyof Document
  | '_id'
  | 'createdAt'
  | 'updatedAt'
  | 'completedBy'
  | 'completedAt'
>;
```

### 3.6 IWorkOrderEvent

```typescript
// src/operations/types/work-order-event.ts

import { Document, Types } from 'mongoose';

export type WorkOrderEventType =
  | 'created'
  | 'assigned'
  | 'status_changed'
  | 'checklist_completed'
  | 'technician_changed'
  | 'visit_started'
  | 'visit_completed'
  | 'attachment_uploaded'
  | 'note_added'
  | 'closed'
  | 'rescheduled';

export interface IWorkOrderEvent extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  workOrderId: Types.ObjectId;
  eventType: WorkOrderEventType;
  description: string;
  performedBy: Types.ObjectId;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export type CreateWorkOrderEventInput = Omit<
  IWorkOrderEvent,
  keyof Document | '_id' | 'createdAt'
>;
```

### 3.7 IVisitReport

```typescript
// src/operations/types/visit-report.ts

import { Document, Types } from 'mongoose';
import { IAuditFields } from '../../crm/types/audit-fields';

export interface IVisitReport extends Document, IAuditFields {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  workOrderId: Types.ObjectId;
  technicianId: Types.ObjectId;
  arrivalTime: Date;
  departureTime: Date;
  workPerformed: string;
  observations?: string;
  recommendations?: string;
  /** FUTURE: URL or base64 of digital signature. Not implemented now. */
  customerSignature?: string;
  /** FUTURE: name of person who signed. Not implemented now. */
  customerName?: string;
  /** FUTURE: when the signature was captured. Not implemented now. */
  signedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateVisitReportInput = Omit<
  IVisitReport,
  keyof Document
  | '_id'
  | 'createdAt'
  | 'updatedAt'
  | 'createdBy'
  | 'updatedBy'
  | 'deletedBy'
  | 'deletedAt'
  | 'customerSignature'
  | 'customerName'
  | 'signedAt'
>;

export type UpdateVisitReportInput = Partial<
  Omit<CreateVisitReportInput, 'tenantId' | 'workOrderId' | 'technicianId'>
>;
```

### 3.8 Types Barrel (`src/operations/types/index.ts`)

```typescript
export {
  WorkOrderPriority,
  WorkOrderCategory,
  WorkOrderStatus,
  IClientSnapshot,
  ILocationSnapshot,
  IEquipmentSnapshot,
  IWorkOrder,
  CreateWorkOrderInput,
  UpdateWorkOrderInput,
} from './work-order';

export {
  AssignmentStatus,
  IWorkOrderAssignment,
  CreateWorkOrderAssignmentInput,
} from './work-order-assignment';

export {
  IPreVisitChecklist,
  CreatePreVisitChecklistInput,
} from './pre-visit-checklist';

export {
  WorkOrderEventType,
  IWorkOrderEvent,
  CreateWorkOrderEventInput,
} from './work-order-event';

export {
  IVisitReport,
  CreateVisitReportInput,
  UpdateVisitReportInput,
} from './visit-report';
```

---

## 4. Schema Specifications

### 4.1 WorkOrder Schema

```typescript
// src/operations/schemas/work-order.ts

import { Schema } from 'mongoose';
import { IWorkOrder } from '../types/work-order';

const auditFields = {
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  deletedAt: { type: Date, default: null },
};

const clientSnapshotSchema = new Schema({
  name: String,
  email: String,
  phone: String,
  taxId: String,
  customerType: String,
  status: String,
}, { _id: false });

const locationSnapshotSchema = new Schema({
  name: String,
  address: String,
  city: String,
  province: String,
  country: String,
  postalCode: String,
}, { _id: false });

const equipmentSnapshotSchema = new Schema({
  equipmentType: String,
  brand: String,
  model: String,
  serialNumber: String,
  status: String,
}, { _id: false });

export const workOrderSchema = new Schema<IWorkOrder>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    locationId: { type: Schema.Types.ObjectId, ref: 'Location', required: true },
    equipmentId: { type: Schema.Types.ObjectId, ref: 'Equipment', default: null },
    clientSnapshot: { type: clientSnapshotSchema, required: true },
    locationSnapshot: { type: locationSnapshotSchema, required: true },
    equipmentSnapshot: { type: equipmentSnapshotSchema, default: null },
    workOrderNumber: { type: String, required: true },
    title: { type: String, required: true },
    description: String,
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent', 'emergency'],
      required: true,
      default: 'normal',
    },
    category: {
      type: String,
      enum: ['installation', 'maintenance', 'repair', 'inspection', 'warranty', 'emergency'],
      required: true,
    },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'confirmed', 'assigned', 'en_route', 'on_site', 'paused', 'completed', 'cancelled', 'closed'],
      required: true,
      default: 'draft',
    },
    scheduledDate: Date,
    scheduledStart: Date,
    scheduledEnd: Date,
    estimatedDuration: Number,
    responseDueAt: Date,
    resolutionDueAt: Date,
    assignedTechnicians: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    ...auditFields,
  },
  { timestamps: true }
);

// --- Indexes ---
// Main operational filter
workOrderSchema.index({ tenantId: 1, status: 1, scheduledDate: -1 });
// Unique exact lookup by work order number
workOrderSchema.index(
  { tenantId: 1, workOrderNumber: 1 },
  { unique: true }
);
// Client history
workOrderSchema.index({ tenantId: 1, clientId: 1, status: 1 });
// Technician workload
workOrderSchema.index({ tenantId: 1, assignedTechnicians: 1, status: 1 });
// Daily agenda
workOrderSchema.index({ tenantId: 1, scheduledDate: 1, status: 1 });
// Soft-delete filter
workOrderSchema.index({ tenantId: 1, deletedAt: 1 });
// Dispatch queue
workOrderSchema.index({ tenantId: 1, priority: 1, status: 1, scheduledDate: -1 });
```

### 4.2 WorkOrderAssignment Schema

```typescript
// src/operations/schemas/work-order-assignment.ts

import { Schema } from 'mongoose';
import { IWorkOrderAssignment } from '../types/work-order-assignment';

export const workOrderAssignmentSchema = new Schema<IWorkOrderAssignment>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    workOrderId: { type: Schema.Types.ObjectId, ref: 'WorkOrder', required: true },
    technicianId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assignedAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ['assigned', 'acknowledged', 'declined', 'replaced'],
      required: true,
      default: 'assigned',
    },
    acknowledgedAt: Date,
    declinedAt: Date,
    replacedAt: Date,
    replacedByAssignmentId: { type: Schema.Types.ObjectId, ref: 'WorkOrderAssignment' },
    notes: String,
  },
  { timestamps: true }
);

// --- Indexes ---
// Unique: one active assignment per technician + work order
workOrderAssignmentSchema.index(
  { tenantId: 1, workOrderId: 1, technicianId: 1 },
  { unique: true }
);
// Technician workload history
workOrderAssignmentSchema.index({ tenantId: 1, technicianId: 1, status: 1 });
// Current assignments per work order
workOrderAssignmentSchema.index({ tenantId: 1, workOrderId: 1, status: 1 });
```

### 4.3 PreVisitChecklist Schema

```typescript
// src/operations/schemas/pre-visit-checklist.ts

import { Schema } from 'mongoose';
import { IPreVisitChecklist } from '../types/pre-visit-checklist';

export const preVisitChecklistSchema = new Schema<IPreVisitChecklist>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    workOrderId: { type: Schema.Types.ObjectId, ref: 'WorkOrder', required: true, unique: true },
    workOrderReviewed: { type: Boolean, default: false },
    toolsPrepared: { type: Boolean, default: false },
    partsAvailable: { type: Boolean, default: false },
    routeConfirmed: { type: Boolean, default: false },
    vehicleAssigned: { type: Boolean, default: false },
    safetyEquipmentChecked: { type: Boolean, default: false },
    notes: String,
    completedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    completedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// --- Indexes ---
// Unique: one checklist per work order
preVisitChecklistSchema.index({ tenantId: 1, workOrderId: 1 }, { unique: true });
```

### 4.4 WorkOrderEvent Schema

```typescript
// src/operations/schemas/work-order-event.ts

import { Schema } from 'mongoose';
import { IWorkOrderEvent } from '../types/work-order-event';

export const workOrderEventSchema = new Schema<IWorkOrderEvent>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    workOrderId: { type: Schema.Types.ObjectId, ref: 'WorkOrder', required: true },
    eventType: {
      type: String,
      enum: ['created', 'assigned', 'status_changed', 'checklist_completed', 'technician_changed', 'visit_started', 'visit_completed', 'attachment_uploaded', 'note_added', 'closed', 'rescheduled'],
      required: true,
    },
    description: { type: String, required: true },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// --- Indexes ---
// Timeline cursor pagination
workOrderEventSchema.index({ tenantId: 1, workOrderId: 1, createdAt: -1 });
// Event type analytics
workOrderEventSchema.index({ tenantId: 1, eventType: 1, createdAt: -1 });
```

### 4.5 VisitReport Schema

```typescript
// src/operations/schemas/visit-report.ts

import { Schema } from 'mongoose';
import { IVisitReport } from '../types/visit-report';

const auditFields = {
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  deletedAt: { type: Date, default: null },
};

export const visitReportSchema = new Schema<IVisitReport>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    workOrderId: { type: Schema.Types.ObjectId, ref: 'WorkOrder', required: true, unique: true },
    technicianId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    arrivalTime: { type: Date, required: true },
    departureTime: { type: Date, required: true },
    workPerformed: { type: String, required: true },
    observations: String,
    recommendations: String,
    // FUTURE: placeholder fields for digital signature — not implemented now
    customerSignature: String,
    customerName: String,
    signedAt: Date,
    ...auditFields,
  },
  { timestamps: true }
);

// --- Indexes ---
// Unique: one report per work order
visitReportSchema.index({ tenantId: 1, workOrderId: 1 }, { unique: true });
// Technician report history
visitReportSchema.index({ tenantId: 1, technicianId: 1, createdAt: -1 });
```

### 4.6 Schemas Barrel (`src/operations/schemas/index.ts`)

```typescript
export { workOrderSchema } from './work-order';
export { workOrderAssignmentSchema } from './work-order-assignment';
export { preVisitChecklistSchema } from './pre-visit-checklist';
export { workOrderEventSchema } from './work-order-event';
export { visitReportSchema } from './visit-report';
```

---

## 5. Model Specifications

### 5.1 WorkOrder Model

```typescript
// src/operations/models/work-order.ts

import mongoose, { Model } from 'mongoose';
import { IWorkOrder } from '../types/work-order';
import { workOrderSchema } from '../schemas/work-order';

const WorkOrderModel: Model<IWorkOrder> = mongoose.model<IWorkOrder>('WorkOrder', workOrderSchema);

export default WorkOrderModel;
```

### 5.2 WorkOrderAssignment Model

```typescript
// src/operations/models/work-order-assignment.ts

import mongoose, { Model } from 'mongoose';
import { IWorkOrderAssignment } from '../types/work-order-assignment';
import { workOrderAssignmentSchema } from '../schemas/work-order-assignment';

const WorkOrderAssignmentModel: Model<IWorkOrderAssignment> =
  mongoose.model<IWorkOrderAssignment>('WorkOrderAssignment', workOrderAssignmentSchema);

export default WorkOrderAssignmentModel;
```

### 5.3 PreVisitChecklist Model

```typescript
// src/operations/models/pre-visit-checklist.ts

import mongoose, { Model } from 'mongoose';
import { IPreVisitChecklist } from '../types/pre-visit-checklist';
import { preVisitChecklistSchema } from '../schemas/pre-visit-checklist';

const PreVisitChecklistModel: Model<IPreVisitChecklist> =
  mongoose.model<IPreVisitChecklist>('PreVisitChecklist', preVisitChecklistSchema);

export default PreVisitChecklistModel;
```

### 5.4 WorkOrderEvent Model

```typescript
// src/operations/models/work-order-event.ts

import mongoose, { Model } from 'mongoose';
import { IWorkOrderEvent } from '../types/work-order-event';
import { workOrderEventSchema } from '../schemas/work-order-event';

const WorkOrderEventModel: Model<IWorkOrderEvent> =
  mongoose.model<IWorkOrderEvent>('WorkOrderEvent', workOrderEventSchema);

export default WorkOrderEventModel;
```

### 5.5 VisitReport Model

```typescript
// src/operations/models/visit-report.ts

import mongoose, { Model } from 'mongoose';
import { IVisitReport } from '../types/visit-report';
import { visitReportSchema } from '../schemas/visit-report';

const VisitReportModel: Model<IVisitReport> =
  mongoose.model<IVisitReport>('VisitReport', visitReportSchema);

export default VisitReportModel;
```

### 5.6 Models Barrel (`src/operations/models/index.ts`)

```typescript
export { default as WorkOrderModel } from './work-order';
export { default as WorkOrderAssignmentModel } from './work-order-assignment';
export { default as PreVisitChecklistModel } from './pre-visit-checklist';
export { default as WorkOrderEventModel } from './work-order-event';
export { default as VisitReportModel } from './visit-report';
```

### 5.7 Module Barrel (`src/operations/index.ts`)

```typescript
export * from './types';
export * from './schemas';
export * from './models';
```

---

## 6. Index Specifications

### 6.1 WorkOrder Indexes

| # | Index | Properties | Purpose |
|---|---|---|---|
| 1 | `{ tenantId: 1, status: 1, scheduledDate: -1 }` | Non-unique | Main operational filter: list WO by tenant + status + date |
| 2 | `{ tenantId: 1, workOrderNumber: 1 }` | **Unique** | Exact lookup by auto-generated work order number |
| 3 | `{ tenantId: 1, clientId: 1, status: 1 }` | Non-unique | Client history of work orders |
| 4 | `{ tenantId: 1, assignedTechnicians: 1, status: 1 }` | Non-unique | Technician workload: active orders per tech |
| 5 | `{ tenantId: 1, scheduledDate: 1, status: 1 }` | Non-unique | Daily agenda filter (scheduled + confirmed + assigned + en_route) |
| 6 | `{ tenantId: 1, deletedAt: 1 }` | Non-unique | Global soft-delete filter for admin queries |
| 7 | `{ tenantId: 1, priority: 1, status: 1, scheduledDate: -1 }` | Non-unique | Dispatch queue: sort by priority then date |

### 6.2 WorkOrderAssignment Indexes

| # | Index | Properties | Purpose |
|---|---|---|---|
| 1 | `{ tenantId: 1, workOrderId: 1, technicianId: 1 }` | **Unique** | One active assignment per technician + work order |
| 2 | `{ tenantId: 1, technicianId: 1, status: 1 }` | Non-unique | Technician workload history and current assignments |
| 3 | `{ tenantId: 1, workOrderId: 1, status: 1 }` | Non-unique | Current assignments per work order |

### 6.3 PreVisitChecklist Indexes

| # | Index | Properties | Purpose |
|---|---|---|---|
| 1 | `{ tenantId: 1, workOrderId: 1 }` | **Unique** | Enforce one checklist per work order |

### 6.4 WorkOrderEvent Indexes

| # | Index | Properties | Purpose |
|---|---|---|---|
| 1 | `{ tenantId: 1, workOrderId: 1, createdAt: -1 }` | Non-unique | Timeline cursor pagination per work order |
| 2 | `{ tenantId: 1, eventType: 1, createdAt: -1 }` | Non-unique | Event type analytics and filtering |

### 6.5 VisitReport Indexes

| # | Index | Properties | Purpose |
|---|---|---|---|
| 1 | `{ tenantId: 1, workOrderId: 1 }` | **Unique** | One report per work order |
| 2 | `{ tenantId: 1, technicianId: 1, createdAt: -1 }` | Non-unique | Technician report history |

---

## 7. State Machine Specification

### 7.1 State Diagram

```
draft ──► scheduled ──► confirmed ──► assigned ──► en_route ──► on_site ──► completed ──► closed
  │          │              │             │             │        │  │            │
  │          │              │             │             │        │  │            │
  └──────────┴──────────────┴─────────────┴─────────────┴────────┴──┴────────────┘
                                    │
                              ┌─────┴──────┐
                              │  paused     │
                              │ (desde      │
                              │  on_site)   │
                              └─────┬──────┘
                                    │
                              resume ──► on_site

cancelled: desde cualquier estado excepto closed (terminal)
closed: terminal, no reapertura
```

### 7.2 Valid Transitions Table

| Current Status | Allowed Transitions |
|---|---|
| `draft` | `scheduled`, `cancelled` |
| `scheduled` | `confirmed`, `assigned`, `cancelled` |
| `confirmed` | `assigned`, `cancelled` |
| `assigned` | `en_route` (requires checklist complete), `cancelled` |
| `en_route` | `on_site`, `cancelled` |
| `on_site` | `paused`, `completed`, `cancelled` |
| `paused` | `on_site` (resume), `cancelled` |
| `completed` | `closed` |
| `cancelled` | — (terminal) |
| `closed` | — (terminal) |

### 7.3 Transition Guards

| Transition | Guard / Precondition |
|---|---|
| `draft → scheduled` | Validate `scheduledDate`, `scheduledStart`, `scheduledEnd` are set and not in the past with tolerance |
| `draft → cancelled` | No guard |
| `scheduled → confirmed` | No guard |
| `scheduled → assigned` | At least one technician in `assignedTechnicians` |
| `scheduled → cancelled` | No guard |
| `confirmed → assigned` | At least one technician in `assignedTechnicians` |
| `confirmed → cancelled` | No guard |
| `assigned → en_route` | **PreVisitChecklist must exist with ALL booleans = true** |
| `assigned → cancelled` | No guard |
| `en_route → on_site` | No guard |
| `en_route → cancelled` | No guard |
| `on_site → paused` | No guard |
| `on_site → completed` | **VisitReport must exist** |
| `on_site → cancelled` | No guard |
| `paused → on_site` | No guard (resume) |
| `paused → cancelled` | No guard |
| `completed → closed` | No guard. **Irreversible.** |
| `cancelled → *` | No transitions allowed (terminal) |
| `closed → *` | No transitions allowed (terminal) |

---

## 8. Snapshot Field Specifications

### 8.1 Purpose

Snapshots preserve the state of related entities (Client, Location, Equipment) at the exact moment a WorkOrder is created. This ensures historical accuracy even if the referenced entities are later updated or soft-deleted.

### 8.2 clientSnapshot

Captured from `IClient` at WorkOrder creation time:

| Snapshot Field | Source Field | Type | Notes |
|---|---|---|---|
| `name` | `fullName` or `companyName` | `string` | Prefer `companyName` if customerType is `commercial` or `industrial`; else `fullName` |
| `email` | `email` | `string` | |
| `phone` | `phone` | `string` | |
| `taxId` | `taxId` | `string` | |
| `customerType` | `customerType` | `string` | `residential \| commercial \| industrial` |
| `status` | `status` | `string` | `prospect \| active \| inactive \| blacklisted` |

### 8.3 locationSnapshot

Captured from `ILocation` at WorkOrder creation time:

| Snapshot Field | Source Field | Type | Notes |
|---|---|---|---|
| `name` | `name` | `string` | |
| `address` | `address` | `string` | |
| `city` | `city` | `string` | |
| `province` | `province` | `string` | |
| `country` | `country` | `string` | |
| `postalCode` | `postalCode` | `string` | Optional |

### 8.4 equipmentSnapshot

Captured from `IEquipment` at WorkOrder creation time. Set to `null` if no `equipmentId` is provided.

| Snapshot Field | Source Field | Type | Notes |
|---|---|---|---|
| `equipmentType` | `equipmentType` | `string` | `split \| multisplit \| boiler \| chiller \| rooftop \| industrial` |
| `brand` | `brand` | `string` | Optional |
| `model` | `model` | `string` | Optional |
| `serialNumber` | `serialNumber` | `string` | Optional |
| `status` | `status` | `string` | `active \| inactive \| under_repair \| retired` |

### 8.5 Snapshot Lifecycle

- **Creation**: Snapshots are populated at WorkOrder creation time by reading the current state of the referenced documents. This is a service-layer responsibility.
- **Read-only**: Snapshots are NEVER updated after creation. They are historical records.
- **No cascade**: Changes to Client, Location, or Equipment do NOT propagate to existing WorkOrder snapshots.

---

## 9. Business Rules and Integrity Rules

### 9.1 Business Rules

#### BR-1: Work Order Number Auto-generation

Format: `WO-{TENANTPREFIX}-{YYYYMMDD}-{XXXX}`

- `TENANTPREFIX`: Short alphanumeric prefix from the Tenant entity (e.g., "ACME").
- `YYYYMMDD`: Current date at creation time.
- `XXXX`: Zero-padded sequential counter (resets daily per tenant).
- Generation is a service-layer responsibility, not schema-level.
- Must be unique per tenant (enforced by unique compound index `{ tenantId, workOrderNumber }`).

#### BR-2: Scheduling Conflict Detection

- Same technician cannot have two WorkOrders with overlapping `scheduledStart` / `scheduledEnd` ranges.
- Validation runs on:
  - WorkOrder creation (when `scheduledDate`, `scheduledStart`, `scheduledEnd` are set)
  - WorkOrder reschedule (when `scheduledDate`, `scheduledStart`, or `scheduledEnd` change)
  - Technician assignment (when a new technician is added to `assignedTechnicians`)
- Conflict query pattern:

```typescript
const conflict = await WorkOrderModel.findOne({
  _id: { $ne: currentWorkOrderId },
  tenantId,
  assignedTechnicians: technicianId,
  scheduledDate: requestedDate,
  scheduledStart: { $lt: requestedEnd },
  scheduledEnd: { $gt: requestedStart },
  deletedAt: null,
  status: { $nin: ['cancelled', 'closed'] },
});
```

- This applies to both single and multi-technician assignments.
- Multiple technicians per order are allowed; each is validated independently.

#### BR-3: Checklist Completion Requirement

- Transition `assigned → en_route` is BLOCKED if `PreVisitChecklist` does not exist or if ANY of the six boolean fields is `false`.
- A checklist is considered "complete" ONLY when ALL six booleans are `true`:
  - `workOrderReviewed`
  - `toolsPrepared`
  - `partsAvailable`
  - `routeConfirmed`
  - `vehicleAssigned`
  - `safetyEquipmentChecked`

#### BR-4: VisitReport Requirement for Completion

- Transition `on_site → completed` requires a `VisitReport` to exist for the WorkOrder.
- The VisitReport must have at minimum `arrivalTime`, `departureTime`, and `workPerformed` populated.

#### BR-5: Technician Reassignment Protocol

- When replacing a technician:
  1. Create a new `WorkOrderAssignment` document with `status: 'assigned'`.
  2. Mark the previous assignment as `status: 'replaced'` and set `replacedAt` and `replacedByAssignmentId`.
  3. The parent WorkOrder stays at its current status — reassignment does NOT trigger a status transition.

#### BR-6: Delete Restriction

- Soft-delete (`deletedAt` set, `deletedBy` set) on WorkOrder is ONLY allowed when:
  1. Status is `draft` OR `cancelled`, AND
  2. No `VisitReport` exists for this WorkOrder, AND
  3. No `WorkOrderEvent` exists for this WorkOrder.
- If operational evidence exists (VisitReport or WorkOrderEvent), the order must transition to `cancelled` or `closed` instead of being deleted.
- This is enforced at the service layer.

#### BR-7: Historical Evidence via Snapshots

- At WorkOrder creation time, the service layer MUST populate `clientSnapshot`, `locationSnapshot`, and optionally `equipmentSnapshot`.
- These snapshots are never modified after creation.
- They serve as historical evidence of the entity state when the WorkOrder was created.

#### BR-8: Closed is Irreversible

- `completed → closed` is the final transition.
- No reopening or reversing from `closed` status.
- No state transitions are allowed from `closed`.

#### BR-9: No State Regression

- Except for the natural resume (`paused → on_site`), it is NEVER valid to move to a previous state in the state machine.
- Example: `on_site → assigned` is forbidden.
- This is enforced by the state machine transition table.

#### BR-10: VisitReport Replaces Signature Fields (Future)

- `customerSignature`, `customerName`, and `signedAt` are declared in the VisitReport type and schema but are **NOT implemented** in this phase.
- They remain as `String` / `Date` fields to avoid breaking schema changes when digital signature is implemented later.
- No validation, no business logic, and no UI for these fields in this phase.

### 9.2 Integrity Rules Summary

| Rule | Description | Scope | Enforced At |
|---|---|---|---|
| IR-1 | Checklist required for `assigned → en_route` | WorkOrder status | Service layer |
| IR-2 | No state regression (except `paused → on_site`) | WorkOrder status | Service layer / state machine |
| IR-3 | Reassignment: create new, mark old as `replaced` | WorkOrderAssignment | Service layer |
| IR-4 | Soft-delete only if `draft`/`cancelled` AND no evidence | WorkOrder | Service layer |
| IR-5 | VisitReport required for `on_site → completed` | WorkOrder + VisitReport | Service layer |
| IR-6 | Closed is irreversible | WorkOrder status | Service layer / state machine |
| IR-7 | No scheduling conflicts per technician | WorkOrder + Technician | Service layer |
| IR-8 | Snapshots immutable after creation | WorkOrder | Service layer |
| IR-9 | WorkOrderEvent is append-only (no update, no delete) | WorkOrderEvent | Service layer |
| IR-10 | All six checklist booleans must be `true` for "complete" | PreVisitChecklist | Service layer |

---

## 10. Relationship Specifications

### 10.1 Entity Relationship Diagram

```
src/operations/                          src/crm/ + src/core/
─────────────────                       ────────────────────
                                        ┌──────────┐
  ┌────────────────────────────┐     ───│  Client   │
  │        WorkOrder            │   /   └──────────┘
  │                             │  /
  │  clientId ──────────────────┤─    ┌──────────┐
  │  locationId ────────────────┤───  │ Location  │
  │  equipmentId ───────────────┤──   └──────────┘
  │  assignedTechnicians[] ─────┤──┐  ┌──────────┐
  └───────────┬─────────────────┘  └──│  User     │
              │                       └──────────┘
              │ 1:1
              ▼                       ┌──────────┐
  ┌──────────────────────┐      ──────│Equipment  │
  │  PreVisitChecklist    │           └──────────┘
  │  workOrderId (unique) │
  └──────────────────────┘             ┌──────────┐
              │                   ────│Attachment │
              │ 1:N                  └──────────┘
              ▼
  ┌──────────────────────┐
  │  WorkOrderEvent       │
  │  workOrderId          │
  └──────────────────────┘
              │
              │ 1:N
              ▼
  ┌──────────────────────┐
  │ WorkOrderAssignment   │
  │  workOrderId          │
  │  technicianId ────────┤───┐
  └──────────────────────┘   │
              │              │
              │ 1:1          │
              ▼              │
  ┌──────────────────────┐   │
  │    VisitReport        │   │
  │  workOrderId (unique) │   │
  │  technicianId ────────┤───┘
  └──────────────────────┘
```

### 10.2 Cross-Module References

| Entity (Operations) | Field | References | Module | Cardinality | Required |
|---|---|---|---|---|---|
| WorkOrder | `clientId` | `Client._id` | `crm` | N:1 | Yes |
| WorkOrder | `locationId` | `Location._id` | `crm` | N:1 | Yes |
| WorkOrder | `equipmentId` | `Equipment._id` | `crm` | N:1 | No (default null) |
| WorkOrder | `assignedTechnicians[]` | `User._id` | `core` | N:M | No (default []) |
| WorkOrderAssignment | `technicianId` | `User._id` | `core` | N:1 | Yes |
| PreVisitChecklist | `workOrderId` | `WorkOrder._id` | `operations` | 1:1 | Yes |
| WorkOrderEvent | `workOrderId` | `WorkOrder._id` | `operations` | N:1 | Yes |
| VisitReport | `workOrderId` | `WorkOrder._id` | `operations` | 1:1 | Yes |
| VisitReport | `technicianId` | `User._id` | `core` | N:1 | Yes |
| Attachment | `entityType="workOrder"` + `entityId` | `WorkOrder._id` | `crm` | N:1 (polymorphic) | Yes |

### 10.3 Internal Operations Relationships

| Source | Field | Target | Cardinality | Notes |
|---|---|---|---|---|
| WorkOrderAssignment | `workOrderId` | `WorkOrder._id` | N:1 | Assignment history per WO |
| WorkOrderAssignment | `replacedByAssignmentId` | `WorkOrderAssignment._id` | 1:1 (optional) | Self-reference for replacement chain |

### 10.4 Cascade and Delete Behavior

| Operation | Effect |
|---|---|
| WorkOrder soft-delete | No cascade to Assignment/Event/Checklist/Report. Those entities become orphans (queried by status instead). |
| WorkOrder hard-delete | NOT allowed per business rules (only soft-delete). |
| User (technician) delete | WorkOrder keeps `assignedTechnicians` reference (denormalized). WorkOrderAssignment keeps reference. Service layer should handle gracefully. |
| Client delete | WorkOrder keeps `clientId` reference + `clientSnapshot` for history. No cascade. |
| Location delete | WorkOrder keeps `locationId` reference + `locationSnapshot`. No cascade. |
| Equipment delete | WorkOrder keeps `equipmentId` reference + `equipmentSnapshot`. No cascade. |

---

## 11. Risk Review

### 11.1 Scalability Risks

| Risk | Severity | Detail | Mitigation |
|---|---|---|---|
| **WorkOrderEvent volume growth** | Medium | Each status transition, assignment, and action generates an event. A high-volume tenant could accumulate millions of events per WO. | (1) Compound index `{ tenantId, workOrderId, createdAt }` supports cursor pagination without collection scans. (2) Append-only design avoids update locks. (3) Future: TTL index or archival strategy for events older than N months. |
| **Dispatch queue query performance** | Low-Medium | The dispatch queue index `{ tenantId, priority, status, scheduledDate }` is a compound index that covers the most common sorting scenario. However, if "all statuses" are queried without a status filter, the index is less effective. | Service layer MUST always include `status` in dispatch queries. API design should default to non-terminal statuses. |
| **Scheduling conflict detection on every assignment** | Medium | Conflict detection requires a query against the WorkOrder collection. On large tenants (100K+ WO), this query could be slow if not indexed properly. | Covered by the existing index `{ tenantId, assignedTechnicians, status }`. Additionally, filter by `deletedAt: null` and non-terminal statuses. |
| **Snapshot data duplication** | Low | Storing full client/location/equipment snapshots inside each WorkOrder duplicates data. A tenant with 500K WO and 50K clients stores redundant data. | Tradeoff accepted by design. Snapshots are small ( < 1KB each) and prevent N+1 queries for historical context. Estimated storage overhead: ~500MB per 500K WO. |

### 11.2 Concurrency Risks

| Risk | Severity | Detail | Mitigation |
|---|---|---|---|
| **Race condition on status transitions** | High | Two concurrent requests could both read the same current status and attempt to transition to different next states. E.g., two dispatchers both try to assign the same WO simultaneously. | Use **optimistic concurrency via `findOneAndUpdate` with status filter**: `WorkOrder.findOneAndUpdate({ _id, status: 'assigned' }, { status: 'en_route' })`. If `matchedCount === 0`, the status has already changed and the request must retry or fail with a conflict error. |
| **Double assignment of same technician** | Medium | Two transactions could both try to assign the same technician to the same WO concurrently, bypassing the unique index check. | The unique compound index `{ workOrderId, technicianId }` on WorkOrderAssignment acts as a last-line defense. However, the WorkOrder's `assignedTechnicians` array is not uniquely constrained. Service-layer validation + MongoDB atomic `$addToSet` mitigates this. |
| **Checklist completion race** | Low-Medium | Two technicians could both try to complete the checklist simultaneously. | Unique index on `{ workOrderId }` prevents duplicate PreVisitChecklist documents. Use `findOneAndUpdate` with `upsert` on the checklist. |
| **VisitReport creation race** | Low | Two technicians could try to create a VisitReport simultaneously. | Unique index `{ workOrderId }` on VisitReport prevents duplicates. |

### 11.3 Consistency Risks

| Risk | Severity | Detail | Mitigation |
|---|---|---|---|
| **WorkOrder.assignedTechnicians vs WorkOrderAssignment desync** | Medium | The `assignedTechnicians` array on WorkOrder is denormalized for fast queries. If an assignment is replaced or declined, the array could become stale. | Service MUST update `assignedTechnicians` atomically whenever an assignment changes status to `replaced` or `declined` (using `$pull`). All mutation must go through the service layer. |
| **Snapshot not matching referenced entity** | Low | Snapshots are captured at creation time. If the referenced Client is updated 1 second after WO creation, the snapshot is already "outdated" relative to the current entity state. | This is **by design**. The snapshot represents the state at creation time, not current state. Intentional for historical accuracy. |
| **Soft-delete vs active work orders** | Low | Soft-deleted WOs are filtered by `deletedAt: null` in all queries. If a service forgets this filter, deleted WOs appear in results. | Tenant scope helper (`findByTenant`) from Phase 1 already includes `{ deletedAt: null }`. All services should use this pattern. |
| **workOrderNumber uniqueness** | Low | Generated at service layer, not by a DB sequence. If two WOs are created simultaneously, they could get the same number. | Use a **MongoDB atomic counter** (findOneAndUpdate with `$inc`) per tenant per day, or a distributed ID generator. The unique index `{ tenantId, workOrderNumber }` provides a last-line defense. |

### 11.4 Risk Mitigation Summary Matrix

| Risk | Mitigation Strategy | Effectiveness |
|---|---|---|
| Race condition on status transitions | `findOneAndUpdate` with `{ _id, status: current }` filter | High |
| Scheduling conflict | Pre-validation query + compound index | High |
| Double assignment | Unique compound index + `$addToSet` | High |
| WorkOrderEvent volume | Cursor pagination + compound index | Medium |
| Snapshot storage overhead | Acceptable tradeoff (~1KB per WO) | Low risk |
| workOrderNumber collision | Atomic counter + unique index | High |

---

> **End of SDD Spec: Fase 3 — Operaciones**
>
> Proximo paso: SDD Design con decisiones de implementacion detalladas.
