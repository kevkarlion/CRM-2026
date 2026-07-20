# Arquitectura Objetivo — Domain Events

> **Estado:** Análisis completo. Ajuste arquitectónico aplicado.
> **Fecha:** 2026-07-19
> **Objetivo:** Definir la arquitectura objetivo antes de cualquier refactor.

---

## 1. Principio Fundamental

**Domain Events representan hechos de negocio que YA ocurrieron.**

No representan comandos. No representan procesos pendientes. No representan decisiones.

```
❌ Event-Driven (comandos):
   Quote publica "QUOTE_SENT" → Handler decide cambiar Lead → Handler crea Timeline

✅ Domain Events (hechos):
   Quote ejecuta todo su proceso → commit exitoso → publica "QUOTE_SENT"
   → TimelineHandler crea TimelineEvent (efecto secundario)
   → AuditHandler crea ActivityLog (efecto secundario)
```

---

## 2. Las Tres Capas

### Capa 1: Dominio

Responsable de ejecutar los procesos de negocio.

- Contiene toda la lógica de negocio
- Coordina entre dominios cuando el proceso así lo requiere
- Ejecuta transacciones completas
- **Nunca** publica eventos antes del commit exitoso

### Capa 2: Domain Events

Responsables de comunicar que un hecho de negocio ocurrió.

- Representan hechos consumados
- Se publican **después** del commit exitoso
- No contienen lógica de negocio
- Son el canal de comunicación entre dominio e infraestructura

### Capa 3: Infraestructura

Responsable de reaccionar a hechos mediante componentes independientes.

- TimelineEvent (timeline visual)
- ActivityLog (auditoría técnica)
- Dashboard (proyecciones)
- Notificaciones
- Analytics
- Automatizaciones
- Integraciones futuras

---

## 3. Responsabilidades por Capa

### 3.1 Dominios — Qué PERMANECE

| Dominio | Responsabilidades que PERMANECEN en el dominio |
|---------|-----------------------------------------------|
| **Lead** | Estado, pipeline, validaciones, conversión a cliente |
| **Quote** | CRUD, versionado, envío, aprobación, **actualización del Lead** |
| **Negotiation** | CRUD, contraofertas, aceptación/rechazo, **cambio de estado del Lead** |
| **Operations** | CRUD de WorkOrders y Visitas, programación, asignación |
| **CRM** | Creación de Client/Contact (en conversión de Lead) |

**Nota clave:** Quote.sendQuote() **continúa** actualizando Lead.status. Negotiation.updateStatus() **continúa** cambiando Lead a won/lost. La coordinación entre dominios **permanece en los dominios**.

### 3.2 Domain Events — Qué se EMITE

Los dominios publican eventos **después** del commit exitoso:

```typescript
// QuoteService.sendQuote()
async sendQuote(quoteId, userId, tenantId) {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // 1. Validar
    // 2. Guardar Quote
    // 3. Actualizar Lead (estado → quote_sent)
    // 4. Actualizar qualificationStatus
    
    await session.commitTransaction();
    
    // 5. PUBLICAR EVENTO (después del commit)
    await eventBus.publish({
      type: 'QUOTE_SENT',
      aggregateId: quote._id,
      aggregateType: 'Quote',
      tenantId,
      userId,
      timestamp: new Date(),
      payload: { quoteId, leadId, number, total },
    });
    
    return quote;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
```

### 3.3 Event Handlers — Qué HACEN

Los Handlers **únicamente** ejecutan efectos secundarios:

| Handler | Responsabilidad | NUNCA hace |
|---------|----------------|------------|
| **TimelineHandler** | Crear TimelineEvent para el timeline visual | Modificar estado de entidades |
| **AuditHandler** | Crear ActivityLog técnico | Tomar decisiones de negocio |
| **DashboardHandler** | Actualizar proyecciones/métricas | Crear entidades de negocio |
| **NotificationHandler** | Enviar notificaciones | Cambiar estados |
| **AnalyticsHandler** | Registrar métricas | Modificar datos de negocio |

---

## 4. Domain Events Definidos

