# SDD Design: Fase 5 — Cotizaciones Comerciales (Quotes)

> **Change name**: `fase-5-quotes`
> **Estado**: Design (v1.0.0)
> **Basado en**: Spec `documentacion/sdd/sdd-fase5-quotes-spec.md`
> **Topic key**: `sdd/fase-5-quotes/design`

---

## Tabla de Contenidos

1. [Tipos (Types)](#1-tipos-types)
2. [Schemas Mongoose](#2-schemas-mongoose)
3. [Modelos](#3-modelos)
4. [State Machine](#4-state-machine)
5. [Counter](#5-counter)
6. [Calculator](#6-calculator)
7. [QuoteService](#7-quoteservice)
8. [ConversionService](#8-conversionservice)
9. [API Routes](#9-api-routes)
10. [Permisos](#10-permisos)
11. [Archivos del Módulo](#11-archivos-del-módulo)
12. [Secuencias de Flujo](#12-secuencias-de-flujo)

---

## 1. Tipos (Types)

### 1.1 `src/quotes/types/quote.ts`

```typescript
import { Document, Types } from 'mongoose';

export type QuoteStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'expired' | 'cancelled';

export interface IQuote extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  clientId: Types.ObjectId;
  locationId: Types.ObjectId | null;
  number: string;
  status: QuoteStatus;
  currentVersion: number;
  title: string;
  description?: string;
  validUntil: Date | null;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  notes?: string;
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

export interface CreateQuoteInput {
  clientId: string;
  locationId?: string;
  validUntil?: string;
  title: string;
  description?: string;
  items: CreateQuoteItemInput[];
  discountAmount?: number;
  taxAmount?: number;
  notes?: string;
}

export interface UpdateQuoteInput {
  title?: string;
  description?: string;
  items?: CreateQuoteItemInput[];
  discountAmount?: number;
  taxAmount?: number;
  validUntil?: string;
  notes?: string;
  locationId?: string;
}
```

**Detalle de campos:**

| Campo | Tipo | Requerido | Default | Validaciones |
|---|---|---|---|---|
| `_id` | `Types.ObjectId` | Auto | Auto | — |
| `tenantId` | `Types.ObjectId` (ref Tenant) | Sí | — | Inmutable post-creación |
| `clientId` | `Types.ObjectId` (ref Client) | Sí | — | — |
| `locationId` | `Types.ObjectId` (ref Location) | No | `null` | — |
| `number` | `string` | Sí (auto) | — | `{PREFIX}-{SEQUENTIAL}`, único por tenant, inmutable |
| `status` | `QuoteStatus` | Sí (auto) | `draft` | Enum 6 valores |
| `currentVersion` | `number` | Sí (auto) | `1` | >= 1, se auto-incrementa |
| `title` | `string` | Sí | — | Max 200 chars |
| `description` | `string` | No | — | Max 2000 chars |
| `validUntil` | `Date` | No | `createdAt + 30 días` | Debe ser futuro al enviar |
| `subtotal` | `number` | Sí (auto) | `0` | >= 0, calculado |
| `discountAmount` | `number` | No | `0` | >= 0 |
| `taxAmount` | `number` | No | `0` | >= 0 |
| `total` | `number` | Sí (auto) | `0` | >= 0, calculado |
| `notes` | `string` | No | — | Max 2000 chars |
| `sentAt` | `Date` | No | `null` | Se setea en draft → sent |
| `approvedAt` | `Date` | No | `null` | Se setea en sent → approved |
| `rejectedAt` | `Date` | No | `null` | Se setea en sent → rejected |
| `rejectedReason` | `string` | No | `null` | Max 500 chars |
| `convertedToWorkOrder` | `Types.ObjectId` (ref WorkOrder) | No | `null` | Se setea en conversión |
| `convertedAt` | `Date` | No | `null` | Se setea en conversión |
| `createdBy` | `Types.ObjectId` (ref User) | Sí | — | Inmutable post-creación |
| `updatedBy` | `Types.ObjectId` (ref User) | Sí | — | Se actualiza siempre |
| `deletedBy` | `Types.ObjectId` (ref User) | No | `null` | Se setea en soft-delete |
| `deletedAt` | `Date` | No | `null` | Se setea en soft-delete |

### 1.2 `src/quotes/types/quote-version.ts`

```typescript
import { Document, Types } from 'mongoose';

export type QuoteItemType = 'product' | 'service' | 'labor' | 'material' | 'part';

export interface IQuoteItem {
  description: string;
  type: QuoteItemType;
  quantity: number;
  unitPrice: number;
  subtotal: number;
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

**Detalle de campos — QuoteVersion:**

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
| `createdBy` | `Types.ObjectId` (ref User) | Sí | — | Inmutable |
| `createdAt` | `Date` | Auto | Auto | — |

**Detalle de campos — QuoteItem (subdocumento embebido):**

| Campo | Tipo | Requerido | Default | Validaciones |
|---|---|---|---|---|
| `description` | `string` | Sí | — | Max 500 chars |
| `type` | `QuoteItemType` | Sí | — | Enum: `product`, `service`, `labor`, `material`, `part` |
| `quantity` | `number` | Sí | — | > 0 |
| `unitPrice` | `number` | Sí | — | >= 0 |
| `subtotal` | `number` | Sí (auto) | — | `quantity * unitPrice` |

### 1.3 `src/quotes/types/index.ts`

```typescript
export type { QuoteStatus, IQuote, CreateQuoteInput, UpdateQuoteInput } from './quote';
export type { QuoteItemType, IQuoteItem, IQuoteVersion, CreateQuoteVersionInput, CreateQuoteItemInput } from './quote-version';
```

---

## 2. Schemas Mongoose

### 2.1 `src/quotes/schemas/quote.ts`

```typescript
import { Schema } from 'mongoose';
import { IQuote, QuoteStatus } from '../types/quote';

export const quoteSchema = new Schema<IQuote>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    locationId: { type: Schema.Types.ObjectId, ref: 'Location', default: null },
    number: { type: String, required: true },
    status: {
      type: String,
      enum: ['draft', 'sent', 'approved', 'rejected', 'expired', 'cancelled'] satisfies QuoteStatus[],
      required: true,
      default: 'draft',
    },
    currentVersion: { type: Number, required: true, default: 1, min: 1 },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },
    validUntil: { type: Date, default: null },
    subtotal: { type: Number, required: true, default: 0, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, default: 0, min: 0 },
    notes: { type: String, maxlength: 2000 },
    sentAt: { type: Date, default: null },
    approvedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    rejectedReason: { type: String, maxlength: 500 },
    convertedToWorkOrder: { type: Schema.Types.ObjectId, ref: 'WorkOrder', default: null },
    convertedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

quoteSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
quoteSchema.index({ tenantId: 1, number: 1 }, { unique: true });
quoteSchema.index({ tenantId: 1, clientId: 1, status: 1 });
quoteSchema.index({ tenantId: 1, createdBy: 1, status: 1 });
quoteSchema.index({ tenantId: 1, validUntil: 1, status: 1 });
quoteSchema.index({ tenantId: 1, deletedAt: 1 });
quoteSchema.index(
  { tenantId: 1, convertedToWorkOrder: 1 },
  { sparse: true }
);
```

**Nota sobre índices:**

| # | Index | Propósito | Unique |
|---|---|---|---|
| 1 | `{ tenantId: 1, status: 1, createdAt: -1 }` | Listado principal por estado + fecha | No |
| 2 | `{ tenantId: 1, number: 1 }` | Unicidad del número generado por contador | **Sí** |
| 3 | `{ tenantId: 1, clientId: 1, status: 1 }` | Historial por cliente | No |
| 4 | `{ tenantId: 1, createdBy: 1, status: 1 }` | Quotes por creador | No |
| 5 | `{ tenantId: 1, validUntil: 1, status: 1 }` | Batch de expiración | No |
| 6 | `{ tenantId: 1, deletedAt: 1 }` | Filtro de soft-delete | No |
| 7 | `{ tenantId: 1, convertedToWorkOrder: 1 }` sparse | Quotes convertidas (solo docs con valor) | No |

### 2.2 `src/quotes/schemas/quote-version.ts`

```typescript
import { Schema } from 'mongoose';
import { IQuoteVersion, QuoteItemType } from '../types/quote-version';

const quoteItemSchema = new Schema(
  {
    description: { type: String, required: true, maxlength: 500 },
    type: {
      type: String,
      enum: ['product', 'service', 'labor', 'material', 'part'] satisfies QuoteItemType[],
      required: true,
    },
    quantity: { type: Number, required: true, min: 0, validate: (v: number) => v > 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

export const quoteVersionSchema = new Schema<IQuoteVersion>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    quoteId: { type: Schema.Types.ObjectId, ref: 'Quote', required: true },
    version: { type: Number, required: true, min: 1 },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },
    items: { type: [quoteItemSchema], required: true, default: [] },
    subtotal: { type: Number, required: true, default: 0, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, default: 0, min: 0 },
    notes: { type: String, maxlength: 2000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

quoteVersionSchema.index({ tenantId: 1, quoteId: 1, version: -1 });
quoteVersionSchema.index({ tenantId: 1, quoteId: 1 });
```

**Nota:** QuoteVersion usa `timestamps: { createdAt: true, updatedAt: false }` porque es inmutable — nunca se actualiza.

### 2.3 `src/quotes/schemas/index.ts`

```typescript
export { quoteSchema } from './quote';
export { quoteVersionSchema } from './quote-version';
```

---

## 3. Modelos

### 3.1 `src/quotes/models/quote.ts`

```typescript
import mongoose, { Model } from 'mongoose';
import { IQuote } from '../types/quote';
import { quoteSchema } from '../schemas/quote';

const QuoteModel: Model<IQuote> = mongoose.model<IQuote>('Quote', quoteSchema);

export default QuoteModel;
```

### 3.2 `src/quotes/models/quote-version.ts`

```typescript
import mongoose, { Model } from 'mongoose';
import { IQuoteVersion } from '../types/quote-version';
import { quoteVersionSchema } from '../schemas/quote-version';

const QuoteVersionModel: Model<IQuoteVersion> = mongoose.model<IQuoteVersion>(
  'QuoteVersion',
  quoteVersionSchema
);

export default QuoteVersionModel;
```

### 3.3 `src/quotes/models/index.ts`

```typescript
export { default as QuoteModel } from './quote';
export { default as QuoteVersionModel } from './quote-version';
```

---

## 4. State Machine

### 4.1 `src/quotes/helpers/state-machine.ts`

```typescript
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

export function canTransition(from: QuoteStatus, to: QuoteStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function validateTransition(from: QuoteStatus, to: QuoteStatus): void {
  if (from === to) {
    throw new TransitionError(
      `Auto-transición no permitida: ${from} → ${to}`,
      from, to,
      `La cotización ya está en estado '${from}'.`,
    );
  }
  if (!canTransition(from, to)) {
    throw new TransitionError(
      `Transición inválida: ${from} → ${to}`,
      from, to,
      `La transición de '${from}' a '${to}' no está permitida por la máquina de estados.`,
    );
  }
}

export function validateSendRequirements(quote: {
  items: unknown[];
  clientId: unknown;
  validUntil: Date | null;
}): void {
  const missing: string[] = [];
  if (!quote.items?.length) missing.push('items');
  if (!quote.clientId) missing.push('clientId');
  if (quote.validUntil && quote.validUntil <= new Date()) {
    missing.push('validUntil no vencido');
  }
  if (missing.length > 0) {
    throw new TransitionError(
      `Campos requeridos faltantes: ${missing.join(', ')}`,
      'draft', 'sent',
      `Se requiere ${missing.join(', ')} para enviar la cotización.`,
    );
  }
}

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

### 4.2 Tabla de Transiciones

| From | To | Guard | Implementación |
|---|---|---|---|
| `draft` | `sent` | `items.length > 0` AND `clientId` presente AND (`validUntil` null o futuro) | `validateSendRequirements()` |
| `draft` | `cancelled` | Ninguna | `canTransition()` + `validateTransition()` |
| `sent` | `approved` | `validUntil` null o futuro | `validateApproveRequirements()` |
| `sent` | `rejected` | Ninguna (razón opcional) | `validateTransition()` |
| `sent` | `expired` | `validUntil` pasado — solo batch | `validateTransition()` + guard batch |
| `sent` | `cancelled` | Ninguna | `validateTransition()` |
| `approved` | — | Terminal | `VALID_TRANSITIONS['approved']` = `[]` |
| `rejected` | — | Terminal | `VALID_TRANSITIONS['rejected']` = `[]` |
| `expired` | — | Terminal | `VALID_TRANSITIONS['expired']` = `[]` |
| `cancelled` | — | Terminal | `VALID_TRANSITIONS['cancelled']` = `[]` |

### 4.3 Protección contra Race Conditions

Todas las transiciones de estado se ejecutan con `findOneAndUpdate` usando filtro del estado actual:

```typescript
const updated = await QuoteModel.findOneAndUpdate(
  {
    _id: quoteId,
    tenantId: tenantId,
    status: currentStatus,  // ← filtro crítico
    deletedAt: null,
  },
  { $set: { status: newStatus, ...timestamps } },
  { new: true }
);

if (!updated) {
  throw new ConflictError(
    currentStatus
      ? `La cotización ya fue modificada por otro usuario (estado actual no es '${currentStatus}')`
      : 'Cotización no encontrada o eliminada'
  );
}
```

---

## 5. Counter

### 5.1 `src/quotes/helpers/counter.ts`

```typescript
import { Schema, model, Model } from 'mongoose';

interface IQuoteCounter {
  _id: string;
  seq: number;
}

const quoteCounterSchema = new Schema<IQuoteCounter>({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, default: 0 },
});

const QuoteCounterModel: Model<IQuoteCounter> = model<IQuoteCounter>(
  'QuoteCounter',
  quoteCounterSchema
);

function getCounterId(prefix: string, tenantId: string): string {
  return `${prefix}-${tenantId}`;
}

/**
 * Genera el siguiente número de cotización atómicamente.
 * 
 * @param tenantId - ObjectId del tenant como string
 * @param prefix - Prefijo configurable (default: "COT")
 * @returns Número formateado ej: "COT-0001"
 */
export async function getNextQuoteNumber(
  tenantId: string,
  prefix: string = 'COT',
): Promise<string> {
  const counterId = getCounterId(prefix, tenantId);

  const result = await QuoteCounterModel.findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const seq = result.seq.toString().padStart(4, '0');
  return `${prefix}-${seq}`;
}
```

### 5.2 Diferencias con `src/operations/helpers/counter.ts`

| Aspecto | Operations Counter | Quotes Counter |
|---|---|---|
| Modelo | `WorkOrderCounter` | `QuoteCounter` |
| Clave | `WO-{tenantPrefix}-{YYYYMMDD}` | `{PREFIX}-{tenantId}` |
| Incluye fecha | Sí (reset diario) | No (contador perpetuo) |
| Prefijo configurable | No (fijo: `WO`) | Sí (vía `prefix` param, default `COT`) |
| Zero-padding | 4 dígitos | 4 dígitos |

### 5.3 Configuración del Prefijo en Tenant

Se agrega el campo `quoteNumberPrefix` al schema de Tenant:

```typescript
// En schema de Tenant (src/.../tenant.ts):
quoteNumberPrefix: { type: String, default: 'COT', trim: true }
```

El service de Quote lee este campo del documento Tenant antes de generar el número. Si no existe, usa `'COT'` como default.

---

## 6. Calculator

### 6.1 `src/quotes/helpers/calculator.ts`

```typescript
import { IQuoteItem, CreateQuoteItemInput } from '../types/quote-version';

/**
 * Calcula el subtotal de una lista de items (suma de quantity * unitPrice).
 */
export function calculateSubtotal(items: (IQuoteItem | CreateQuoteItemInput)[]): number {
  return items.reduce((sum, item) => {
    return sum + (item.quantity * item.unitPrice);
  }, 0);
}

/**
 * Calcula el total de una cotización.
 * Fórmula: subtotal - discountAmount + taxAmount
 */
export function calculateTotal(
  subtotal: number,
  discountAmount: number = 0,
  taxAmount: number = 0,
): number {
  return subtotal - discountAmount + taxAmount;
}

/**
 * Procesa items: calcula subtotal por item y retorna items completos.
 */
export function processItems(
  items: CreateQuoteItemInput[],
): IQuoteItem[] {
  return items.map((item) => ({
    description: item.description,
    type: item.type,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    subtotal: item.quantity * item.unitPrice,
  }));
}
```

### 6.2 Lógica de Cálculo

1. **Por item**: `subtotal = quantity * unitPrice` — se calcula en `processItems()`.
2. **Subtotal general**: `sum(item.subtotal)` — se calcula en `calculateSubtotal()`.
3. **Total**: `subtotal - discountAmount + taxAmount` — se calcula en `calculateTotal()`.
4. Todos los cálculos se ejecutan en `QuoteService` cada vez que se crea o actualiza contenido comercial.
5. Los valores se almacenan TANTO en `Quote` (valores actuales) como en `QuoteVersion` (snapshot al momento de creación de la versión).

---

## 7. QuoteService

### 7.1 `src/quotes/services/quote.service.ts`

#### 7.1.1 Errores Custom

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

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}
```

#### 7.1.2 Estructura de la Clase

```typescript
import mongoose, { Types } from 'mongoose';
import QuoteModel from '../models/quote';
import QuoteVersionModel from '../models/quote-version';
import { validateTransition, validateSendRequirements, validateApproveRequirements, TransitionError, TERMINAL_STATUSES } from '../helpers/state-machine';
import { getNextQuoteNumber } from '../helpers/counter';
import { calculateSubtotal, calculateTotal, processItems } from '../helpers/calculator';
import { logActivity } from '../../audit/activity-logger';
import { IQuote, QuoteStatus, CreateQuoteInput, UpdateQuoteInput } from '../types/quote';
import { IQuoteVersion, CreateQuoteItemInput } from '../types/quote-version';

export class QuoteService {
  // ... métodos
}
```

#### 7.1.3 Método: `createQuote`

```typescript
async createQuote(
  data: CreateQuoteInput,
  userId: string,
  tenantId: string,
): Promise<{ quote: IQuote; version: IQuoteVersion }> {
  // 1. Validar datos de entrada
  if (!data.clientId) throw new ValidationError('clientId es requerido');
  if (!data.items?.length) throw new ValidationError('Se requiere al menos un item');
  if (data.discountAmount && data.discountAmount < 0) throw new ValidationError('discountAmount no puede ser negativo');
  if (data.taxAmount && data.taxAmount < 0) throw new ValidationError('taxAmount no puede ser negativo');

  // 2. Obtener prefijo del tenant (desde Tenant.quoteNumberPrefix)
  const prefix = await this.getTenantQuotePrefix(tenantId); // "COT" por default

  // 3. Generar número secuencial
  const number = await getNextQuoteNumber(tenantId, prefix);

  // 4. Procesar items y calcular financieros
  const processedItems = processItems(data.items);
  const subtotal = calculateSubtotal(processedItems);
  const discountAmount = data.discountAmount ?? 0;
  const taxAmount = data.taxAmount ?? 0;
  const total = calculateTotal(subtotal, discountAmount, taxAmount);

  // 5. Calcular validUntil por defecto (+30 días)
  const validUntil = data.validUntil
    ? new Date(data.validUntil)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // 6. Crear Quote y QuoteVersion en transacción
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const [quote] = await QuoteModel.create([{
      tenantId: new Types.ObjectId(tenantId),
      clientId: new Types.ObjectId(data.clientId),
      locationId: data.locationId ? new Types.ObjectId(data.locationId) : null,
      number,
      status: 'draft',
      currentVersion: 1,
      title: data.title,
      description: data.description,
      validUntil,
      subtotal,
      discountAmount,
      taxAmount,
      total,
      notes: data.notes,
      createdBy: new Types.ObjectId(userId),
      updatedBy: new Types.ObjectId(userId),
    }], { session });

    const [version] = await QuoteVersionModel.create([{
      tenantId: new Types.ObjectId(tenantId),
      quoteId: quote._id,
      version: 1,
      title: data.title,
      description: data.description,
      items: processedItems,
      subtotal,
      discountAmount,
      taxAmount,
      total,
      notes: data.notes,
      createdBy: new Types.ObjectId(userId),
    }], { session });

    await session.commitTransaction();

    await logActivity({
      tenantId,
      entityType: 'quote',
      entityId: String(quote._id),
      action: 'created',
      actorId: userId,
      metadata: { number, version: 1 },
    });

    return {
      quote: quote.toObject() as unknown as IQuote,
      version: version.toObject() as unknown as IQuoteVersion,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
```

#### 7.1.4 Método: `getQuote`

```typescript
async getQuote(
  quoteId: string,
  tenantId: string,
): Promise<{ quote: IQuote; currentVersion: IQuoteVersion } | null> {
  const quote = await QuoteModel.findOne({
    _id: new Types.ObjectId(quoteId),
    tenantId: new Types.ObjectId(tenantId),
    deletedAt: null,
  }).lean().exec();

  if (!quote) return null;

  const version = await QuoteVersionModel.findOne({
    tenantId: new Types.ObjectId(tenantId),
    quoteId: quote._id,
    version: quote.currentVersion,
  }).lean().exec();

  if (!version) return null; // inconsistencia — no debería ocurrir

  return {
    quote: quote as unknown as IQuote,
    currentVersion: version as unknown as IQuoteVersion,
  };
}
```

#### 7.1.5 Método: `listQuotes`

```typescript
interface QuoteListFilters {
  status?: QuoteStatus;
  clientId?: string;
  createdBy?: string;
  createdAtGte?: string;
  createdAtLte?: string;
  includeDeleted?: boolean;
  page?: number;
  limit?: number;
  sort?: string;
}

interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: Record<string, unknown>;
}

async listQuotes(
  filters: QuoteListFilters,
  tenantId: string,
): Promise<PaginatedResult<IQuote>> {
  const filter: Record<string, unknown> = {
    tenantId: new Types.ObjectId(tenantId),
  };

  // Filtro de soft-delete: por defecto excluye eliminados
  if (!filters.includeDeleted) {
    filter.deletedAt = null;
  }

  if (filters.status) filter.status = filters.status;
  if (filters.clientId) filter.clientId = new Types.ObjectId(filters.clientId);
  if (filters.createdBy) filter.createdBy = new Types.ObjectId(filters.createdBy);

  if (filters.createdAtGte || filters.createdAtLte) {
    const dateFilter: Record<string, unknown> = {};
    if (filters.createdAtGte) dateFilter.$gte = new Date(filters.createdAtGte);
    if (filters.createdAtLte) dateFilter.$lte = new Date(filters.createdAtLte);
    filter.createdAt = dateFilter;
  }

  const page = filters.page || 1;
  const limit = Math.min(filters.limit || 20, 100);
  const skip = (page - 1) * limit;

  // Parse sort param — solo campos permitidos
  const sortFieldMap: Record<string, string> = {
    createdAt: 'createdAt',
    '-createdAt': '-createdAt',
    number: 'number',
    '-number': '-number',
    total: 'total',
    '-total': '-total',
  };
  const sortStr = filters.sort && sortFieldMap[filters.sort]
    ? filters.sort
    : '-createdAt';
  const sort: Record<string, 1 | -1> = {};
  sort[sortStr.replace(/^-/, '')] = sortStr.startsWith('-') ? -1 : 1;

  const [data, total] = await Promise.all([
    QuoteModel.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean()
      .exec(),
    QuoteModel.countDocuments(filter).exec(),
  ]);

  return {
    data: data as unknown as IQuote[],
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    filters: { ...filters },
  };
}
```

#### 7.1.6 Método: `updateQuote`

```typescript
async updateQuote(
  quoteId: string,
  data: UpdateQuoteInput,
  userId: string,
  tenantId: string,
): Promise<{ quote: IQuote; version?: IQuoteVersion; newVersion: boolean }> {
  // 1. Validar campos protegidos
  if ((data as Record<string, unknown>).status) {
    throw new ValidationError('Use el endpoint específico de estado para cambiar el status');
  }
  if ((data as Record<string, unknown>).number) {
    throw new ValidationError('El campo number no puede modificarse');
  }

  // 2. Obtener Quote actual
  const quote = await QuoteModel.findOne({
    _id: new Types.ObjectId(quoteId),
    tenantId: new Types.ObjectId(tenantId),
    deletedAt: null,
  }).exec();

  if (!quote) throw new NotFoundError('Cotización no encontrada');
  if (TERMINAL_STATUSES.includes(quote.status as QuoteStatus)) {
    throw new ValidationError(
      `No se puede modificar una cotización en estado '${quote.status}'`
    );
  }

  // 3. Determinar si los cambios son comerciales (requieren nueva versión)
  const commercialFields: (keyof UpdateQuoteInput)[] = [
    'title', 'description', 'items', 'discountAmount', 'taxAmount',
    'validUntil', 'notes',
  ];
  const hasCommercialChanges = commercialFields.some(
    (field) => field in data && data[field] !== undefined
  );

  const nonCommercialChanges: Record<string, unknown> = {};
  if (data.locationId !== undefined) {
    nonCommercialChanges.locationId = new Types.ObjectId(data.locationId);
  }

  // 4. Si hay cambios no comerciales, actualizar directamente
  if (Object.keys(nonCommercialChanges).length > 0) {
    Object.assign(quote, nonCommercialChanges);
  }

  // 5. Si hay cambios comerciales, crear nueva versión
  let newVersion: IQuoteVersion | undefined;
  let subtotal = quote.subtotal;
  let discountAmount = quote.discountAmount;
  let taxAmount = quote.taxAmount;
  let total = quote.total;

  if (hasCommercialChanges) {
    // Obtener versión actual como base
    const currentVersionDoc = await QuoteVersionModel.findOne({
      tenantId: new Types.ObjectId(tenantId),
      quoteId: quote._id,
      version: quote.currentVersion,
    }).lean().exec();

    if (!currentVersionDoc) throw new Error('Inconsistencia: versión actual no encontrada');

    // Construir datos de la nueva versión
    const newVersionNumber = quote.currentVersion + 1;
    const newTitle = data.title ?? currentVersionDoc.title;
    const newDescription = data.description ?? currentVersionDoc.description;
    const newNotes = data.notes ?? currentVersionDoc.notes;

    // Items: si se envían, usarlos; si no, copiar de versión anterior
    const itemsData = data.items
      ? processItems(data.items)
      : (currentVersionDoc.items as any[]).map(i => ({
          description: i.description,
          type: i.type,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          subtotal: i.subtotal,
        }));

    // Calcular financieros
    subtotal = calculateSubtotal(itemsData);
    discountAmount = data.discountAmount ?? currentVersionDoc.discountAmount ?? 0;
    taxAmount = data.taxAmount ?? currentVersionDoc.taxAmount ?? 0;
    total = calculateTotal(subtotal, discountAmount, taxAmount);

    // Aplicar validUntil si se envía
    if (data.validUntil) {
      quote.validUntil = new Date(data.validUntil);
    }

    // Crear la nueva versión en transacción
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      [newVersion] = await QuoteVersionModel.create([{
        tenantId: new Types.ObjectId(tenantId),
        quoteId: quote._id,
        version: newVersionNumber,
        title: newTitle,
        description: newDescription,
        items: itemsData,
        subtotal,
        discountAmount,
        taxAmount,
        total,
        notes: newNotes,
        createdBy: new Types.ObjectId(userId),
      }], { session });

      // Actualizar Quote
      quote.currentVersion = newVersionNumber;
      quote.title = newTitle;
      quote.description = newDescription ?? quote.description;
      quote.subtotal = subtotal;
      quote.discountAmount = discountAmount;
      quote.taxAmount = taxAmount;
      quote.total = total;
      quote.notes = newNotes ?? quote.notes;
      quote.updatedBy = new Types.ObjectId(userId);

      await quote.save({ session });

      await session.commitTransaction();

      await logActivity({
        tenantId,
        entityType: 'quote',
        entityId: quoteId,
        action: 'updated',
        actorId: userId,
        metadata: {
          version: newVersionNumber,
          changes: this.detectChanges(data),
        },
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } else {
    // Solo cambios no comerciales — actualizar sin transacción
    quote.updatedBy = new Types.ObjectId(userId);
    await quote.save();

    if (Object.keys(nonCommercialChanges).length > 0) {
      await logActivity({
        tenantId,
        entityType: 'quote',
        entityId: quoteId,
        action: 'updated',
        actorId: userId,
        metadata: { changes: Object.keys(nonCommercialChanges) },
      });
    }
  }

  return {
    quote: quote.toObject() as unknown as IQuote,
    version: newVersion ? (newVersion.toObject() as unknown as IQuoteVersion) : undefined,
    newVersion: hasCommercialChanges,
  };
}
```

#### 7.1.7 Método: `sendQuote` (draft → sent)

```typescript
async sendQuote(
  quoteId: string,
  userId: string,
  tenantId: string,
): Promise<IQuote> {
  const quote = await QuoteModel.findOne({
    _id: new Types.ObjectId(quoteId),
    tenantId: new Types.ObjectId(tenantId),
    deletedAt: null,
  }).lean().exec();

  if (!quote) throw new NotFoundError('Cotización no encontrada');

  const currentStatus = quote.status as QuoteStatus;
  validateTransition(currentStatus, 'sent');

  // Obtener versión actual para validar items
  const version = await QuoteVersionModel.findOne({
    tenantId: new Types.ObjectId(tenantId),
    quoteId: quote._id,
    version: quote.currentVersion,
  }).lean().exec();

  validateSendRequirements({
    items: version?.items || [],
    clientId: quote.clientId,
    validUntil: quote.validUntil,
  });

  const updated = await QuoteModel.findOneAndUpdate(
    {
      _id: new Types.ObjectId(quoteId),
      tenantId: new Types.ObjectId(tenantId),
      status: currentStatus,
      deletedAt: null,
    },
    {
      $set: { status: 'sent', sentAt: new Date(), updatedBy: new Types.ObjectId(userId) },
    },
    { new: true },
  ).lean().exec();

  if (!updated) {
    throw new ConflictError('La cotización ya fue modificada por otro usuario');
  }

  await logActivity({
    tenantId,
    entityType: 'quote',
    entityId: quoteId,
    action: 'updated',
    actorId: userId,
    metadata: { from: currentStatus, to: 'sent' },
  });

  return updated as unknown as IQuote;
}
```

#### 7.1.8 Método: `approveQuote` (sent → approved)

```typescript
async approveQuote(
  quoteId: string,
  userId: string,
  tenantId: string,
): Promise<IQuote> {
  const quote = await QuoteModel.findOne({
    _id: new Types.ObjectId(quoteId),
    tenantId: new Types.ObjectId(tenantId),
    deletedAt: null,
  }).lean().exec();

  if (!quote) throw new NotFoundError('Cotización no encontrada');

  const currentStatus = quote.status as QuoteStatus;
  validateTransition(currentStatus, 'approved');
  validateApproveRequirements({ validUntil: quote.validUntil });

  const updated = await QuoteModel.findOneAndUpdate(
    {
      _id: new Types.ObjectId(quoteId),
      tenantId: new Types.ObjectId(tenantId),
      status: currentStatus,
      deletedAt: null,
    },
    {
      $set: { status: 'approved', approvedAt: new Date(), updatedBy: new Types.ObjectId(userId) },
    },
    { new: true },
  ).lean().exec();

  if (!updated) {
    throw new ConflictError('La cotización ya fue modificada por otro usuario');
  }

  await logActivity({
    tenantId,
    entityType: 'quote',
    entityId: quoteId,
    action: 'updated',
    actorId: userId,
    metadata: { from: currentStatus, to: 'approved' },
  });

  return updated as unknown as IQuote;
}
```

#### 7.1.9 Método: `rejectQuote` (sent → rejected)

```typescript
async rejectQuote(
  quoteId: string,
  userId: string,
  tenantId: string,
  reason?: string,
): Promise<IQuote> {
  const quote = await QuoteModel.findOne({
    _id: new Types.ObjectId(quoteId),
    tenantId: new Types.ObjectId(tenantId),
    deletedAt: null,
  }).lean().exec();

  if (!quote) throw new NotFoundError('Cotización no encontrada');

  const currentStatus = quote.status as QuoteStatus;
  validateTransition(currentStatus, 'rejected');

  const updateFields: Record<string, unknown> = {
    status: 'rejected',
    rejectedAt: new Date(),
    updatedBy: new Types.ObjectId(userId),
  };
  if (reason) {
    updateFields.rejectedReason = reason;
  }

  const updated = await QuoteModel.findOneAndUpdate(
    {
      _id: new Types.ObjectId(quoteId),
      tenantId: new Types.ObjectId(tenantId),
      status: currentStatus,
      deletedAt: null,
    },
    { $set: updateFields },
    { new: true },
  ).lean().exec();

  if (!updated) {
    throw new ConflictError('La cotización ya fue modificada por otro usuario');
  }

  await logActivity({
    tenantId,
    entityType: 'quote',
    entityId: quoteId,
    action: 'updated',
    actorId: userId,
    metadata: { from: currentStatus, to: 'rejected', reason },
  });

  return updated as unknown as IQuote;
}
```

#### 7.1.10 Método: `cancelQuote` (draft/sent → cancelled)

```typescript
async cancelQuote(
  quoteId: string,
  userId: string,
  tenantId: string,
): Promise<IQuote> {
  const quote = await QuoteModel.findOne({
    _id: new Types.ObjectId(quoteId),
    tenantId: new Types.ObjectId(tenantId),
    deletedAt: null,
  }).lean().exec();

  if (!quote) throw new NotFoundError('Cotización no encontrada');

  const currentStatus = quote.status as QuoteStatus;
  validateTransition(currentStatus, 'cancelled');

  const updated = await QuoteModel.findOneAndUpdate(
    {
      _id: new Types.ObjectId(quoteId),
      tenantId: new Types.ObjectId(tenantId),
      status: currentStatus,
      deletedAt: null,
    },
    {
      $set: { status: 'cancelled', updatedBy: new Types.ObjectId(userId) },
    },
    { new: true },
  ).lean().exec();

  if (!updated) {
    throw new ConflictError('La cotización ya fue modificada por otro usuario');
  }

  await logActivity({
    tenantId,
    entityType: 'quote',
    entityId: quoteId,
    action: 'updated',
    actorId: userId,
    metadata: { from: currentStatus, to: 'cancelled' },
  });

  return updated as unknown as IQuote;
}
```

#### 7.1.11 Método: `expireBatch` (sent → expired)

```typescript
/**
 * Ejecutado por un job programado (cron/scheduler).
 * Marca como "expired" todas las Quotes en estado "sent"
 * cuyo validUntil es anterior a la fecha actual.
 * 
 * @returns Cantidad de quotes expiradas
 */
async expireBatch(
  tenantId: string,
  batchSize: number = 50,
): Promise<number> {
  const now = new Date();

  const result = await QuoteModel.updateMany(
    {
      tenantId: new Types.ObjectId(tenantId),
      status: 'sent',
      validUntil: { $lt: now, $ne: null },
      deletedAt: null,
    },
    {
      $set: { status: 'expired' },
    },
  ).exec();

  // Registrar actividad para cada quote expirada
  if (result.modifiedCount > 0) {
    const expiredQuotes = await QuoteModel.find({
      tenantId: new Types.ObjectId(tenantId),
      status: 'expired',
      validUntil: { $lt: now },
    }).lean().exec();

    // Logging asíncrono — no debe bloquear el batch
    for (const quote of expiredQuotes) {
      await logActivity({
        tenantId,
        entityType: 'quote',
        entityId: String(quote._id),
        action: 'updated',
        actorId: new Types.ObjectId('000000000000000000000000') as any, // system user
        metadata: { from: 'sent', to: 'expired', validUntil: quote.validUntil },
      }).catch(console.error);
    }
  }

  return result.modifiedCount;
}
```

#### 7.1.12 Método: `softDelete`

```typescript
async softDelete(
  quoteId: string,
  userId: string,
  tenantId: string,
): Promise<IQuote> {
  const quote = await QuoteModel.findOne({
    _id: new Types.ObjectId(quoteId),
    tenantId: new Types.ObjectId(tenantId),
    deletedAt: null,
  }).lean().exec();

  if (!quote) throw new NotFoundError('Cotización no encontrada');

  const status = quote.status as QuoteStatus;
  if (status !== 'draft' && status !== 'cancelled') {
    throw new ValidationError(
      `Solo se pueden eliminar cotizaciones en estado 'draft' o 'cancelled'. Estado actual: '${status}'`
    );
  }

  const updated = await QuoteModel.findOneAndUpdate(
    {
      _id: new Types.ObjectId(quoteId),
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    },
    {
      $set: {
        deletedAt: new Date(),
        deletedBy: new Types.ObjectId(userId),
      },
    },
    { new: true },
  ).lean().exec();

  if (!updated) throw new NotFoundError('Cotización no encontrada');

  await logActivity({
    tenantId,
    entityType: 'quote',
    entityId: quoteId,
    action: 'deleted',
    actorId: userId,
    metadata: { deletedBy: userId },
  });

  return updated as unknown as IQuote;
}
```

#### 7.1.13 Método auxiliar: `getTenantQuotePrefix`

```typescript
import TenantModel from '../../tenant/models/tenant'; // según estructura real

private async getTenantQuotePrefix(tenantId: string): Promise<string> {
  try {
    const tenant = await TenantModel.findById(tenantId)
      .select('quoteNumberPrefix')
      .lean()
      .exec();
    return (tenant as any)?.quoteNumberPrefix || 'COT';
  } catch {
    return 'COT';
  }
}
```

#### 7.1.14 Método auxiliar: `getVersions`

```typescript
async getVersions(
  quoteId: string,
  tenantId: string,
): Promise<{ data: IQuoteVersion[]; totalVersions: number; currentVersion: number }> {
  const quote = await QuoteModel.findOne({
    _id: new Types.ObjectId(quoteId),
    tenantId: new Types.ObjectId(tenantId),
    deletedAt: null,
  }).select('currentVersion').lean().exec();

  if (!quote) throw new NotFoundError('Cotización no encontrada');

  const versions = await QuoteVersionModel.find({
    tenantId: new Types.ObjectId(tenantId),
    quoteId: new Types.ObjectId(quoteId),
  })
    .sort({ version: -1 })
    .lean()
    .exec();

  return {
    data: versions as unknown as IQuoteVersion[],
    totalVersions: versions.length,
    currentVersion: quote.currentVersion,
  };
}
```

---

## 8. ConversionService

### 8.1 `src/quotes/services/conversion.service.ts`

```typescript
import mongoose, { Types } from 'mongoose';
import QuoteModel from '../models/quote';
import QuoteVersionModel from '../models/quote-version';
import WorkOrderModel from '../../operations/models/work-order';
import { logActivity } from '../../audit/activity-logger';
import { TERMINAL_STATUSES, canTransition } from '../helpers/state-machine';
import { getNextWorkOrderNumber } from '../../operations/helpers/counter';
import { IQuote } from '../types/quote';
import { IQuoteVersion } from '../types/quote-version';

export class ConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConversionError';
  }
}

/**
 * Construye la descripción de la WorkOrder a partir de la QuoteVersion.
 */
function buildWorkOrderDescription(quoteVersion: IQuoteVersion): string {
  const parts: string[] = [];

  if (quoteVersion.description) {
    parts.push(quoteVersion.description);
  }

  if (quoteVersion.items.length > 0) {
    parts.push('--- Items de la cotización ---');
    quoteVersion.items.forEach((item) => {
      parts.push(
        `- [${item.type}] ${item.description} x${item.quantity} @ $${item.unitPrice} = $${item.subtotal}`
      );
    });
    parts.push(`Subtotal: $${quoteVersion.subtotal}`);
    parts.push(`Total cotizado: $${quoteVersion.total}`);
  }

  if (quoteVersion.notes) {
    parts.push(`--- Notas ---\n${quoteVersion.notes}`);
  }

  return parts.join('\n');
}

export class ConversionService {
  async convertToWorkOrder(
    quoteId: string,
    userId: string,
    tenantId: string,
    options?: { priority?: string; category?: string },
  ): Promise<{ quote: IQuote; workOrder: Record<string, unknown> }> {
    // 1. Validar Quote
    const quote = await QuoteModel.findOne({
      _id: new Types.ObjectId(quoteId),
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    }).exec();

    if (!quote) {
      throw new ConversionError('Cotización no encontrada');
    }

    if (quote.status !== 'approved') {
      throw new ConversionError(
        `Solo cotizaciones en estado 'approved' pueden convertirse. Estado actual: '${quote.status}'`
      );
    }

    if (quote.convertedToWorkOrder) {
      throw new ConversionError('La cotización ya fue convertida a una Orden de Trabajo');
    }

    // 2. Obtener versión actual
    const currentVersion = await QuoteVersionModel.findOne({
      tenantId: new Types.ObjectId(tenantId),
      quoteId: quote._id,
      version: quote.currentVersion,
    }).lean().exec();

    if (!currentVersion) {
      throw new ConversionError('Inconsistencia: versión actual de cotización no encontrada');
    }

    // 3. Iniciar transacción
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 3a. Generar número de WorkOrder
      const workOrderNumber = await getNextWorkOrderNumber(String(quote.tenantId));

      // 3b. Obtener snapshots de Client y Location
      const clientSnapshot = await this.buildClientSnapshot(quote.clientId, session);
      const locationSnapshot = quote.locationId
        ? await this.buildLocationSnapshot(quote.locationId, session)
        : undefined;

      // 3c. Crear WorkOrder
      const [workOrder] = await WorkOrderModel.create([{
        tenantId: quote.tenantId,
        clientId: quote.clientId,
        locationId: quote.locationId,
        quoteId: quote._id,
        workOrderNumber,
        title: `${quote.number} v${quote.currentVersion}: ${currentVersion.title}`,
        description: buildWorkOrderDescription(currentVersion as unknown as IQuoteVersion),
        priority: options?.priority || 'normal',
        category: options?.category || 'installation',
        status: 'draft',
        clientSnapshot: clientSnapshot || {},
        locationSnapshot: locationSnapshot || {},
        equipmentSnapshot: null,
        createdBy: new Types.ObjectId(userId),
        updatedBy: new Types.ObjectId(userId),
      }], { session });

      // 3d. Actualizar Quote con marcas de conversión
      quote.convertedToWorkOrder = workOrder._id;
      quote.convertedAt = new Date();
      quote.updatedBy = new Types.ObjectId(userId);
      await quote.save({ session });

      // 3e. Registrar ActivityLog
      await logActivity({
        tenantId,
        entityType: 'quote',
        entityId: quoteId,
        action: 'updated',
        actorId: userId,
        metadata: {
          workOrderId: String(workOrder._id),
          workOrderNumber,
        },
      });

      await session.commitTransaction();

      return {
        quote: quote.toObject() as unknown as IQuote,
        workOrder: workOrder.toObject() as unknown as Record<string, unknown>,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  private async buildClientSnapshot(
    clientId: Types.ObjectId,
    session: mongoose.ClientSession,
  ): Promise<Record<string, unknown>> {
    const ClientModel = (await import('../../crm/models/client')).default;
    const client = await ClientModel.findById(clientId)
      .session(session)
      .lean()
      .exec();
    if (!client) return {};
    return {
      name: (client as any).fullName || (client as any).companyName,
      email: (client as any).email,
      phone: (client as any).phone,
      customerType: (client as any).customerType,
    };
  }

  private async buildLocationSnapshot(
    locationId: Types.ObjectId,
    session: mongoose.ClientSession,
  ): Promise<Record<string, unknown>> {
    const LocationModel = (await import('../../crm/models/location')).default;
    const location = await LocationModel.findById(locationId)
      .session(session)
      .lean()
      .exec();
    if (!location) return {};
    return {
      name: (location as any).name,
      address: (location as any).address,
      city: (location as any).city,
      province: (location as any).province,
      country: (location as any).country,
      postalCode: (location as any).postalCode,
    };
  }
}
```

### 8.2 Mapeo Quote → WorkOrder

| Origen (Quote) | Destino (WorkOrder) | Transformación |
|---|---|---|
| `quote.clientId` | `clientId` | Directo |
| `quote.locationId` | `locationId` | Directo (puede ser null) |
| `quote._id` | `quoteId` | Referencia a la Quote origen |
| `quote.number` + `quote.currentVersion` + `quote.title` | `title` | `"{number} v{version}: {title}"` |
| `currentVersion.description` + items + notes | `description` | `buildWorkOrderDescription()` genera resumen |
| — | `priority` | Del request o `"normal"` default |
| — | `category` | Del request o `"installation"` default |
| — | `status` | Siempre `"draft"` |
| Client actual | `clientSnapshot` | Snapshot al momento de conversión |
| Location actual | `locationSnapshot` | Snapshot al momento de conversión |
| — | `equipmentSnapshot` | `null` (no se crean equipos) |

### 8.3 Lo que NO ocurre en la conversión

| Comportamiento | Excluido | Razón |
|---|---|---|
| Creación de equipos (Equipment) | ❌ No se crea | Los items comerciales no equivalen a activos físicos |
| Copia de items como operaciones separadas | ❌ No se copian | Se incluyen como texto en description |
| Cambio de estado de Quote | ❌ Quote sigue en approved | `approved` es terminal |
| Eliminación de QuoteVersion | ❌ Se preserva | El historial de versiones es inmutable |

### 8.4 Modificaciones Requeridas en WorkOrder

Se debe agregar el campo `quoteId` a WorkOrder type y schema:

```typescript
// En src/operations/types/work-order.ts:
quoteId?: Types.ObjectId;

// En src/operations/schemas/work-order.ts:
quoteId: { type: Schema.Types.ObjectId, ref: 'Quote', default: null },
```

---

## 9. API Routes

### 9.1 Estructura de Rutas

```
src/app/api/crm/quotes/
├── route.ts                          # GET (list), POST (create)
├── [id]/
│   ├── route.ts                      # GET (get), PATCH (update), DELETE (soft delete)
│   ├── send/route.ts                 # POST (draft → sent)
│   ├── approve/route.ts              # POST (sent → approved)
│   ├── status/route.ts               # PATCH (→ rejected, → cancelled)
│   ├── convert/route.ts              # POST (approved → WorkOrder)
│   └── versions/route.ts             # GET (historial de versiones)
```

### 9.2 Middleware de Autenticación y Permisos

Todas las rutas siguen el patrón existente: leer `x-tenant-id` y `x-user-id` de headers, validar permisos vía RBAC.

```typescript
// Helper compartido (opcional: extraer a middleware si se refactoriza)
function getAuthContext(request: NextRequest): { tenantId: string; userId: string } {
  const tenantId = request.headers.get('x-tenant-id');
  const userId = request.headers.get('x-user-id');
  if (!tenantId || !userId) {
    throw new AuthError('No autorizado');
  }
  return { tenantId, userId };
}
```

### 9.3 `src/app/api/crm/quotes/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { QuoteService } from '@/src/quotes/services/quote.service';

const service = new QuoteService();

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filters = {
      status: searchParams.get('status') || undefined,
      clientId: searchParams.get('clientId') || undefined,
      createdBy: searchParams.get('createdBy') || undefined,
      createdAtGte: searchParams.get('createdAtGte') || undefined,
      createdAtLte: searchParams.get('createdAtLte') || undefined,
      includeDeleted: searchParams.get('includeDeleted') === 'true' || undefined,
      page: parseInt(searchParams.get('page') || '1', 10),
      limit: parseInt(searchParams.get('limit') || '20', 10),
      sort: searchParams.get('sort') || undefined,
    };

    const result = await service.listQuotes(filters, tenantId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const result = await service.createQuote(body, userId, tenantId);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const { ValidationError } = await import('@/src/quotes/services/quote.service');
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 },
    );
  }
}
```

### 9.4 `src/app/api/crm/quotes/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { QuoteService, NotFoundError, ValidationError } from '@/src/quotes/services/quote.service';

const service = new QuoteService();

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const tenantId = _request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const result = await service.getQuote(params.id, tenantId);
    if (!result) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const result = await service.updateQuote(params.id, body, userId, tenantId);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const deleted = await service.softDelete(params.id, userId, tenantId);
    return NextResponse.json({ data: deleted });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 },
    );
  }
}
```

### 9.5 `src/app/api/crm/quotes/[id]/send/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { QuoteService, NotFoundError, ConflictError } from '@/src/quotes/services/quote.service';
import { TransitionError } from '@/src/quotes/helpers/state-machine';

const service = new QuoteService();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const updated = await service.sendQuote(params.id, userId, tenantId);
    return NextResponse.json({ data: updated });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof TransitionError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof ConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 },
    );
  }
}
```

### 9.6 `src/app/api/crm/quotes/[id]/approve/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { QuoteService, NotFoundError, ConflictError } from '@/src/quotes/services/quote.service';
import { TransitionError } from '@/src/quotes/helpers/state-machine';

const service = new QuoteService();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const updated = await service.approveQuote(params.id, userId, tenantId);
    return NextResponse.json({ data: updated });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof TransitionError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof ConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 },
    );
  }
}
```

### 9.7 `src/app/api/crm/quotes/[id]/status/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { QuoteService, NotFoundError, ValidationError, ConflictError } from '@/src/quotes/services/quote.service';
import { TransitionError } from '@/src/quotes/helpers/state-machine';
import { QuoteStatus } from '@/src/quotes/types/quote';

const service = new QuoteService();

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { status: targetStatus, reason } = body;

    if (!targetStatus) {
      return NextResponse.json({ error: 'status es requerido' }, { status: 400 });
    }

    let updated;
    switch (targetStatus as QuoteStatus) {
      case 'rejected':
        updated = await service.rejectQuote(params.id, userId, tenantId, reason);
        break;
      case 'cancelled':
        updated = await service.cancelQuote(params.id, userId, tenantId);
        break;
      default:
        return NextResponse.json(
          { error: `Status inválido. Valores permitidos: rejected, cancelled` },
          { status: 400 },
        );
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof TransitionError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof ConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 },
    );
  }
}
```

### 9.8 `src/app/api/crm/quotes/[id]/convert/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { ConversionService, ConversionError } from '@/src/quotes/services/conversion.service';

