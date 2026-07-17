# Design: Centro Operativo Comercial

> **Change name**: `centro-operativo-comercial`
> **Estado**: Design (v1.0.0)
> **Topic key**: `sdd/centro-operativo-comercial/design`
> **Basado en**: `sdd-centro-operativo-comercial-spec.md` v1.0.0

---

## Technical Approach

Cambio puramente frontend que transforma la list page de Quotes en un Centro Operativo Comercial con 5 zonas (Executive Summary, Work Tray, Quick Actions, Filter Bar, Smart Table) y rediseña la detail page con layout de dos columnas y action bar sticky. No se modifican modelos, servicios ni API routes del backend. Los datos se obtienen mediante llamadas paralelas a los endpoints existentes (`/api/crm/quotes` y `/api/crm/negotiations`) y se unifican del lado cliente con funciones puras. El estado de filtros se refleja en URL search params para compartir/enlazar. Componentes modulares en `src/components/quotes/` con barrel export.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|-------------|-----------|
| State management | React state + URL params | Redux, Zustand | El cambio es presentacional, sin estado complejo compartido entre rutas. URL params permiten bookmarking y compartición. |
| Data fetching | Llamadas paralelas, unificación cliente | Endpoint unificado backend | Evita cambios en backend. Los endpoints existentes (`/api/crm/quotes`, `/api/crm/negotiations`) ya soportan filtros y paginación. |
| Component location | `src/components/quotes/` | `src/quotes/components/` | Sigue el patrón existente del proyecto: `src/components/` para UI compartida, `src/quotes/` para lógica de negocio y tipos. |
| Shared types | `src/quotes/types/client-quote-types.ts` | Inline por componente | DRY; única fuente de verdad para `QuoteTableRow`, `SummaryStats`, `WorkTrayItem`, `NextAction`, `ExpiryBadge`. |
| Pure business logic | Funciones puras en `client-quote-types.ts` | Dentro de componentes | Testeable unitariamente sin renderizar componentes. Separación de concerns: lógica ≠ presentación. |
| Filter persistence | URL search params (`useSearchParams`) | sessionStorage, estado React | Compartible, bookmarkeable, consistente con navegación browser (back/forward). |
| Table virtualization | No en v1, considerar en v2 | virtualización con `react-window` | El volumen actual no lo justifica. Si supera 200 filas, migrar a `@tanstack/react-virtual`. |
| Detail page layout | CSS Grid `grid-cols-3` con `col-span-2` | Flexbox, CSS Grid custom | Sigue el patrón existente en `src/app/(dashboard)/quotes/[id]/page.tsx:271` que ya usa `grid grid-cols-1 lg:grid-cols-3 gap-6`. |
| API client | `api.get<T>(path, params)` existente | fetch directo, axios | Ya existe y es usado en todo el proyecto. Maneja auth token, JSON, y errores. |
| Date formatting | `formatDateShort` + lógica ad-hoc | date-fns, dayjs | `formatDateShort` ya existe en `@/lib/format-date`. Para countdowns textuales se usa lógica inline con `Date.now()`. |
| Currency formatting | `Intl.NumberFormat('es-CL',...)` | Librería externa | Ya se usa en list page y detail page existentes. Sin dependencias adicionales. |

## Data Flow

### Executive Summary

```
page mount
  │
  ├─ api.get('/api/crm/quotes', { status: 'draft,sent', limit: '1' }) → total count
  │     └─ calculate: activeQuotes = total
  │     └─ calculate: potentialValue = sum of totals from all draft+sent (segunda llamada)
  │
  ├─ api.get('/api/crm/negotiations', { status: 'open,counteroffer_made', limit: '1' }) → total count
  │     └─ calculate: pendingNegotiations = total
  │
  └─ api.get('/api/crm/quotes', { status: 'sent,approved,rejected', limit: '1' }) → total count
        └─ calculate: conversionRate = approvedCount / (sent + approved + rejected) * 100
```