| Evento | Dominio | Descripción | Payload |
|--------|---------|-------------|---------|
| `LEAD_CREATED` | Lead | Lead creado exitosamente | leadId, name, source |
| `LEAD_STATUS_CHANGED` | Lead | Estado del lead cambió | leadId, from, to |
| `LEAD_CONVERTED` | Lead | Lead convertido a cliente | leadId, clientId |
| `QUOTE_CREATED` | Quote | Cotización creada | quoteId, number, leadId |
| `QUOTE_SENT` | Quote | Cotización enviada | quoteId, leadId, number, total |
| `QUOTE_APPROVED` | Quote | Cotización aprobada | quoteId, leadId |
| `QUOTE_REJECTED` | Quote | Cotización rechazada | quoteId, leadId |
| `NEGOTIATION_OPENED` | Negotiation | Negociación iniciada | negotiationId, leadId |
| `NEGOTIATION_ACCEPTED` | Negotiation | Negociación aceptada | negotiationId, leadId |
| `NEGOTIATION_REJECTED` | Negotiation | Negociación rechazada | negotiationId, leadId |
| `SALE_CONFIRMED` | Lead | Venta confirmada | leadId, clientId, amount |
| `WORK_ORDER_CREATED` | Operations | OT creada | workOrderId, leadId, number |
| `WORK_ORDER_COMPLETED` | Operations | OT finalizada | workOrderId |
| `VISIT_CREATED` | Operations | Visita técnica creada | visitId, leadId |
| `VISIT_COMPLETED` | Operations | Visita finalizada | visitId |

---

## 5. Flujo Ejemplo: Enviar Presupuesto

```
QuoteService.sendQuote()
│
├── 1. Validar quote
├── 2. Guardar Quote (status → sent)
├── 3. LeadModel.updateOne (status → quote_sent, qualified)
├── 4. session.commitTransaction()
│
└── 5. eventBus.publish(QUOTE_SENT)  ← DESPUÉS del commit
        │
        ├──→ TimelineHandler
        │      └── TimelineService.create({
        │            leadId, eventType: 'quote.sent',
        │            title: 'Presupuesto enviado',
        │            icon: 'send', color: 'indigo'
        │          })
        │
        ├──→ AuditHandler
        │      └── ActivityLogService.create({
        │            entityType: 'Quote', entityId: quoteId,
        │            action: 'status_changed',
        │            before: { status: 'draft' },
        │            after: { status: 'sent' }
        │          })
        │
        ├──→ DashboardHandler (futuro)
        │      └── DashboardService.updateMetrics(...)
        │
        └──→ NotificationHandler (futuro)
               └── NotificationService.send(...)
```

---

## 6. Publicación de Eventos — Estrategia

### 6.1 Regla Fundamental

**Los eventos se publican ÚNICAMENTE después del commit exitoso.**

Nunca antes. Nunca durante una transacción incompleta.

### 6.2 Implementación

```typescript
// Patrón: commit primero, publicar después

async executeWithEvents<T>(
  fn: () => Promise<T>,
  events: DomainEvent[]
): Promise<T> {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const result = await fn();
    await session.commitTransaction();
    
    // Publicar después del commit
    for (const event of events) {
      await eventBus.publish(event);
    }
    
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
```

### 6.3 Manejo de Errores en Publicación

Si la publicación del evento falla después de un commit exitoso:

```typescript
async safePublish(event: DomainEvent): Promise<void> {
  try {
    await eventBus.publish(event);
  } catch (error) {
    // Log el error pero NO revertir el negocio
    console.error('[EventBus] Failed to publish:', event.type, error);
    // Opcional: guardar en cola de retry
    await eventQueue.enqueue(event);
  }
}
```

**Por qué no revertir:** El negocio ya se ejecutó correctamente. El evento es un efecto secundario. Si falla, se reintenta, pero no se revierte la transacción de negocio.

---

## 7. Event Dispatcher

### 7.1 Interfaz

```typescript
// infrastructure/events/event-bus.ts

interface DomainEvent<T = unknown> {
  type: string;
  aggregateId: string;
  aggregateType: string;
  tenantId: string;
  userId: string;
  timestamp: Date;
  payload: T;
}

type EventHandler<T = unknown> = (event: DomainEvent<T>) => Promise<void>;

interface IEventBus {
  on(eventType: string, handler: EventHandler): void;
  publish(event: DomainEvent): Promise<void>;
}
```

### 7.2 Implementación

