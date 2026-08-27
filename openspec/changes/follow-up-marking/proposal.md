# Proposal: Sistema de Marcado para Seguimiento

## Intent

El problema actual es que los administradores del CRM no tienen una forma estandarizada de marcar leads o clientes que requieren atención especial para un seguimiento específico. Actualmente, este seguimiento se maneja de manera informal (notas,-recordatorios externos), lo que genera falta de visibilidad y seguimiento inconsistente. Esta funcionalidad permitirá asignar tarjetas del pipeline a usuarios específicos para seguimiento, creando un flujo de trabajo claro y trazable.

## Scope

### In Scope
- Modal para marcar tarjetas de leads o clientes desde la vista de pipeline
- Selector de usuario destinatario del seguimiento
- Indicador visual (🟡) en las tarjetas marcadas
- Nueva página `/atencion` para ver tarjetas asignadas al usuario actual
- Funcionalidad para ver detalles y desmarcar tarjetas
- Persistencia en base de datos del marcado

### Out of Scope
- Notificaciones automáticas por email o WhatsApp
- Historial de modificaciones del marcado
- Múltiples estados de seguimiento (solo "Seguimiento")
- Reglas automáticas de asignación
- Integración con calendario o recordatorios

## Capabilities

### New Capabilities
- `follow-up-marking`: Sistema de marcado de tarjetas para seguimiento por usuario específico

### Modified Capabilities
- Ninguno por el momento — es una funcionalidad nueva independiente

## Approach

Se creará un nuevo modelo `FollowUpMark` que relacionará:
- `targetType`: 'lead' | 'client'
- `targetId`: ID del lead o cliente marcado
- `assignedTo`: Usuario designado para el seguimiento
- `markedBy`: Usuario que realizó el marcado
- `tenantId`: Organización

La implementación incluirá:
1. Nuevo modelo Mongoose en `src/follow-up/models/follow-up-mark.ts`
2. API routes para crear, listar y eliminar marcados
3. Componente de modal para el pipeline
4. Página `/atencion` con listado de tarjetas asignadas
5. Indicador visual en las cards del pipeline

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/follow-up/models/` | New | Modelo FollowUpMark |
| `src/follow-up/routes/` | New | API endpoints CRUD |
| `src/leads/components/` | Modified | Card con indicador de seguimiento |
| `src/clients/components/` | Modified | Card con indicador de seguimiento |
| `app/atencion/page.tsx` | New | Página de atención al usuario |
| `src/core/models/user.ts` | ReadOnly | Referencia a usuario |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Performance en listados grandes | Medium | Índices compuestos en modelo + paginación |
| Conflictos si se elimina lead/client | Low | Validación al mostrar, limpiar huérfanos |
| Accesibilidad del modal | Low |ARIA labels, navegación por teclado |

## Rollback Plan

1. Revertir migración de base de datos (eliminar colección `followupmarks`)
2. Eliminar archivos de la carpeta `src/follow-up/`
3. Revertir cambios en componentes de pipeline
4. Eliminar página `/atencion`
5. Desplegar versión anterior

## Dependencies

- Usuario existente en sistema (modelo User de `src/core/models/user.ts`)
- Pipeline views existentes (`/leads/pipeline`, `/clients`)

## Success Criteria

- [ ] Un admin puede marcar cualquier lead o cliente para seguimiento
- [ ] El usuario asignado ve sus tarjetas en `/atencion`
- [ ] Las tarjetas marcadas muestran indicador 🟡 en el pipeline
- [ ] Un usuario puede desmarcar una tarjeta
- [ ] La funcionalidad funciona para leads y clientes