const service = new ConversionService();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const result = await service.convertToWorkOrder(params.id, userId, tenantId, {
      priority: body.priority,
      category: body.category,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ConversionError) {
      const message = error.message;
      if (message.includes('ya fue convertida')) {
        return NextResponse.json({ error: message }, { status: 409 });
      }
      if (message.includes('no encontrada')) {
        return NextResponse.json({ error: message }, { status: 404 });
      }
      return NextResponse.json({ error: message }, { status: 422 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 },
    );
  }
}
```

### 9.9 `src/app/api/crm/quotes/[id]/versions/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { QuoteService, NotFoundError } from '@/src/quotes/services/quote.service';

const service = new QuoteService();

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const tenantId = _request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const result = await service.getVersions(params.id, tenantId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 },
    );
  }
}
```

### 9.10 Mapa de Errores HTTP

| Endpoint | 400 | 401 | 403 | 404 | 409 | 422 | 500 |
|---|---|---|---|---|---|---|---|
| `POST /quotes` | Validación | Auth | — | — | — | — | Error interno |
| `GET /quotes` | — | Auth | — | — | — | — | Error interno |
| `GET /quotes/:id` | — | Auth | — | No encontrada | — | — | Error interno |
| `PATCH /quotes/:id` | — | Auth | — | No encontrada | — | Campo prohibido, terminal | Error interno |
| `DELETE /quotes/:id` | — | Auth | — | No encontrada | — | Estado no permitido | Error interno |
| `POST /quotes/:id/send` | — | Auth | — | No encontrada | Concurrente | Transición/Guard | Error interno |
| `POST /quotes/:id/approve` | — | Auth | — | No encontrada | Concurrente | Transición/Guard | Error interno |
| `PATCH /quotes/:id/status` | Status inválido | Auth | — | No encontrada | Concurrente | Transición inválida | Error interno |
| `POST /quotes/:id/convert` | — | Auth | — | No encontrada | Ya convertida | Status no approved | Error interno |
| `GET /quotes/:id/versions` | — | Auth | — | No encontrada | — | — | Error interno |

---

## 10. Permisos

### 10.1 Constantes Existentes

El archivo `src/rbac/permissions.ts` YA incluye las constantes para Quotes:

```typescript
QUOTES_CREATE: 'quotes.create',
QUOTES_READ: 'quotes.read',
QUOTES_EDIT: 'quotes.edit',
QUOTES_DELETE: 'quotes.delete',
QUOTES_APPROVE: 'quotes.approve',
```

**Se debe agregar:**

```typescript
QUOTES_STATUS_CHANGE: 'quotes.statusChange',
```

### 10.2 Mapa de Permisos por Endpoint

| Endpoint | Permiso Requerido |
|---|---|
| `POST /api/crm/quotes` | `QUOTES_CREATE` |
| `GET /api/crm/quotes` | `QUOTES_READ` |
| `GET /api/crm/quotes/:id` | `QUOTES_READ` |
| `PATCH /api/crm/quotes/:id` | `QUOTES_EDIT` |
| `DELETE /api/crm/quotes/:id` | `QUOTES_DELETE` |
| `POST /api/crm/quotes/:id/send` | `QUOTES_STATUS_CHANGE` |
| `POST /api/crm/quotes/:id/approve` | `QUOTES_APPROVE` |
| `PATCH /api/crm/quotes/:id/status` | `QUOTES_STATUS_CHANGE` |
| `POST /api/crm/quotes/:id/convert` | `QUOTES_EDIT` + `WORKORDERS_CREATE` |
| `GET /api/crm/quotes/:id/versions` | `QUOTES_READ` |

### 10.3 Asignación por Rol

Basado en `RoleDefaultPermissions` existente en `src/rbac/permissions.ts`:

| Rol | Quotes |
|---|---|
| **Owner** | Todos (`QUOTES_CREATE`, `QUOTES_READ`, `QUOTES_EDIT`, `QUOTES_DELETE`, `QUOTES_APPROVE`, `QUOTES_STATUS_CHANGE`) |
| **Administrator** | Todos |
| **Supervisor** | `QUOTES_READ`, `QUOTES_APPROVE` |
| **Sales** | `QUOTES_CREATE`, `QUOTES_READ`, `QUOTES_EDIT` |
| **Accounting** | `QUOTES_READ` |
| **Dispatcher** | Ninguno |
| **Technician** | Ninguno |

**Modificaciones requeridas en `RoleDefaultPermissions`:**

- **Supervisor**: agregar `Permissions.QUOTES_STATUS_CHANGE` si se requiere que pueda cancelar.
- **Sales**: agregar `Permissions.QUOTES_DELETE` y `Permissions.QUOTES_APPROVE` según reglas de negocio. Default spec: Sales solo necesita CRUD. Si Sales necesita aprobar, se puede otorgar en configuración del tenant.

```typescript
// Actualización en src/rbac/permissions.ts — PermissionGroups
quotes: [
  Permissions.QUOTES_CREATE,
  Permissions.QUOTES_READ,
  Permissions.QUOTES_EDIT,
  Permissions.QUOTES_DELETE,
  Permissions.QUOTES_APPROVE,
  Permissions.QUOTES_STATUS_CHANGE,  // ← NUEVO
],
```

---

## 11. Archivos del Módulo

### 11.1 Lista Completa

```
src/quotes/
├── types/
│   ├── index.ts                    # Barrel export (~3 lines)
│   ├── quote.ts                    # IQuote, CreateQuoteInput, UpdateQuoteInput, QuoteStatus (~35 lines)
│   └── quote-version.ts            # IQuoteVersion, IQuoteItem, QuoteItemType, inputs (~40 lines)
├── schemas/
│   ├── index.ts                    # Barrel export (~3 lines)
│   ├── quote.ts                    # quoteSchema + 7 índices (~50 lines)
│   └── quote-version.ts            # quoteVersionSchema + 2 índices (+ subdoc itemSchema) (~55 lines)
├── models/
│   ├── index.ts                    # Barrel export (~3 lines)
│   ├── quote.ts                    # QuoteModel (~6 lines)
│   └── quote-version.ts            # QuoteVersionModel (~8 lines)
├── helpers/
│   ├── state-machine.ts            # VALID_TRANSITIONS, canTransition, validateTransition, guards (~80 lines)
│   ├── counter.ts                  # QuoteCounter model + getNextQuoteNumber (~35 lines)
│   └── calculator.ts               # calculateSubtotal, calculateTotal, processItems (~25 lines)
├── services/
│   ├── quote.service.ts            # QuoteService con CRUD + transitions + versioning (~400 lines)
│   └── conversion.service.ts       # ConversionService con transacción (~120 lines)
├── index.ts                        # Barrel público (~5 lines)
└──
src/app/api/crm/quotes/
├── route.ts                        # GET (list) + POST (create) (~75 lines)
├── [id]/
│   ├── route.ts                    # GET (get) + PATCH (update) + DELETE (soft delete) (~110 lines)
│   ├── send/route.ts               # POST (draft → sent) (~40 lines)
│   ├── approve/route.ts            # POST (sent → approved) (~40 lines)
│   ├── status/route.ts             # PATCH (→ rejected, → cancelled) (~60 lines)
│   ├── convert/route.ts            # POST (approved → WorkOrder) (~45 lines)
│   └── versions/route.ts           # GET (historial de versiones) (~30 lines)
```

### 11.2 Archivos Modificados Fuera del Módulo

| Archivo | Cambio | Líneas |
|---|---|---|
| `src/rbac/permissions.ts` | Agregar `QUOTES_STATUS_CHANGE` + `PermissionGroups.quotes` | +2 |
| `src/operations/types/work-order.ts` | Agregar `quoteId?: Types.ObjectId` | +1 |
| `src/operations/schemas/work-order.ts` | Agregar campo `quoteId` en schema | +1 |
| `src/core/types/activity-log.ts` | Extender `ActivityAction` con `'status_changed'` | +1 |
| Schema de Tenant | Agregar `quoteNumberPrefix` field | +1 |

### 11.3 Estimación Total

| Componente | Archivos | Líneas estimadas |
|---|---|---|
| Types | 3 | ~80 |
| Schemas | 3 | ~110 |
| Models | 3 | ~20 |
| Helpers | 3 | ~140 |
| Services | 2 | ~520 |
| API Routes | 6 | ~400 |
| Modificaciones externas | 4 | ~6 |
| **Total** | **24** | **~1,276** |

---

## 12. Secuencias de Flujo

### 12.1 Flujo Completo: Crear → Enviar → Aprobar → Convertir

```
USUARIO                    API                        QUOTE SERVICE               QUOTE VERSION        WORKORDER
  │                         │                              │                         │                    │
  │  POST /api/crm/quotes    │                              │                         │                    │
  │────────────────────────►│                              │                         │                    │
  │                         │  createQuote()               │                         │                    │
  │                         │─────────────────────────────►│                         │                    │
  │                         │                              │  getTenantQuotePrefix() │                    │
  │                         │                              │───────► Tenant          │                    │
  │                         │                              │◄─────── "COT"           │                    │
  │                         │                              │                         │                    │
  │                         │                              │  getNextQuoteNumber()   │                    │
  │                         │                              │───────► QuoteCounter    │                    │
  │                         │                              │◄─────── "COT-0001"      │                    │
  │                         │                              │                         │                    │
  │                         │                              │  processItems()         │                    │
  │                         │                              │  calculateSubtotal()    │                    │
  │                         │                              │  calculateTotal()       │                    │
  │                         │                              │                         │                    │
  │                         │                              │  ┌─ TRANSACCIÓN ──┐     │                    │
  │                         │                              │  │                 │     │                    │
  │                         │                              │  │ Quote.create()  │     │                    │
  │                         │                              │  │────────────────►│     │                    │
  │                         │                              │  │                 │     │                    │
  │                         │                              │  │ QuoteVersion    │     │                    │
  │                         │                              │  │ .create(v1)     │────►│                    │
  │                         │                              │  │                 │     │                    │
  │                         │                              │  └─────────────────┘     │                    │
  │                         │                              │                         │                    │
  │                         │                              │  logActivity(created)   │                    │
  │                         │◄─────────────────────────────│                         │                    │
  │  { quote, version: v1 }  │                              │                         │                    │
  │◄────────────────────────│                              │                         │                    │
  │                         │                              │                         │                    │
  │                         │                              │                         │                    │
  │  PATCH /quotes/:id       │                              │                         │                    │
  │  { items: [...] }       │                              │                         │                    │
  │────────────────────────►│                              │                         │                    │
  │                         │  updateQuote()               │                         │                    │
  │                         │─────────────────────────────►│                         │                    │
  │                         │                              │  detect commercial      │                    │
  │                         │                              │  changes → YES          │                    │
  │                         │                              │                         │                    │
  │                         │                              │  QuoteVersion.find(v1)  │                    │
  │                         │                              │────────────────────────►│                    │
  │                         │                              │◄────────────────────────│                    │
  │                         │                              │                         │                    │
  │                         │                              │  ┌─ TRANSACCIÓN ──┐     │                    │
  │                         │                              │  │                 │     │                    │
  │                         │                              │  │ QuoteVersion    │     │                    │
  │                         │                              │  │ .create(v2)     │────►│                    │
  │                         │                              │  │                 │     │                    │
  │                         │                              │  │ Quote.save()    │     │                    │
  │                         │                              │  │ (currentVer:2)  │     │                    │
  │                         │                              │  └─────────────────┘     │                    │
  │                         │                              │                         │                    │
  │                         │◄─────────────────────────────│                         │                    │
  │  { quote, version: v2 }  │                              │                         │                    │
  │◄────────────────────────│                              │                         │                    │
  │                         │                              │                         │                    │
  │                         │                              │                         │                    │
  │  POST /quotes/:id/send   │                              │                         │                    │
  │────────────────────────►│                              │                         │                    │
  │                         │  sendQuote()                  │                         │                    │
  │                         │─────────────────────────────►│                         │                    │
  │                         │                              │  validateTransition(    │                    │
  │                         │                              │    draft, sent)         │                    │
  │                         │                              │  validateSendReqs()     │                    │
  │                         │                              │                         │                    │
  │                         │                              │  findOneAndUpdate(      │                    │
  │                         │                              │    { status: draft },   │                    │
  │                         │                              │    { status: sent,      │                    │
  │                         │                              │      sentAt: now })     │                    │
  │                         │                              │                         │                    │
  │                         │                              │  logActivity(           │                    │
  │                         │                              │    status_changed)      │                    │
  │                         │◄─────────────────────────────│                         │                    │
  │  { status: "sent" }     │                              │                         │                    │
  │◄────────────────────────│                              │                         │                    │
  │                         │                              │                         │                    │
  │                         │                              │                         │                    │
  │  POST /quotes/:id/       │                              │                         │                    │
  │       approve            │                              │                         │                    │
  │────────────────────────►│                              │                         │                    │
  │                         │  approveQuote()               │                         │                    │
  │                         │─────────────────────────────►│                         │                    │
  │                         │                              │  validateTransition(    │                    │
  │                         │                              │    sent, approved)      │                    │
  │                         │                              │  validateApproveReqs()  │                    │
  │                         │                              │                         │                    │
  │                         │                              │  findOneAndUpdate(      │                    │
  │                         │                              │    { status: sent },    │                    │
  │                         │                              │    { status: approved,  │                    │
  │                         │                              │      approvedAt: now }) │                    │
  │                         │                              │                         │                    │
  │                         │                              │  logActivity(           │                    │
  │                         │                              │    status_changed)      │                    │
  │                         │◄─────────────────────────────│                         │                    │
  │  { status: "approved" } │                              │                         │                    │
  │◄────────────────────────│                              │                         │                    │
  │                         │                              │                         │                    │
  │                         │                              │                         │                    │
  │  POST /quotes/:id/       │                              │                         │                    │
  │       convert            │                              │                         │                    │
  │────────────────────────►│                              │                         │                    │
  │                         │  convertToWorkOrder()         │                         │                    │
  │                         │─────────────────────────────►│                         │                    │
  │                         │                              │  Validar: status=       │                    │
  │                         │                              │  approved, no convertido│                    │
  │                         │                              │                         │                    │
  │                         │                              │  QuoteVersion.find(v2)  │                    │
  │                         │                              │────────────────────────►│                    │
  │                         │                              │◄────────────────────────│                    │
  │                         │                              │                         │                    │
  │                         │                              │  ┌─ TRANSACCIÓN ──────────────┐              │
  │                         │                              │  │                           │              │
  │                         │                              │  │ buildClientSnapshot()      │              │
  │                         │                              │  │ buildLocationSnapshot()    │              │
  │                         │                              │  │                           │              │
  │                         │                              │  │ WorkOrder.create()         │─────────────►│
  │                         │                              │  │ { status: draft,           │              │
  │                         │                              │  │   title: "COT-0001 v2:...", │              │
  │                         │                              │  │   quoteId: quote._id }     │              │
  │                         │                              │  │                           │              │
  │                         │                              │  │ Quote.save()              │              │
  │                         │                              │  │ { convertedToWorkOrder:   │              │
  │                         │                              │  │   wo._id, convertedAt }    │              │
  │                         │                              │  │                           │              │
  │                         │                              │  │ logActivity(converted)    │              │
  │                         │                              │  └───────────────────────────┘              │
  │                         │◄─────────────────────────────│                                         │
  │  { quote, workOrder }   │                              │                                         │
  │◄────────────────────────│                              │                                         │