```typescript
class EventBus implements IEventBus {
  private handlers = new Map<string, EventHandler[]>();

  on(eventType: string, handler: EventHandler): void {
    const existing = this.handlers.get(eventType) || [];
    existing.push(handler);
    this.handlers.set(eventType, existing);
  }

  async publish(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.type) || [];
    const wildcardHandlers = this.handlers.get('*') || [];
    const allHandlers = [...handlers, ...wildcardHandlers];
    
    for (const handler of allHandlers) {
      try {
        await handler(event);
      } catch (error) {
        console.error(`[EventBus] Handler error for ${event.type}:`, error);
      }
    }
  }
}

export const eventBus = new EventBus();
```

### 7.3 Registro de Handlers

```typescript
// infrastructure/events/setup.ts

import { eventBus } from './event-bus';
import { timelineHandler } from '@/timeline/handlers/timeline.handler';
import { auditHandler } from '@/audit/handlers/audit.handler';

export function setupEventHandlers(): void {
  // Timeline
  eventBus.on('LEAD_CREATED', timelineHandler.onLeadCreated);
  eventBus.on('QUOTE_SENT', timelineHandler.onQuoteSent);
  eventBus.on('SALE_CONFIRMED', timelineHandler.onSaleConfirmed);
  eventBus.on('WORK_ORDER_CREATED', timelineHandler.onWorkOrderCreated);
  eventBus.on('NEGOTIATION_OPENED', timelineHandler.onNegotiationOpened);
  // ... todos los eventos
  
  // Audit (wildcard - escucha todos los eventos)
  eventBus.on('*', auditHandler.onAnyEvent);
}
```

---

## 8. Timeline — TimelineEvent

### 8.1 Renombramiento

| Actual | Futuro |
|--------|--------|
| `Activity` (modelo) | `TimelineEvent` (modelo) |
| `ActivityModel` | `TimelineEventModel` |
| `ActivityService` | `TimelineService` |
| `activities` (colección) | `timeline_events` (colección) |

### 8.2 Responsabilidad

**TimelineEvent** representa exclusivamente el timeline visual del CRM.

Ejemplos de TimelineEvents:
- "Presupuesto enviado"
- "Venta confirmada"
- "Orden de Trabajo creada"
- "Técnico asignado"
- "Negociación iniciada"
- "Trabajo finalizado"

**NUNCA** se utiliza para:
- Auditoría técnica
- Tomar decisiones de negocio
- Almacenar datos de negocio

### 8.3 Handler

```typescript
// timeline/handlers/timeline.handler.ts

export const timelineHandler = {
  async onQuoteSent(event: DomainEvent) {
    await timelineService.create({
      leadId: event.payload.leadId,
      entityType: 'quote',
      entityId: event.aggregateId,
      eventType: 'quote.sent',
      title: 'Presupuesto enviado',
      summary: `COT-${event.payload.number} — $${event.payload.total}`,
      icon: 'send',
      color: 'indigo',
      performedBy: event.userId,
    });
  },
  
  async onSaleConfirmed(event: DomainEvent) {
    await timelineService.create({
      leadId: event.payload.leadId,
      entityType: 'lead',
      entityId: event.payload.leadId,
      eventType: 'lead.converted',
      title: 'Venta confirmada',
      summary: `$${event.payload.amount.toLocaleString()}`,
      icon: 'check-circle',
      color: 'green',
      performedBy: event.userId,
    });
  },
  
  // ... todos los handlers
};
```

### 8.4 Servicio

```typescript
// timeline/services/timeline.service.ts

export class TimelineService {
  async create(data: CreateTimelineEventInput): Promise<TimelineEvent> {
    return TimelineEventModel.create({
      tenantId: data.tenantId,
      leadId: data.leadId,
      entityType: data.entityType,
      entityId: data.entityId,
      eventType: data.eventType,
      title: data.title,
      summary: data.summary,
      icon: data.icon,
      color: data.color,
      performedBy: data.performedBy,
    });
  }
  
  async findByLead(leadId: string, tenantId: string): Promise<TimelineEvent[]> {
    return TimelineEventModel.find({ leadId, tenantId })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('performedBy', 'firstName lastName email')
      .lean();
  }
}
```

---

## 9. ActivityLog — Auditoría Técnica

### 9.1 Responsabilidad

ActivityLog responde preguntas técnicas:
- **Quién** realizó el cambio
- **Cuándo** se realizó
- **Qué** cambió
- **Valores anteriores**
- **Valores nuevos**

