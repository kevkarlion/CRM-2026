# Proposal: Gestion Events System

## Intent

Implementar un sistema de eventos para Gestion, similar al existente para Lead pero independiente y desacoplado. Esto permitirá registrar todos los hitos y movimientos de cada gestión, creando una auditoría completa del ciclo de vida y proporcionando datos para analytics, timeline y seguimiento.

## Scope

### In Scope
- Agregar campo `events[]` al schema de Gestion
- Definir tipos de eventos: GESTION_CREATED, STATUS_CHANGED, QUOTE_SENT, SALE_CONFIRMED, WORK_ORDER_CREATED, NOTE_ADDED
- Crear helper functions para registrar eventos en Gestion
- Integrar registro de eventos con handlers existentes (quote sent, sale confirmed, etc.)
- Modificar flujo "Ciclo terminado" para copiar events al history
- Exponer eventos en API GET para cliente

### Out of Scope
- Frontend UI para visualizar eventos (futuro)
- Sistema de notificaciones basado en eventos
- Eventos de Lead (ya existe)
- Migración de datos históricos

## Approach

### Data Model
```typescript
// New field in Gestion schema
events: [{
  type: 'GESTION_CREATED' | 'STATUS_CHANGED' | 'QUOTE_SENT' | 'SALE_CONFIRMED' | 'WORK_ORDER_CREATED' | 'NOTE_ADDED',
  timestamp: Date,
  userId?: string,
  data: {
    previousStatus?: string,
    newStatus?: string,
    quoteId?: string,
    workOrderId?: string,
    amount?: number,
    note?: string,
    // ... event-specific data
  }
}]

// Modify existing history to include events
history: [{
  closedAt: Date,
  finalStatus: string,
  events: [...], // copied from events[] before close
  score: number,
  // ... existing fields
}]
```

### Integration Points
1. **GestionService.create()** → registro automático de GESTION_CREATED
2. **GestionService.updateStatus()** → registro de STATUS_CHANGED
3. **Quote sent handler** → registrar QUOTE_SENT en la Gestion asociada
4. **Sale confirmation handler** → registrar SALE_CONFIRMED
5. **Work order creation** → registrar WORK_ORDER_CREATED
6. **Note creation** → registrar NOTE_ADDED

### Close Cycle Flow
1. Usuario presiona "Ciclo terminado"
2. Se copian todos los eventos actuales al entry de history
3. Se limpia el array events para el nuevo ciclo

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| events[] grows unbounded | Medium | TTL o límite de eventos por Gestion |
| Performance con array grande | Low | Usar subdocumentos mongoose eficientemente |
| Duplicación con domain events | Low | events[] es para auditoría, domain events para decoupling |

## Rollback Plan

1. Remover campo `events[]` del schema
2. Remover helper functions
3. Revertir integración en handlers
4. Remover campo events del history (backward compatible)

## Dependencies

- Schema actual de Gestion: `src/gestion/schemas/gestion.ts`
- Types de Gestion: `src/gestion/types/gestion.ts`
- Domain events existentes: `src/infrastructure/events/event.types.ts`
- GestionSync handler: `src/gestion/handlers/gestion-sync.handler.ts`

## Success Criteria

- [ ] Campo events existe en schema de Gestion
- [ ] Al crear Gestion se registra evento GESTION_CREATED
- [ ] Al cambiar status se registra STATUS_CHANGED
- [ ] Al enviar presupuesto se registra en Gestion asociada
- [ ] Al confirmar venta se registra en Gestion asociada
- [ ] Al cerrar ciclo, events se copian a history
- [ ] API GET /gestiones/[id] incluye eventos
