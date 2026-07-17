# SDD Proposal: centro-operativo-comercial

> **Change name**: `centro-operativo-comercial`
> **Estado**: Proposal (v1.0.0)
> **Topic key**: `sdd/centro-operativo-comercial/proposal`

---

## Intent

El módulo de Cotizaciones (Quotes) actualmente opera como un CRUD con tabla, detalle y acciones de estado. Cumple su función técnica pero no está diseñado para ayudar al operador comercial a **cerrar ventas**. La interfaz muestra datos sin priorización, el estado se comunica exclusivamente con colores que saturan visualmente, y no existe un concepto de "siguiente acción" que guíe al usuario hacia lo que debe hacer.

El objetivo de esta propuesta es rediseñar la superficie de usuario del módulo Quotes —y su integración con Negotiations— como un **Centro Operativo Comercial**: una vista unificada que le muestre al operador qué necesita atención, cuál es el siguiente paso sugerido, y dónde están las oportunidades de cierre. Quotes y Negotiations se muestran en la misma tabla pero como conceptos distintos (cotización estática vs. negociación dinámica).

Este cambio es puramente de frontend y lógica de presentación. No se modifican modelos de datos ni servicios del backend.

## Current State

### Módulo Quotes

- **`src/quotes/services/quote.service.ts`**: 995 líneas, 15 métodos. CRUD completo con transiciones de estado, versionado, y conversión a WorkOrder.
- **State machine**: `draft → sent → approved/rejected/expired/cancelled → terminal`. Definida en `src/quotes/helpers/state-machine.ts`.
- **List page** (`src/app/(dashboard)/quotes/page.tsx`): 315 líneas, componente cliente con tabla paginada mediante cursor, filtros por estado, columna de acciones.
- **Detail page** (`src/app/(dashboard)/quotes/[id]/page.tsx`): 450 líneas, componente cliente con tarjetas de información, historial de versiones y actividades.
- **API Routes**: CRUD completo en `/api/crm/quotes/*` con sub-rutas para send/approve/reject/convert/versions.

### Módulo Negotiation

- **`src/negotiation/`**: Schema, modelo, servicio (290 líneas), state machine independiente.
- **State machine**: `open → counteroffer_made → accepted/rejected/expired → terminal`.
- Vinculado a Quote solo mediante `quoteId` opcional en el schema de Negotiation.
- El servicio registra actividades via `ActivityService.create()` con `entityType: 'negotiation'`.

### Problemas identificados

1. **Sin priorización visual**: La tabla lista quotes en orden cronológico sin indicar qué requiere atención urgente.
2. **Color coding saturado**: Cada status se pinta con un color diferente en toda la interfaz, generando ruido visual sin jerarquía de importancia.
3. **Sin "siguiente acción"**: El operador debe interpretar el estado y decidir qué hacer; no hay una sugerencia de negocio.
4. **Quotes y Negotiations separados**: No existe una vista unificada; el operador debe cambiar de módulo para ver negociaciones relacionadas.
5. **Sin executive summary**: No hay indicadores rápidos de cuántas cotizaciones activas hay, cuántas negociaciones están pendientes, o cuál es la tasa de conversión.
6. **Tipos duplicados**: Las interfaces de cliente se definen independientemente en list page y detail page sin tipos compartidos.

## Proposed Changes

### 1. Nueva List Page: Centro Operativo Comercial

La página `src/app/(dashboard)/quotes/page.tsx` se reestructura completamente con 5 zonas de arriba a abajo:

#### 1.1 Executive Summary Bar

Barra horizontal con 4 indicadores calculados al vuelo desde los datos actuales:

| Indicador | Fuente | Fórmula |
|-----------|--------|---------|
| Cotizaciones activas | Quotes con status `draft` o `sent` | `count` |
| Negociaciones pendientes | Negotiations con status `open` o `counteroffer_made` | `count` |
| Tasa de conversión | Quotes con status `approved` / total de quotes enviadas (`sent` + `approved` + `rejected`) | `(approved / (sent + approved + rejected)) * 100` |
| Valor potencial total CLP | Quotes con status `draft` o `sent` | `sum(total)` formateado en CLP |