**Nota**: Para `potentialValue` y `conversionRate` se requieren datos agregados que el endpoint actual no provee. La propuesta de mitigación (risk #2) sugiere crear `/api/crm/quotes/summary`. Mientras no exista, se obtienen todas las quotes de los estados relevantes y se calculan del lado cliente.

### Smart Table

```
page mount
  │
  ├─ api.get('/api/crm/quotes', { status, dateFrom, dateTo, clientId, createdBy, cursor }) → { data: Quote[], cursor?, total }
  │
  └─ api.get('/api/crm/negotiations', { status, dateFrom, dateTo, leadId, createdBy, cursor }) → { data: Negotiation[], cursor?, total }
        │
        └─ useMemo → mergeQuotesAndNegotiations(quotes, negotiations) → QuoteTableRow[]
              └─ .sort((a, b) => b.createdAt - a.createdAt)
              └─ SmartTable renderiza rows
```

Filtros compartidos: `status` se filtra del lado cliente (los endpoints existentes filtran solo por sus propios estados). `dateFrom`/`dateTo` se pasa a ambos endpoints como filtro de `createdAt`. `clientId` aplica a Quotes como `clientId` y a Negotiations como `leadId`. `createdBy` aplica a ambos.

### Detail Page

```
page mount (/quotes/[id])
  │
  ├─ api.get(`/api/crm/quotes/${id}`) → { quote, currentVersion }
  │     └─ DetailInfoPanel: info principal + items + términos
  │
  ├─ api.get(`/api/crm/quotes/${id}/versions`) → QuoteVersion[]
  │     └─ VersionHistory: acordeón colapsado
  │
  └─ ActivityService.findByEntity('quote', id, tenantId) → ITimelineActivity[]
        └─ ActivityTimeline: panel derecho ordenado por createdAt DESC
```

Para Negotiations, el endpoint base será `/api/crm/negotiations/${id}` con la misma estructura.

## Component Tree

```
quotes/page.tsx
├── ExecutiveSummary
│   └── IndicatorCard x4
├── WorkTray
│   ├── WorkTraySection (expiring)
│   ├── WorkTraySection (awaiting_response)
│   └── WorkTraySection (recently_approved)
├── QuickActions
├── FilterBar
│   ├── MultiSelectFilter (status)
│   ├── DateRangeFilter (dateFrom, dateTo)
│   ├── SearchableSelect (client)
│   └── Select (assigned)
└── SmartTable
    ├── SmartTableHeader
    └── SmartTableRow xN
        ├── ClientCell
        ├── TypeCell
        ├── StatusCell
        │   └── ExpiryBadge (condicional)
        ├── TotalCell
        ├── ExpiryCell
        ├── NextActionBadge
        └── AssignedCell

quotes/[id]/page.tsx
├── BackNavigation ("← Volver a Centro Operativo")
├── div.grid-cols-3
│   ├── div.col-span-2
│   │   ├── DetailInfoPanel
│   │   └── VersionHistory (acordeón)
│   └── div.col-span-1
│       └── ActivityTimeline
└── DetailActionBar (sticky bottom)
```

## UI State Machines

### FilterBar → URL Search Params

```
URL query params:
  ?status=draft,sent&dateFrom=2026-01-01&dateTo=2026-06-30&clientId=abc&assignedTo=xyz

useSearchParams() → FilterState
  │
  ├─ status: string[] (multi-select, coma-separados en URL)
  ├─ dateFrom: string | null
  ├─ dateTo: string | null
  ├─ clientId: string | null
  └─ assignedTo: string | null
        │
        └─ useEffect → fetchQuotes(true), fetchNegotiations(true)
```

### DetailActionBar → acciones por estado

```
Quote estados y acciones disponibles:

┌──────────────┬──────────┬──────────┬───────────┬───────────┬──────────────┐
│ Estado       │ Enviar   │ Aprobar  │ Rechazar  │ Cancelar  │ Convertir OT │
├──────────────┼──────────┼──────────┼───────────┼───────────┼──────────────┤
│ draft        │ ✅       │ ❌       │ ❌        │ ✅       │ ❌           │
│ sent         │ ❌       │ ✅       │ ✅        │ ✅       │ ❌           │
│ approved     │ ❌       │ ❌       │ ❌        │ ❌       │ ✅           │
│ rejected     │ ❌       │ ❌       │ ❌        │ ❌       │ ❌           │
│ expired      │ ❌       │ ❌       │ ❌        │ ❌       │ ❌           │
│ cancelled    │ ❌       │ ❌       │ ❌        │ ❌       │ ❌           │
└──────────────┴──────────┴──────────┴───────────┴───────────┴──────────────┘

Negotiation estados y acciones disponibles:

┌──────────────────┬──────────────────────┬──────────┬───────────┐
│ Estado           │ Add Counteroffer     │ Accept   │ Reject    │
├──────────────────┼──────────────────────┼──────────┼───────────┤
│ open             │ ✅                   │ ❌       │ ❌        │
│ counteroffer_made│ ✅                   │ ✅       │ ✅        │
│ accepted         │ ❌                   │ ❌       │ ❌        │
│ rejected         │ ❌                   │ ❌       │ ❌        │
│ expired          │ ❌                   │ ❌       │ ❌        │
└──────────────────┴──────────────────────┴──────────┴───────────┘
```

## File Changes

| File | Action | Lines (est.) | Description |
|------|--------|-------------|-------------|
| `src/quotes/types/client-quote-types.ts` | Create | 80 | Tipos compartidos: QuoteTableRow, QuoteSummaryStats, WorkTrayItem, NextAction, ExpiryBadge + funciones puras |
| `src/app/(dashboard)/quotes/page.tsx` | Rewrite | 350 | Nuevo layout con 5 zonas: ExecutiveSummary, WorkTray, QuickActions, FilterBar, SmartTable |
| `src/app/(dashboard)/quotes/[id]/page.tsx` | Rewrite | 400 | Layout 2 columnas + action bar sticky + version history + activity timeline |
| `src/components/quotes/executive-summary.tsx` | Create | 50 | Barra horizontal con 4 IndicatorCard |
| `src/components/quotes/indicator-card.tsx` | Create | 40 | Card individual tipo MetricCard (label + valor) |
| `src/components/quotes/work-tray.tsx` | Create | 100 | Contenedor de 3 secciones con items |
| `src/components/quotes/quick-actions.tsx` | Create | 60 | Botones: Nueva Cotización, Nueva Negociación, Ver Calendario |
| `src/components/quotes/filter-bar.tsx` | Create | 130 | 4 filtros que actualizan URL search params |
| `src/components/quotes/smart-table.tsx` | Create | 120 | Tabla con header + rows, responsive column hiding |
| `src/components/quotes/smart-table-row.tsx` | Create | 90 | Fila con TypeCell, StatusCell + ExpiryBadge, TotalCell, NextActionBadge |
| `src/components/quotes/next-action-badge.tsx` | Create | 50 | Badge de próxima acción |
| `src/components/quotes/expiry-badge.tsx` | Create | 50 | Badge de expiración (rojo/naranja) |
| `src/components/quotes/activity-timeline.tsx` | Create | 80 | Timeline vertical de actividad |
| `src/components/quotes/detail-info-panel.tsx` | Create | 120 | Panel izquierdo con info principal |
| `src/components/quotes/detail-action-bar.tsx` | Create | 80 | Barra sticky bottom con acciones |
| `src/components/quotes/version-history.tsx` | Create | 60 | Acordeón de versiones |
| `src/components/quotes/index.ts` | Create | 20 | Barrel export |

**Total estimado**: ~1800 líneas nuevas | 2 archivos reescritos | 14 archivos creados

## Key Interfaces

```typescript
// ── src/quotes/types/client-quote-types.ts ──

export type NextActionType =
  | 'send_quote'
  | 'follow_up'
  | 'go_to_negotiation'
  | 'convert_to_work_order'
  | 'contact_client'
  | 'review_and_requote'
  | 'respond_counteroffer'
  | 'none';

export const NEXT_ACTION_LABELS: Record<NextActionType, string> = {
  send_quote: 'Enviar cotización',
  follow_up: 'Dar seguimiento',
  go_to_negotiation: 'Ir a negociación',
  convert_to_work_order: 'Convertir a orden de trabajo',
  contact_client: 'Contactar cliente',
  review_and_requote: 'Revisar y re-cotizar',
  respond_counteroffer: 'Responder contraoferta',
  none: '—',
};

export type ExpiryBadgeType = 'expired' | 'expiring' | 'none';

export interface ExpiryBadge {
  type: ExpiryBadgeType;
  label: string;
  color: string;
}

export interface QuoteTableRow {
  id: string;
  entityType: 'quote' | 'negotiation';
  number?: string;
  clientName: string;
  companyName?: string;
  status: string;
  total: number | null;
  validUntil: string | null;
  createdAt: string;
  updatedAt: string;
  nextAction: NextActionType;
  expiryBadge: ExpiryBadge | null;
  assignedName: string;
  leadName?: string;
  // Negotiation-specific
  lastCounterofferAmount?: number | null;
  relatedQuoteId?: string | null;
}

export interface QuoteSummaryStats {
  activeQuotes: number;
  pendingNegotiations: number;
  conversionRate: string;
  potentialValue: string;
}

export type WorkTrayCategory = 'expiring' | 'awaiting_response' | 'recently_approved';

export interface WorkTrayItem {
  id: string;
  entityType: 'quote' | 'negotiation';
  title: string;
  subtitle: string;
  url: string;
  category: WorkTrayCategory;
}

// ── Pure business logic functions ──

export function getNextAction(
  entityType: 'quote' | 'negotiation',
  status: string,
  validUntil: string | null,
  hasNegotiationWithCounteroffer: boolean,
): NextActionType;

export function getExpiryBadge(
  status: string,
  validUntil: string | null,
): ExpiryBadge | null;

export function getStatusColor(
  status: string,
  entityType: string,
): string | null;

export function mergeQuotesAndNegotiations(
  quotes: Quote[],
  negotiations: Negotiation[],
  clientMap: Map<string, { companyName: string; contactName: string }>,
  userMap: Map<string, string>,
  negotiationQuoteMap: Map<string, boolean>,
): QuoteTableRow[];
```

## Business Logic Functions

### `getNextAction(entityType, status, validUntil, hasNegotiationWithCounteroffer): NextActionType`

```
if entityType === 'quote':
  if status === 'draft'                               → 'send_quote'
  if status === 'approved'                            → 'convert_to_work_order'
  if status === 'expired'                             → 'review_and_requote'
  if status === 'sent':
    if validUntil && validUntil <= today+7             → 'contact_client'
    if hasNegotiationWithCounteroffer                  → 'go_to_negotiation'
    else                                               → 'follow_up'
if entityType === 'negotiation':
  if status === 'counteroffer_made'                   → 'respond_counteroffer'
return 'none'
```

### `getExpiryBadge(status, validUntil): ExpiryBadge | null`

```
if status === 'approved' o 'accepted'                  → null
if !validUntil                                          → null
if validUntil < today                                   → { type: 'expired', label: 'Vencida', color: '#DC2626' }
if validUntil <= today+7                                → { type: 'expiring', label: 'Por vencer en N días', color: '#EA580C' }
return null  // validUntil > today+7
```

### `getStatusColor(status, entityType): string | null`

```
if status === 'approved' o 'accepted'                   → '#16A34A' (verde)
if status === 'draft'                                   → '#6B7280' (gris)
return null  // sin color para los demás
```

### `mergeQuotesAndNegotiations(quotes, negotiations, ...): QuoteTableRow[]`

```
1. Transformar cada Quote a QuoteTableRow
2. Transformar cada Negotiation a QuoteTableRow
3. Concatenar arrays
4. Ordenar por createdAt DESC
5. Retornar
```

## Responsive Behavior

| Viewport | Executive Summary | Work Tray | Smart Table |
|----------|------------------|-----------|-------------|
| ≥1024px | Row horizontal 4 cards | 3 secciones, max 3 items c/u | Todas las columnas |
| 768-1023px | Grid 2x2 | 1 item por sección | Oculta columnas Vencimiento y Asignado |
| <768px | Grid 2x2, texto más pequeño | 1 item por sección | Card view (lista, no tabla) |

## Testing Strategy

| Tipo | Coverage | Archivos |
|------|----------|----------|
| Unit tests (pure functions) | `getNextAction` (8 reglas), `getExpiryBadge` (5 casos), `getStatusColor` (3 casos), `mergeQuotesAndNegotiations` | `src/quotes/types/__tests__/client-quote-types.test.ts` |
| Component tests | `SmartTableRow` en estados draft, sent, approved, expired, counteroffer | `src/components/quotes/__tests__/smart-table-row.test.tsx` |
| Component tests | `ExpiryBadge` expirado, por vencer, sin badge | `src/components/quotes/__tests__/expiry-badge.test.tsx` |
| Component tests | `IndicatorCard` con valores, sin datos | `src/components/quotes/__tests__/indicator-card.test.tsx` |
| Component tests | `DetailActionBar` con acciones habilitadas/deshabilitadas | `src/components/quotes/__tests__/detail-action-bar.test.tsx` |
| Integration (no E2E) | Se omite en esta fase | N/A |

## Implementation Order

| Fase | Archivos | Depende de |
|------|----------|-----------|
| 1. Shared types | `client-quote-types.ts`, `__tests__/client-quote-types.test.ts` | Nada |
| 2. Pure components | `indicator-card.tsx`, `expiry-badge.tsx`, `next-action-badge.tsx` | Fase 1 |
| 3. Container components | `executive-summary.tsx`, `work-tray.tsx`, `quick-actions.tsx`, `smart-table.tsx`, `smart-table-row.tsx`, `filter-bar.tsx` | Fase 2 |
| 4. Detail components | `detail-info-panel.tsx`, `detail-action-bar.tsx`, `activity-timeline.tsx`, `version-history.tsx` | Fase 1 |
| 5. Pages | `quotes/page.tsx`, `quotes/[id]/page.tsx` | Fases 3, 4 |
| 6. Barrel | `index.ts` | Fases 2-4 |

## Dependencies

| Dependencia | Uso | Ya existe |
|-------------|-----|-----------|
| `@/lib/api-client` | Llamadas HTTP a endpoints | Sí |
| `@/lib/format-date` | Formateo de fechas (`formatDateShort`) | Sí |
| `@/lib/components/Drawer` | Drawer para nueva negociación | Sí |
| `next/navigation` (`useRouter`, `useSearchParams`, `useParams`) | Navegación y filtros URL | Sí |
| `@/quotes/types/quote` | `IQuote`, `QuoteStatus` | Sí |
| `@/negotiation/types/negotiation` | `INegotiation`, `NegotiationStatus` | Sí |
| `@/activity/services/activity.service` | Timeline en detail page | Sí (backend) |

## Risks and Mitigations

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Executive Summary requiere 3+ llamadas API | Alta | Medio | Crear endpoint `/api/crm/quotes/summary` que ejecute agregaciones en una sola consulta. Hasta entonces, tolerar latencia de 3 llamadas paralelas. |
| Smart Table con 200+ filas sin virtualización | Baja | Alto | Monitorear performance. Si supera 200 filas, implementar `@tanstack/react-virtual` en la tabla. |
| Negotiation no tiene `assignedTo` | Alta | Bajo | Usar `createdBy` como proxy. Documentar como deuda técnica. |
| Filtro `clientId` no existe en endpoint de Negotiations | Media | Medio | Los filtros de cliente se aplican del lado cliente post-merge, no como query param. |