```

### 12.2 Secuencia: Expiración Batch

```
CRON JOB                    QuoteService                 Quote                     ActivityLog
  │                              │                         │                         │
  │  expireBatch(tenantId)       │                         │                         │
  │────────────────────────────►│                         │                         │
  │                              │                         │                         │
  │                              │  Quote.updateMany({     │                         │
  │                              │    status: "sent",      │                         │
  │                              │    validUntil < now     │                         │
  │                              │  }, { status:           │                         │
  │                              │    "expired" })         │                         │
  │                              │────────────────────────►│                         │
  │                              │◄────────────────────────│ { modifiedCount: 5 }    │
  │                              │                         │                         │
  │                              │  for each expired:      │                         │
  │                              │  logActivity(expired)   │                         │
  │                              │───────────────────────────────────────────────────►│
  │                              │                         │                         │
  │◄─────────────────────────────│                         │                         │
  │  { modifiedCount: 5 }       │                         │                         │
```

### 12.3 Secuencia: Race Condition en Transición

```
USUARIO A                    USUARIO B                    QuoteService              Quote
  │                             │                              │                      │
  │  POST /quotes/:id/send      │                              │                      │
  │────────────────────────────►│                              │                      │
  │                             │  POST /quotes/:id/send       │                      │
  │                             │─────────────────────────────►│                      │
  │                             │                              │                      │
  │                             │                              │  Leer Quote          │
  │                             │                              │  (status: draft)     │
  │                             │                              │─────────────────────►│
  │                             │                              │◄─────────────────────│
  │                             │                              │                      │
  │  findOneAndUpdate(          │                              │                      │
  │  { status: "draft" },       │                              │                      │
  │  { status: "sent" })        │                              │                      │
  │────────────────────────────►│                              │                      │
  │                             │                              │  findOneAndUpdate(   │
  │                             │                              │  { status: "draft" },│
  │                             │                              │  { status: "sent" }) │
  │                             │─────────────────────────────►│                      │
  │                             │                              │                      │
  │                             │                              │  ┌─ UPDATE A ──┐     │
  │                             │                              │  │ matched: 1  │     │
  │                             │                              │  │ modified: 1 │     │
  │                             │                              │  └─────────────┘     │
  │                             │                              │                      │
  │                             │                              │  ┌─ UPDATE B ──┐     │
  │                             │                              │  │ matched: 0  │     │
  │                             │                              │  │ (status ya  │     │
  │                             │                              │  │  es "sent") │     │
  │                             │                              │  └─────────────┘     │
  │                             │                              │                      │
  │                             │                              │  ¡Conflicto!         │
  │                             │                              │  throw ConflictError │
  │                             │◄─────────────────────────────│                      │
  │                             │  409 Conflict                │                      │
  │◄────────────────────────────│                              │                      │
  │  200 OK (status: sent)      │                              │                      │