#### 1.2 Work Tray (Bandeja de Trabajo)

Sección que muestra "qué necesita tu atención ahora mismo". Filtra en 3 categorías:

- **Cotizaciones por vencer (≤7 días)**: Quotes en estado `sent` con `validUntil` entre hoy y hoy+7.
- **Negociaciones sin respuesta**: Negotiations en `counteroffer_made` (contraoferta emitida, esperando respuesta).
- **Aprobaciones recientes (últimas 24h)**: Quotes que pasaron a `approved` en las últimas 24 horas.

Cada categoría muestra hasta 3 items con enlace directo al detalle.

#### 1.3 Quick Actions Row

Barra horizontal con botones de acción:

- "Nueva Cotización" → navega a `/quotes/new`
- "Nueva Negociación" → abre drawer/modal con formulario de creación (navega a ruta de negociación)
- "Ver Calendario" → navega a `/calendar` (funcionalidad futura, placeholder)

#### 1.4 Filter Bar

Filtros compactos en una sola fila:

- **Estado**: Dropdown multi-select con checkboxes. Estados de Quote + Negotiation.
- **Rango de fechas**: Inputs from/to para `createdAt`.
- **Cliente**: Select con búsqueda (autocomplete sobre clients del tenant).
- **Asignado a**: Select con usuarios del tenant.

Los filtros se reflejan en la URL como query params para compartir/enlazar.

#### 1.5 Smart Table

Tabla unificada que muestra Quotes y Negotiations. Cada fila representa un documento cuyo tipo se distingue por un ícono sutil (no por color de fondo).

| Columna | Detalle Técnico |
|---------|-----------------|
| **Cliente** | `companyName` + `contactName`. Para quotes se obtiene de `Quote.clientId` → Client. Para negotiations de `Negotiation.leadId` → Lead/Client. |
| **Tipo** | Ícono + label: "Cotización" o "Negociación". Determinado por `entityType` (`quote` vs `negotiation`). |
| **Estado** | Label textual del status. Sin color. Badge de expiración si aplica. |
| **Total** | `total` formateado en CLP (`new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' })`). Para negotiations sin monto fijo, se muestra el monto de la última contraoferta o "—". |
| **Vencimiento** | Fecha `validUntil` + countdown textual. Solo si existe `validUntil`. |
| **Próxima Acción** | Texto calculado por reglas de negocio (ver sección 3). |
| **Asignado** | Avatar (iniciales) + nombre del usuario `createdBy` o `assignedTo`. |

### 2. Nueva Detail Page

La página `src/app/(dashboard)/quotes/[id]/page.tsx` se rediseña con:

#### 2.1 Layout de dos columnas

- **Panel izquierdo (60%)**: Información de la cotización/negociación. Título, estado, cliente, items/montos, términos.
- **Panel derecho (40%)**: Timeline de actividad. Integración con `ActivityService` para mostrar el historial completo de acciones sobre la entidad.

#### 2.2 Action Bar persistente

Barra de acciones fijada al fondo (sticky bottom) que muestra las acciones disponibles según el estado actual:

- Para quotes: Enviar, Aprobar, Rechazar, Cancelar, Convertir a OT.
- Para negotiations: Agregar contraoferta, Aceptar, Rechazar.
- Las acciones no disponibles aparecen deshabilitadas con tooltip explicativo.

#### 2.3 Version History integrado

El historial de versiones pasa a ser un acordeón colapsado por defecto dentro del panel izquierdo, no una vista separada. Al expandirse muestra la lista de versiones con fecha, autor y monto.

### 3. Business Rules

#### 3.1 Color Coding (ESTRICTAS)

| Regla | Color | Aplica a |
|-------|-------|----------|
| `validUntil` en el pasado (expirado) | **Rojo** (`#DC2626`) | Badge "Vencida" |
| `validUntil` ≤ 7 días desde hoy (por vencer) | **Naranja** (`#EA580C`) | Badge "Por vencer" |
| Status `approved` o `accepted` | **Verde** (`#16A34A`) | Texto del status label |
| Status `draft` | **Gris** (`#6B7280`) | Texto del status label |
| Cualquier otro status | Sin color | Label textual normal |