**NUNCA** se utiliza para interfaces del CRM.

### 9.2 Handler

```typescript
// audit/handlers/audit.handler.ts

export const auditHandler = {
  async onAnyEvent(event: DomainEvent) {
    await activityLogService.create({
      tenantId: event.tenantId,
      entityType: event.aggregateType,
      entityId: event.aggregateId,
      action: mapEventToAction(event.type),
      actorId: event.userId,
      metadata: event.payload,
      timestamp: event.timestamp,
    });
  }
};

function mapEventToAction(eventType: string): string {
  const map: Record<string, string> = {
    'LEAD_CREATED': 'created',
    'LEAD_STATUS_CHANGED': 'statusChanged',
    'QUOTE_SENT': 'statusChanged',
    'SALE_CONFIRMED': 'statusChanged',
    // ...
  };
  return map[eventType] || 'updated';
}
```

---

## 10. Estructura de Directorios

```
src/
├── leads/                          # Dominio Lead
│   ├── services/
│   │   └── lead.service.ts         # Lógica de negocio + publica eventos
│   ├── helpers/
│   │   └── lead-state-machine.ts
│   └── events/
│       └── lead.events.ts          # Tipos de eventos del Lead
│
├── quotes/                         # Dominio Quote
│   ├── services/
│   │   ├── quote.service.ts        # Incluye actualización de Lead
│   │   └── conversion.service.ts   # Incluye creación de WorkOrder
│   └── events/
│       └── quote.events.ts
│
├── negotiation/                    # Dominio Negotiation
│   ├── services/
│   │   ├── negotiation.service.ts  # Incluye cambio de estado del Lead
│   │   └── ...
│   └── events/
│       └── negotiation.events.ts
│
├── operations/                     # Dominio Operations
│   ├── services/
│   │   ├── work-order.service.ts
│   │   └── technical-visit.service.ts
│   └── events/
│       └── operations.events.ts
│
├── timeline/                       # NUEVO: Timeline (infraestructura)
│   ├── services/
│   │   └── timeline.service.ts
│   ├── handlers/
│   │   └── timeline.handler.ts     # Reacciona a eventos → crea TimelineEvents
│   └── models/
│       └── timeline-event.ts       # Modelo renombrado
│
├── audit/                          # Auditoría técnica (infraestructura)
│   ├── services/
│   │   └── activity-log.service.ts
│   ├── handlers/
│   │   └── audit.handler.ts        # Reacciona a eventos → crea ActivityLogs
│   └── models/
│       └── activity-log.ts
│
└── infrastructure/                 # NUEVO: Event Dispatcher
    └── events/
        ├── event-bus.ts            # Dispatcher central
        ├── event.types.ts          # Definición de tipos
        └── setup.ts                # Registro de handlers
```

---

## 11. Estado Actual vs Estado Objetivo

### 11.1 Qué CAMBIA

| Componente | Actual | Objetivo |
|------------|--------|----------|
| **QuoteService.sendQuote** | Muta LeadModel + logActivity | Muta LeadModel + publica QUOTE_SENT |
| **NegotiationService.create** | Llama leadService.changeStatus + crea Activity | Llama leadService.changeStatus + publica NEGOTIATION_OPENED |
| **WorkOrderService.create** | Crea Activity + logActivity | Publica WORK_ORDER_CREATED |
| **LeadService.convertToClient** | Crea Client + Contact + Activity | Crea Client + Contact + publica LEAD_CONVERTED |
| **confirm-sale route** | Orquesta 4 dominios + crea Activity | Orquesta 4 dominios + publica SALE_CONFIRMED |
| **TimelineHandler** | No existe | Escucha eventos → crea TimelineEvents |
| **AuditHandler** | No existe | Escucha eventos → crea ActivityLogs |

### 11.2 Qué NO CAMBIA

| Componente | Razón |
|------------|-------|
| **QuoteService** actualiza Lead | Es parte del proceso de negocio de Quote |
| **NegotiationService** cambia Lead | Es parte del proceso de negocio de Negotiation |
| **ConversionService** crea WorkOrder | Es parte del proceso de conversión de Quote |
| **LeadService** crea Client/Contact | Es parte del proceso de conversión de Lead |
| **confirm-sale** orquesta 4 dominios | Es el caso de uso de venta |
| **StateMachine de Lead** | Lógica pura de dominio |

---

