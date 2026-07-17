# Tasks: Centro Operativo Comercial

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1800 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: Foundation + types + pure functions + components. PR 2: Pages + integration |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Shared types + pure business logic functions | PR 1 | Tests included. Standalone. |
| 2 | All UI components (ExecutiveSummary, WorkTray, SmartTable, etc.) | PR 1 | Depende de Unit 1. Tests incluidos. |
| 3 | Detail page rewrite (layout, action bar, timeline, version history) | PR 2 | Independiente de list page. |
| 4 | List page rewrite + barrel exports | PR 2 | Depende de Unit 2 para componentes. Test de integración. |

## Phase 1: Types and Business Logic

- [ ] 1.1 Crear `src/quotes/types/client-quote-types.ts` con QuoteTableRow, QuoteSummaryStats, WorkTrayItem, NextActionType, ExpiryBadge
- [ ] 1.2 Crear función pura `getNextAction(entity)` con reglas de negocio de la sección 3.3 de la propuesta
- [ ] 1.3 Crear función pura `getExpiryBadge(entity)` con lógica de expiración de la sección 3.2
- [ ] 1.4 Crear función pura `getStatusColor(status, entityType)` con reglas estrictas de color de la sección 3.1
- [ ] 1.5 Crear `mergeQuotesAndNegotiations(quotes, negotiations)` para unificar fuentes de datos
- [ ] 1.6 Escribir tests unitarios para las 4 funciones puras

## Phase 2: UI Components — List Page

- [ ] 2.1 Crear `src/components/quotes/indicator-card.tsx` — componente de tarjeta de estadística individual
- [ ] 2.2 Crear `src/components/quotes/executive-summary.tsx` — 4 indicator cards en fila horizontal
- [ ] 2.3 Crear `src/components/quotes/work-tray.tsx` — 3 secciones con items filtrados
- [ ] 2.4 Crear `src/components/quotes/quick-actions.tsx` — 3 botones de acción
- [ ] 2.5 Crear `src/components/quotes/expiry-badge.tsx` — badge de expiración con código de color
- [ ] 2.6 Crear `src/components/quotes/next-action-badge.tsx` — display de texto de próxima acción
- [ ] 2.7 Crear `src/components/quotes/filter-bar.tsx` — multi-select de estado, rango de fechas, búsqueda de cliente, select de asignado
- [ ] 2.8 Crear `src/components/quotes/smart-table.tsx` — contenedor de tabla con encabezado
- [ ] 2.9 Crear `src/components/quotes/smart-table-row.tsx` — fila individual con 7 columnas

## Phase 3: UI Components — Detail Page

- [ ] 3.1 Crear `src/components/quotes/detail-info-panel.tsx` — panel izquierdo con info de entidad, items, totales, términos
- [ ] 3.2 Crear `src/components/quotes/activity-timeline.tsx` — panel derecho con datos de ActivityService
- [ ] 3.3 Crear `src/components/quotes/detail-action-bar.tsx` — barra sticky bottom con botones de acción
- [ ] 3.4 Crear `src/components/quotes/version-history.tsx` — acordeón con lista de versiones

## Phase 4: Page Rewrites

- [ ] 4.1 Reescribir `src/app/(dashboard)/quotes/[id]/page.tsx` — layout dos columnas con info panel + timeline + action bar
- [ ] 4.2 Reescribir `src/app/(dashboard)/quotes/page.tsx` — Centro Operativo Comercial con 5 zonas

## Phase 5: Integration

- [ ] 5.1 Crear `src/components/quotes/index.ts` — barrel exports para todos los componentes de quotes
- [ ] 5.2 Verificar compilación TypeScript (`npx tsc --noEmit`)
- [ ] 5.3 Verificar que todos los tests existentes pasen
- [ ] 5.4 Verificar que no haya regresión en flujos de creación, edición y eliminación de quotes