**Importante**: Los colores se usan SOLO para señales de prioridad/urgencia. El estado de una entidad se muestra como label textual SIN color a menos que entre en las reglas anteriores. No hay color coding inline para `sent`, `rejected`, `cancelled`, `open`, `counteroffer_made`, `expired` (el rojo del badge ya cubre expired).

#### 3.2 Lógica de Badge de Expiración

| Condición | Badge |
|-----------|-------|
| `validUntil < today` | "Vencida" (rojo) |
| `validUntil` entre today y today+7 | "Por vencer" (naranja) |
| `validUntil > today+7` | Sin badge |
| Status `approved` / `accepted` | Sin badge (aunque tenga `validUntil`) |
| Sin `validUntil` | Sin badge |

#### 3.3 Lógica de Próxima Acción

| Condición | Acción Sugerida |
|-----------|-----------------|
| Quote status `draft` | "Enviar cotización" |
| Quote status `sent`, sin cambios del cliente | "Dar seguimiento" |
| Quote status `sent`, con Negotiation vinculada y cambios solicitados | "Ir a negociación" |
| Quote status `approved` | "Convertir a orden de trabajo" |
| Quote status `sent` y `validUntil` ≤ 7 días | "Contactar cliente" |
| Quote status `expired` | "Revisar y re-cotizar" |
| Negotiation status `counteroffer_made` (contraoferta del lead) | "Responder contraoferta" |
| Ninguna de las anteriores | "—" (em dash) |

**Nota**: La detección de "cambios solicitados" se determina por la existencia de una Negotiation vinculada con `quoteId` igual al ID de la Quote y status `counteroffer_made`. Si existe, la acción es "Ir a negociación". Si la Negotiation vinculada está en `open` (sin contraoferta aún), se usa la regla de "Dar seguimiento" mientras no haya contraoferta.

### 4. Tipos Compartidos

Se crea `src/quotes/types/client-quote-types.ts` con los tipos que necesita la UI:

- `QuoteTableRow`: interfaz para cada fila de la smart table (combina campos de Quote y Negotiation).
- `QuoteSummaryStats`: interfaz para los 4 indicadores del executive summary.
- `WorkTrayItem`: interfaz para items de la bandeja de trabajo.
- `NextAction`: tipo string union con los valores de la sección 3.3.
- `ExpiryBadge`: tipo `{ type: 'expired' | 'expiring' | 'none'; label: string; color: string }`.

### 5. Nuevos Archivos / Modificaciones

| Archivo | Cambio |
|---------|--------|
| `src/quotes/types/client-quote-types.ts` | **CREAR** — tipos compartidos de UI |
| `src/app/(dashboard)/quotes/page.tsx` | **REESCRIBIR** — nuevo layout con 5 zonas |
| `src/app/(dashboard)/quotes/[id]/page.tsx` | **REESCRIBIR** — layout 2 columnas + action bar |
| `src/components/quotes/executive-summary.tsx` | **CREAR** — barra de indicadores |
| `src/components/quotes/work-tray.tsx` | **CREAR** — bandeja de trabajo |
| `src/components/quotes/quick-actions.tsx` | **CREAR** — barra de acciones rápidas |
| `src/components/quotes/smart-table.tsx` | **CREAR** — tabla unificada |
| `src/components/quotes/smart-table-row.tsx` | **CREAR** — fila individual con lógica de badges/next action |
| `src/components/quotes/next-action-badge.tsx` | **CREAR** — componente de próxima acción |
| `src/components/quotes/expiry-badge.tsx` | **CREAR** — badge de expiración |
| `src/components/quotes/filter-bar.tsx` | **CREAR** — barra de filtros |
| `src/components/quotes/activity-timeline.tsx` | **CREAR** — timeline de actividad (reutilizable en detail) |
| `src/components/quotes/detail-info-panel.tsx` | **CREAR** — panel izquierdo del detalle |
| `src/components/quotes/detail-action-bar.tsx` | **CREAR** — barra de acciones persistente |
| `src/components/quotes/version-history.tsx` | **CREAR** — acordeón de versiones |
| `src/components/quotes/index.ts` | **CREAR** — barrel export |

## Scope Boundaries

### In Scope