## 12. Estrategia de Migración

### Fase 0: Infraestructura (1-2 días)

**Objetivo:** Crear el Event Dispatcher sin modificar nada existente.

- [ ] Crear `infrastructure/events/event-bus.ts`
- [ ] Crear `infrastructure/events/event.types.ts`
- [ ] Crear `infrastructure/events/setup.ts`
- [ ] Los dominios existentes no se modifican aún
- [ ] Solo se agrega infraestructura nueva

**Riesgo:** Mínimo. Solo código nuevo.

### Fase 1: Timeline (2-3 días)

**Objetivo:** Crear TimelineEvent como infraestructura que escucha eventos.

- [ ] Renombrar `Activity` → `TimelineEvent` (modelo y schema)
- [ ] Crear `timeline/services/timeline.service.ts`
- [ ] Crear `timeline/handlers/timeline.handler.ts`
- [ ] Registrar handlers en `setup.ts`
- [ ] Los dominios existentes aún no publican eventos (usar logging temporal)

**Riesgo:** Bajo. Solo infraestructura nueva.

### Fase 2: Quote Domain (2-3 días)

**Objetivo:** Quote comienza a publicar eventos después del commit.

- [ ] `QuoteService.sendQuote()` publica `QUOTE_SENT` después del commit
- [ ] `QuoteService.approveQuote()` publica `QUOTE_APPROVED`
- [ ] `QuoteService.rejectQuote()` publica `QUOTE_REJECTED`
- [ ] `ConversionService` publica `QUOTE_CONVERTED`
- [ ] TimelineHandler crea TimelineEvents para estos eventos
- [ ] Eliminar llamadas directas a `ActivityService.create()` de QuoteService

**Riesgo:** BAJO. Solo se agrega publicación de eventos.

### Fase 3: Negotiation Domain (2-3 días)

**Objetivo:** Negotiation comienza a publicar eventos.

- [ ] `NegotiationService.create()` publica `NEGOTIATION_OPENED`
- [ ] `NegotiationService.updateStatus()` publica `NEGOTIATION_ACCEPTED` / `NEGOTIATION_REJECTED`
- [ ] TimelineHandler crea TimelineEvents
- [ ] Eliminar llamadas directas a `ActivityService.create()` de Negotiation

**Riesgo:** BAJO.

### Fase 4: Operations Domain (2-3 días)

**Objetivo:** Operations comienza a publicar eventos.

- [ ] `WorkOrderService.create()` publica `WORK_ORDER_CREATED`
- [ ] `WorkOrderService.changeStatus()` publica `WORK_ORDER_STATUS_CHANGED`
- [ ] `TechnicalVisitService.create()` publica `VISIT_CREATED`
- [ ] TimelineHandler crea TimelineEvents
- [ ] Eliminar llamadas directas a `ActivityService.create()` de Operations
- [ ] Eliminar llamadas a `logActivity()` de Operations (migrar a AuditHandler)

**Riesgo:** BAJO.

### Fase 5: Lead Domain (1-2 días)

**Objetivo:** Lead comienza a publicar eventos.

- [ ] `LeadService.createLead()` publica `LEAD_CREATED`
- [ ] `LeadService.changeStatus()` publica `LEAD_STATUS_CHANGED`
- [ ] `LeadService.convertToClient()` publica `LEAD_CONVERTED`
- [ ] TimelineHandler crea TimelineEvents
- [ ] Eliminar llamadas directas a `ActivityModel.create()` de LeadService

**Riesgo:** BAJO.

### Fase 6: confirm-sale + Consolidación (2-3 días)

**Objetivo:** confirm-sale publica evento y se consolida la arquitectura.

- [ ] `confirm-sale` route publica `SALE_CONFIRMED` después de la transacción
- [ ] AuditHandler escucha todos los eventos y crea ActivityLogs
- [ ] Eliminar `logActivity()` de todos los servicios
- [ ] Eliminar `ActivityService` anterior (reemplazado por TimelineService)
- [ ] Verificar que TimelineHandler crea todas las TimelineEvents necesarias

**Riesgo:** MEDIO. Consolidación final.

---

