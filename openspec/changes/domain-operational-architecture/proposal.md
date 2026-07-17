# Proposal: Domain Operational Architecture

## Intent

Organize the CRM around business domains to transform from a commercial system into an integrated enterprise management platform. The Operativo domain handles work execution: from confirmed sale to technical closure.

## Scope

### In Scope
- Define Operativo domain boundaries and flow: Confirm Sale → WorkOrder → Asignación → Agenda → Ejecución → Informe Técnico → Cierre
- Enhance WorkAssignment for full audit trail (never overwrite, track all changes)
- Create Operative Dashboard with real-time metrics
- Implement Mobile First design philosophy
- Establish integration points with Comercial domain

### Out of Scope
- Postventa and Administrative domains (future phases)
- Full multi-tenant isolation refactoring
- Real-time WebSocket updates
- E2E testing

## Capabilities

### New Capabilities
- `operative-dashboard`: Real-time operational metrics, technician workload, agenda views, action reminders
- `work-assignment-audit`: Immutable audit trail for all technician assignments with history tracking
- `technician-management`: Full CRUD for technicians linked to users, with availability and zone management
- `work-report-completion`: Enhanced visit-report workflow for technical closure

### Modified Capabilities
- `work-order-management`: Add scheduling and assignment integration
- `work-order-assignment`: Add replacement history, full audit fields, status workflow

## Approach

1. **Data Model**: Enhance WorkAssignment with complete audit history (previous technician, new technician, type, reason, user, date, observations)
2. **API Layer**: Create domain services for operative operations with aggregation pipelines
3. **Dashboard**: Mobile-first React components with real-time status counters
4. **Integration**: Hook WorkOrder creation into Commercial's "Confirm Sale" trigger

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/operations/` | New | Operative domain module (models, services, routes) |
| `src/operations/models/technician.ts` | New | Technician entity linked to User |
| `src/operations/types/work-order-assignment.ts` | Modified | Add audit fields, replacement tracking |
| `src/operations/services/work-order.service.ts` | Modified | Add assignment and scheduling logic |
| `src/app/api/operations/` | New | REST endpoints for operative domain |
| `src/components/operations/` | New | Dashboard and mobile-first UI components |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Dashboard performance with large datasets | Medium | Implement pagination, caching, aggregation pipelines |
| Mobile UX complexity | Medium | Progressive enhancement, offline-first PWA |
| Cross-domain data consistency | Low | Transactional updates, eventual consistency for analytics |

## Rollback Plan

- Rollback via git: revert changes to operations module
- Database migration: drop new indexes only
- Dashboard: revert to previous route structure

## Dependencies

- Existing WorkOrder model (src/operations/models/work-order.ts)
- Existing VisitReport model (src/operations/models/visit-report.ts)
- User model for technician linking

## Success Criteria

- [ ] WorkOrder flow completes from Confirm Sale to Closure
- [ ] WorkAssignment audit trail shows complete history
- [ ] Dashboard displays: pending, urgent, delayed, unassigned, in-progress, pending-report counts
- [ ] Technician availability and daily load visible
- [ ] Mobile-first responsive design passes Core Web Vitals
- [ ] All existing WorkOrder tests pass