- Rediseño completo de la list page (`/quotes`) como Centro Operativo Comercial.
- Rediseño de la detail page (`/quotes/[id]`) con layout de 2 columnas y action bar.
- Executive Summary Bar con 4 indicadores calculados del lado cliente.
- Work Tray con 3 categorías de items urgentes.
- Quick Actions Row con 3 botones.
- Filter Bar con 4 filtros (estado, fecha, cliente, asignado).
- Smart Table unificada (Quotes + Negotiations).
- Color coding estricto (solo rojo/naranja/verde/gris según reglas).
- Badge de expiración con lógica de 3 estados.
- Next Action calculado por reglas de negocio (no AI).
- Tipos compartidos de UI en `src/quotes/types/client-quote-types.ts`.
- Componentes modulares en `src/components/quotes/`.
- Integración con Activity Timeline existente en la detail page.

### Out of Scope

- **Formulario de creación de Quotes**: No se rediseña. Permanece `src/app/(dashboard)/quotes/new/page.tsx`.
- **Formulario de edición de Quotes**: No se toca. Permanece `src/app/(dashboard)/quotes/[id]/edit/page.tsx`.
- **Modelos de datos del backend**: No se modifican schemas, types de Mongoose, ni servicios.
- **API Routes**: No se modifican. El frontend consume los endpoints existentes.
- **Calendar view**: El botón "Ver Calendario" es placeholder. La funcionalidad es parte de un feature futuro.
- **Rewrite del módulo Negotiation**: No se modifica el backend de Negotiation. Solo se consulta para la tabla unificada.
- **Autenticación/Permisos/RBAC**: No se modifican. Se reutiliza el middleware existente.
- **Responsive mobile**: El foco inicial es desktop. El layout debe funcionar en tablet pero no se optimiza para mobile en este cambio.
- **Exportación/Impresión**: No se implementa.
- **Notificaciones en tiempo real**: No se implementa. El usuario debe refrescar para ver cambios.

## UI/UX Changes

### Layout Structure

```
┌──────────────────────────────────────────────────────┐
│ EXECUTIVE SUMMARY BAR (4 indicators)                 │
├──────────────────────────────────────────────────────┤
│ WORK TRAY (up to 9 items in 3 categories)            │
├──────────────────────────────────────────────────────┤
│ QUICK ACTIONS ROW (3 buttons)                        │
├──────────────────────────────────────────────────────┤
│ FILTER BAR (status, date, client, assigned)          │
├──────────────────────────────────────────────────────┤
│                                                      │
│ SMART TABLE                                          │
│ ┌─────┬──────┬──────┬───────┬─────────┬──────────┐  │
│ │Cli. │Tipo  │Status│Total  │Vencim.  │Próx.Ac.  │  │
│ ├─────┼──────┼──────┼───────┼─────────┼──────────┤  │
│ │ ... │ ...  │ ...  │ ...   │ ...     │ ...      │  │
│ └─────┴──────┴──────┴───────┴─────────┴──────────┘  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Detail Page Layout

```
┌──────────────────────────────────────────────────────┐
│ ← Volver a Centro Operativo                          │
├──────────────────────────────┬───────────────────────┤
│  PANEL INFORMACIÓN (60%)    │  TIMELINE (40%)       │
│  ┌────────────────────────┐ │  ┌─────────────────┐  │
│  │ Título + Estado        │ │  │ - Enviado       │  │
│  │ Cliente + Fechas       │ │  │ - Visto         │  │
│  │ Items + Montos         │ │  │ - Contraoferta  │  │
│  │ Términos               │ │  │ - Aprobado      │  │
│  └────────────────────────┘ │  └─────────────────┘  │
│  ┌────────────────────────┐ │                       │
│  │ ▼ Historial Versiones  │ │                       │
│  │  (acordeón colapsado)  │ │                       │
│  └────────────────────────┘ │                       │
├──────────────────────────────┴───────────────────────┤
│ FLOATING ACTION BAR (sticky bottom)                  │
│ [Enviar] [Aprobar] [Rechazar] [Cancelar] [Convertir]│
└──────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
quotes/page.tsx
├── ExecutiveSummary
│   └── IndicatorCard x4
├── WorkTray
│   ├── WorkTraySection (Expiring)
│   ├── WorkTraySection (Awaiting Response)
│   └── WorkTraySection (Recently Approved)
├── QuickActions
│   ├── ActionButton ("Nueva Cotización")
│   ├── ActionButton ("Nueva Negociación")
│   └── ActionButton ("Ver Calendario")
├── FilterBar
│   ├── MultiSelectFilter (Status)
│   ├── DateRangeFilter
│   ├── SearchableSelect (Client)
│   └── Select (Assigned)
└── SmartTable
    ├── SmartTableHeader
    └── SmartTableRow xN
        ├── ClientCell
        ├── TypeCell
        ├── StatusCell (incluye ExpiryBadge)
        ├── TotalCell
        ├── ExpiryCell
        ├── NextActionBadge
        └── AssignedCell