## 13. Riesgos

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| **Handler falla después del commit** | BAJO | El negocio ya se ejecutó. Handler se reintenta. No se revierte negocio. |
| **Timeline desactualizado temporalmente** | BAJO | Handlers son rápidos (solo crean registros). Consistencia eventual aceptable. |
| **Performance por llamadas async** | BAJO | EventBus síncrono inicialmente. Optimizar después si es necesario. |
| **Testing más complejo** | MEDIO | Cada handler se testea aisladamente. Crear helpers de testing. |
| **Migración gradual puede causar inconsistencia temporal** | MEDIO | Durante la migración, algunos eventos se publican y otros no. Consolidar rápido. |

---

## 14. Beneficios Esperados

1. **Dominios cohesionados** — cada dominio maneja su lógica de negocio
2. **Efectos secundarios desacoplados** — Timeline, Audit, Dashboard son independientes
3. **Preparado para crecimiento** — agregar notificaciones, analytics, webhooks es solo un nuevo handler
4. **Consistencia transaccional** — los eventos se publican después del commit
5. **Testing simplificado** — handlers se testean aisladamente
6. **Mantenibilidad** — cambiar Timeline no afecta dominios

---

## 15. Métricas de Éxito

| Métrica | Actual | Objetivo |
|---------|--------|----------|
| Dominios que crean TimelineEvents directamente | 5+ servicios | 0 (solo TimelineHandler) |
| Dominios que crean ActivityLogs directamente | 4+ servicios | 0 (solo AuditHandler) |
| Sistemas de actividad duplicados | 2 colecciones + bypass | 1 Timeline + 1 Audit |
| Handler que contienen lógica de negocio | N/A | 0 |
| Tiempo para agregar nuevo efecto secundario | Modificar múltiples servicios | Crear 1 handler |

---

## 16. Estado de Implementación

> **Fecha de implementación:** 2026-07-19
> **Estado:** Fases 0-6 completadas. Negotiation pendiente (Fase 3).

### 16.1 Fases Completadas

| Fase | Estado | Archivos creados/modificados |
|------|--------|------------------------------|
| **Fase 0: Infraestructura** | ✅ | `infrastructure/events/event-bus.ts`, `event.types.ts`, `setup.ts` |
| **Fase 1: Timeline** | ✅ | `timeline/types/`, `timeline/schemas/`, `timeline/models/`, `timeline/services/`, `timeline/handlers/` |
| **Fase 2: Quote Domain** | ✅ | `quotes/services/quote.service.ts` (publishes QUOTE_CREATED, QUOTE_SENT, QUOTE_APPROVED, QUOTE_REJECTED) |
| **Fase 3: Negotiation** | ⏳ | Pendiente — negociación no implementada aún |
| **Fase 4: Operations** | ✅ | `operations/services/work-order.service.ts`, `technical-visit.service.ts` |
| **Fase 5: Lead Domain** | ✅ | `leads/services/lead.service.ts` |
| **Fase 6: Consolidación** | ✅ | `audit/types/`, `audit/services/`, `audit/handlers/`, confirm-sale route |

### 16.2 Eventos Publicados por Dominio

| Dominio | Evento | Método | Estado |
|---------|--------|--------|--------|
| **Quote** | `QUOTE_CREATED` | `createQuote()` | ✅ |
| **Quote** | `QUOTE_SENT` | `sendQuote()` | ✅ |
| **Quote** | `QUOTE_APPROVED` | `approveQuote()` | ✅ |
| **Quote** | `QUOTE_REJECTED` | `rejectQuote()` | ✅ |
| **Quote** | `QUOTE_CONVERTED` | `ConversionService` | ✅ |
| **Lead** | `LEAD_CREATED` | `createLead()` | ✅ |
| **Lead** | `LEAD_STATUS_CHANGED` | `changeStatus()` | ✅ |
| **Lead** | `LEAD_CONVERTED` | `convertToClient()` | ✅ |
| **Operations** | `WORK_ORDER_CREATED` | `create()` | ✅ |
| **Operations** | `WORK_ORDER_STATUS_CHANGED` | `changeStatus()` | ✅ |
| **Operations** | `WORK_ORDER_COMPLETED` | `changeStatus()` (when completed) | ✅ |
| **Operations** | `VISIT_CREATED` | `create()` | ✅ |
| **Operations** | `VISIT_STATUS_CHANGED` | `updateStatus()` | ✅ |
| **Operations** | `VISIT_COMPLETED` | `updateStatus()` (when completed) | ✅ |
| **Sale** | `SALE_CONFIRMED` | `confirm-sale route` | ✅ |
| **Negotiation** | `NEGOTIATION_OPENED` | — | ⏳ Pendiente |
| **Negotiation** | `NEGOTIATION_ACCEPTED` | — | ⏳ Pendiente |
| **Negotiation** | `NEGOTIATION_REJECTED` | — | ⏳ Pendiente |
| **Negotiation** | `COUNTER_OFFER_CREATED` | — | ⏳ Pendiente |

