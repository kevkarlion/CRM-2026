# SDD Proposal: Flujo de Ejecución del Técnico (OT/VT)

> **Change name**: `flujo-ejecucion-tecnico`
> **Estado**: Proposal
> **Stack**: Next.js, TypeScript, MongoDB Atlas, Mongoose

---

## Intent

Permitir que el técnico asignado ejecute su trabajo (OT o VT) Registrando inicio y cierre con resultado del servicio. El flujo es: asignado → en curso → completado. Solo el técnico asignado puede iniciar el trabajo.

## Scope

**In Scope:**
- Iniciar trabajo (assigned → in_progress)
- Completar trabajo con resultado obligatorio (in_progress → completed)
- Transiciones Work Order y Technical Visit
- Rollback de disponibilidad del técnico si falla el guardado
- Validación de que el técnico autenticado es el asignado

**Out of Scope:**
- Pausa/reanudación del trabajo
- Fotos o adjuntos
- Múltiples técnicos por OT/VT (ya implementado: 1 técnico)
- Firma digital del cliente

## Capabilities

| Capability | Type | Description |
|---|---|---|
| `technician-work-execution` | New | Iniciar y completar trabajo por el técnico asignado |

### Modified Capabilities
- `work-order-lifecycle`: agregar transición assigned → in_progress → completed
- (Technical Visit lifecycle similar)

## Approach

1. **Simplificar state machine**: Cambiar transición a `assigned → in_progress → completed` (sin en_route, on_site, paused)
2. **Crear endpoint `/start`** en WorkOrder y TechnicalVisit: valida técnico asignado, cambia status a in_progress, marca startedAt/startedBy, setea availability=busy
3. **Crear endpoint `/complete`**: valida resultado obligatorio (string), cambia status a completed, marca finishedAt, setea availability=available
4. **Manejo de errores**: Si falla el save, revert availability a 'available'
5. **Validación de autorización**: Solo el técnico asignado (matched por userId) puede iniciar/completar

## Affected Areas

| Path | Change |
|---|---|
| `src/operations/helpers/state-machine.ts` | Modified — simplificar transiciones |
| `src/operations/services/work-order.service.ts` | Modified — métodos start/complete |
| `src/app/api/operations/work-orders/[id]/start/route.ts` | **New** |
| `src/app/api/operations/work-orders/[id]/complete/route.ts` | **New** |
| `src/app/api/operations/technical-visits/[id]/start/route.ts` | **New** |
| `src/app/api/operations/technical-visits/[id]/complete/route.ts` | **New** |
| `src/operations/schemas/work-order.ts` | Modified — agregar startedBy |
| `src/operations/schemas/technical-visit.ts` | Modified — agregar startedAt, startedBy, finishedAt |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|
| Técnico inicia trabajo desde otra cuenta | Low | Validar userId vs assignedTechnician.userId |
| Error al guardar deja disponibilidad inconsistente | Medium | Wrap en transaction + rollback |
| Race condition al completar | Low | OCC con version field |

## Rollback Plan

Revertir cambios en state-machine y services. Los endpoints nuevos pueden deshabilitarse o eliminarse. Availability del técnico se corregirá manualmente si es necesario.

## Dependencies

- `src/operations/models/technician.ts` — availability field existente
- `src/operations/models/work-order.ts` — startedAt, startedBy existentes
- `core/auth` — para obtener userId del técnico

## Success Criteria

- [ ] Técnico puede iniciar trabajo solo si está asignado
- [ ] Solo "Resultado del servicio" es obligatorio al completar
- [ ] Si falla el guardado, technician availability vuelve a 'available'
- [ ] Flujo funciona para OT y VT
- [ ] Sin fotos/adjuntos en esta iteración