```

### Responsive Behavior

- **Desktop (≥1024px)**: Layout completo de 5 zonas. Tabla con todas las columnas.
- **Tablet (768-1023px)**: Executive Summary se colapsa a 2x2 grid. Work Tray muestra solo 1 item por categoría. Tabla oculta columnas "Vencimiento" y "Asignado".
- **Móvil (<768px)**: Out of scope en esta fase. Se asegura que no se rompa el layout pero no se optimiza.

## Risks and Open Questions

### Risks

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| La tabla unificada Quotes+Negotiations puede tener performance issues al cargar muchos documentos | Media | Alto | Implementar paginación server-side (cursors existentes). El frontend hace dos llamadas paralelas y unifica en cliente. Si el volumen crece, migrar a un endpoint unificado. |
| Los cálculos del Executive Summary requieren múltiples queries | Alta | Medio | Agrupar en un solo endpoint `/api/crm/quotes/summary` que ejecute las agregaciones en una sola consulta. |
| Reglas de Next Action pueden volverse complejas al agregar nuevos estados | Baja | Medio | La lógica se encapsula en una función pura `getNextAction(entity)` en `client-quote-types.ts`. Fácil de extender. |
| Activity Timeline existente puede no cubrir todas las acciones de Negotiation | Media | Medio | Verificar integración actual. Si faltan eventos, agregarlos al `ActivityService` sin modificar modelos. |

### Open Questions

1. **¿Debe el Executive Summary mostrar valores en CLP siempre o respetar la moneda del tenant?** Actualmente todos los montos están en CLP. Si en el futuro se soportan múltiples monedas, el summary debería agrupar por moneda.
2. **¿La Work Tray debe ser configurable por rol/usuario?** La propuesta inicial muestra las 3 categorías fijas. Una versión futura podría permitir configurar qué secciones aparecen.
3. **¿El "asignado a" existe actualmente en Quote?** El schema tiene `createdBy` y `updatedBy` pero no un `assignedTo`. Si el negocio requiere asignación, habría que agregar el campo al schema (out of scope actual). Por ahora se usa `createdBy` como assigned.
4. **¿Negotiation se vincula a Quote mediante `quoteId` o mediante `leadId`?** Actualmente Negotiation tiene `quoteId` opcional. La propuesta asume que si una Negotiation tiene `quoteId`, se muestra vinculada. Si no tiene, aparece como negociación independiente. Confirmar si esta relación es suficiente.
5. **¿Los filtros deben persistirse en la URL o en sessionStorage?** Propuesta: URL query params (compartible, bookmarkeable). Alternativa: sessionStorage (persiste en la sesión pero no se comparte). Decidir en diseño.

## Non-goals

- No se modifican los modelos de datos Quote, QuoteVersion, Negotiation, NegotiationEvent.
- No se modifican las API routes existentes (GET/POST/PATCH/DELETE de quotes y negotiations).
- No se implementa la creación de Quotes desde el nuevo layout (se navega a la ruta existente).
- No se implementa la creación de Negotiations desde el nuevo layout (se navega a ruta existente o drawer).
- No se implementa el Calendar view (botón placeholder para feature futuro).
- No se refactoriza el backend de Negotiation (solo se consume para la tabla).
- No se modifican las páginas de creación/edición de Quotes existentes.
- No se agregan pruebas E2E en esta propuesta (se agregan en la fase de tasks).