### 16.3 Handlers Registrados

| Handler | Tipo | Eventos | Estado |
|---------|------|---------|--------|
| **TimelineHandler** | Específico | 15 eventos (LEAD_*, QUOTE_*, WORK_ORDER_*, VISIT_*, SALE_*) | ✅ |
| **AuditHandler** | Wildcard (`*`) | Todos los eventos | ✅ |

### 16.4 Issues Encontrados y Solucionados

| Issue | Causa | Solución |
|-------|-------|----------|
| **EventBus no disparaba eventos** | Next.js App Router aísla módulos de layout.tsx y API routes | Lazy initialization en `EventBus.publish()` con `require('./setup')` |
| **OverwriteModelError: QuoteCounter** | Modelo registrado sin verificar si ya existe | Cambiar a `models.QuoteCounter \|\| model()` |
| **OverwriteModelError: WorkOrderCounter** | Mismo patrón | Cambiar a `models.WorkOrderCounter \|\| model()` |
| **Schema User not registered** | TimelineEvent schema refiere 'User' sin importar modelo | Agregar `import '@/core/models/user'` en model |
| **Schema Tenant not registered** | ActivityLog y TimelineEvent refieren 'Tenant' | Agregar `import '@/core/models/tenant'` en models |
| **Timeline no se actualiza al crear** | LeadTimeline solo fetch al montar | Agregar `refreshKey` prop + incrementar en `onSuccess` |
| **Quote detail 500 error** | Página usaba `fetch()` directo sin auth headers | Cambiar a `api.get()` que agrega Authorization + x-tenant-id |
| **Quote detail 500 error (2)** | WorkOrderCounter OverwriteModelError | Aplicar patrón `models \|\| model()` |

### 16.5 Archivos Clave

```
src/infrastructure/events/
├── event-bus.ts              ← EventBus con lazy initialization + wildcard
├── event.types.ts            ← 15 eventos + payload interfaces
└── setup.ts                  ← Registro de handlers (timelineHandler + auditHandler)

src/timeline/
├── types/timeline-event.ts   ← ITimelineEvent, CreateTimelineEventInput
├── schemas/timeline-event.ts ← Mongoose schema
├── models/timeline-event.ts  ← TimelineEventModel (importa User, Tenant, Lead)
├── services/timeline.service.ts ← create(), findByLead()
└── handlers/timeline.handler.ts ← 15 handlers (onLead*, onQuote*, onWorkOrder*, onVisit*, onSale*)

src/audit/
├── types/activity-log.ts     ← Re-exports de core
├── services/activity-log.service.ts ← create()
└── handlers/audit.handler.ts ← Wildcard '*' handler para todos los eventos
```

### 16.6 Patrones Clave

**1. Lazy Initialization (resuelve Next.js module isolation):**
```typescript
// event-bus.ts
private ensureInitialized(): void {
  if (this.initialized) return;
  this.initialized = true;
  const { setupEventHandlers } = require('./setup');
  setupEventHandlers();
}
```

**2. Safe Model Registration (resuelve OverwriteModelError):**
```typescript
// ❌ Nunca hacer:
const Model = model('Name', schema);

// ✅ Siempre hacer:
const Model = models.Name || model('Name', schema);
```

**3. Event Publication Pattern (después del commit):**
```typescript
await session.commitTransaction();
// ... session.endSession() ...
try {
  await eventBus.publish({ type: DOMAIN_EVENTS.X, ... });
} catch (eventError) {
  console.error('[Service] Failed to publish:', eventError);
}
```

**4. Timeline Refresh Pattern:**
```typescript
const [refreshKey, setRefreshKey] = useState(0);
// En onSuccess de drawers:
setRefreshKey(k => k + 1);
// En componente:
<LeadTimeline leadId={id} refreshKey={refreshKey} />
```

---

*Documento generado el 2026-07-19. Implementación completa (Fases 0-6). Negotiation pendiente.*
