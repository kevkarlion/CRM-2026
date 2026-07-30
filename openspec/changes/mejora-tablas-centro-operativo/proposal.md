# Proposal: Mejora Tablas Centro Operativo

## Intent

Align the "Órdenes" and "Visitas" tables in Centro Operativo with the `/work-orders` page format and add remaining-days badges for scheduled execution dates. Replace card-based layouts and divergent table schemas with a consistent, information-rich tabular view across both tabs.

## Scope

### In Scope
- Reformat WorkOrderListView table to match `/work-orders` columns: Tipo, #, Título, Cliente, Estado, Prioridad, Programado, Técnico, Ver
- Same reformat for TechnicalVisitsView table
- Add source badge (OT/VT) to both tables
- Add short work-order number (last 7 chars) display
- Add remaining-days badge ("Vence en X días", "Vence hoy", "Vencido") with color coding
- Remove auto-assign button from centro-operativo context
- Make rows non-clickable — only "Ver" button navigates
- Add `daysRemaining` helper to date-utils
- Add `source` field to TechnicalVisitRow (always "technical_visit")

### Out of Scope
- Mobile card views (keep existing, update content only)
- Calendar tab changes
- Técnicos tab changes
- Filters/controls refactoring
- Backend API changes
- Tests (no existing tests for these components)

## Capabilities

### New Capabilities
- None (pure UI refactor of existing components)

### Modified Capabilities
- None (no spec-level behavior changes; implementation-only)

## Approach

1. **`date-utils.ts`**: Add `daysRemaining(scheduledDate?: string, scheduledStart?: string): { label: string; variant: string }` helper — computes days until execution and returns Spanish label + Tailwind color class
2. **`WorkOrderListView.tsx`**: Replace current columns with Tipo/short-#/Título/Cliente/Estado/Prioridad/Programado/Técnico/Ver + days badge next to Programado. Remove auto-assign column. Remove row click handler — only "Ver" button navigates via `e.stopPropagation()` + `router.push`
3. **`TechnicalVisitsView.tsx`**: Same column reformat. Add source badge (always VT purple). Add short WO# (from visitNumber, same 7-char slice). Add days badge. Remove row click handler. Add "Ver" button column.
4. **`centro-operativo.ts`**: No type changes needed — TechnicalVisitRow already has all fields except source; treated as implicit in VT tab

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/operations/helpers/date-utils.ts` | Modified | Add `daysRemaining()` helper |
| `src/operations/components/centro-operativo/WorkOrderListView.tsx` | Modified | Full table reformat, remove auto-assign, add days badge |
| `src/operations/components/centro-operativo/TechnicalVisitsView.tsx` | Modified | Full table reformat, add source badge + days badge |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Missing `source` field in WorkOrderRow data from API | Low | Already present in API response; field exists in type |
| `scheduledStart` null for many records (fallback to `scheduledDate`) | Medium | Helper handles fallback gracefully |
| Break existing mobile card behavior | Low | Mobile section updated separately, same data bindings |

## Rollback Plan

- Git revert of 3 files: `date-utils.ts`, `WorkOrderListView.tsx`, `TechnicalVisitsView.tsx`
- No DB or API changes — zero backend risk

## Dependencies

- Existing `WORK_ORDER_STATUS_VARIANT`, `WORK_ORDER_PRIORITY_VARIANT` from `@/operations/constants/status-colors`
- Existing `sourceBadge()` pattern from `/work-orders/page.tsx` (to be inlined)
- Existing `shortWO()` pattern from `/work-orders/page.tsx` (to be inlined or imported)

## Success Criteria

- [ ] Both tabs show Tipo badge (OT blue, VT purple), short #, Título, Cliente, Estado, Prioridad, Programado, Técnico, Ver button
- [ ] Remaining-days badge shows correct color: green (>7d), yellow (1-7d), red (overdue/today)
- [ ] Rows do NOT navigate on click — only "Ver" button works
- [ ] No auto-assign button in centro-operativo
- [ ] TypeScript compiles with no errors