```

### 12.4 Secuencia: Versioning

```
ACCIÓN                    QUOTE                     QUOTEVERSION
  │                         │                         │
  │  Creación              │                         │
  │  POST /quotes          │                         │
  │  { items: [A,B] }      │                         │
  │                         │  currentVersion: 1      │
  │                         │  subtotal: 100          │
  │                         │  total: 100             │
  │                         │                         │  v1 creada
  │                         │                         │  { items: [A,B],
  │                         │                         │    subtotal: 100,
  │                         │                         │    total: 100 }
  │                         │                         │
  │  Update comercial      │                         │
  │  PATCH /quotes/:id      │                         │
  │  { items: [A,B,C],     │                         │
  │    discountAmount: 10 } │                         │
  │                         │  currentVersion: 2      │
  │                         │  subtotal: 150          │
  │                         │  discountAmount: 10     │
  │                         │  total: 140             │
  │                         │                         │  v2 creada (inmutable)
  │                         │                         │  { items: [A,B,C],
  │                         │                         │    discountAmount: 10,
  │                         │                         │    subtotal: 150,
  │                         │                         │    total: 140 }
  │                         │                         │
  │                         │                         │  v1 preservada
  │                         │                         │  { items: [A,B],
  │                         │                         │    discountAmount: 0,
  │                         │                         │    subtotal: 100,
  │                         │                         │    total: 100 }
  │                         │                         │
  │  Update no comercial   │                         │
  │  PATCH /quotes/:id      │                         │
  │  { locationId: ... }    │                         │
  │                         │  locationId actualizado │
  │                         │  currentVersion: 2      │
  │                         │  (sin cambios)          │
  │                         │                         │  NO se crea versión
  │                         │                         │
  │  Consultar versiones   │                         │
  │  GET /quotes/:id/       │                         │
  │       versions          │                         │
  │                         │                         │
  │  Resultado:             │                         │
  │  [{ v2, items: [A,B,C] },                         │
  │   { v1, items: [A,B] }]                          │
```

---

> **Fin de SDD Design: Fase 5 — Cotizaciones Comerciales (Quotes)**
>
> Próximo paso: SDD Tasks con desglose de tareas de implementación.
