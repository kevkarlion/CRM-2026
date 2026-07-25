/**
 * Central Model Registry
 *
 * Imports ALL Mongoose models to ensure they are registered before any
 * route handler or service uses .populate('ref'). This eliminates the
 * entire class of "Schema hasn't been registered for model X" errors.
 *
 * Usage: import '@/core/models/registry'; in src/core/db.ts (connectDB)
 *        or in a Next.js middleware / layout that runs before API routes.
 *
 * Each import is a side-effect — the model file self-registers on import.
 */

// ─── Core ────────────────────────────────────────────────────────────
import './tenant';
import './user';
import './role';
import './permission';
import './user-role';
import './role-permission';
import './activity-log';
import './security-log';
import './system-log';
import './request-log';
import './platform-user';
import './platform-audit-log';
import './error-event';
import './tenant-metrics';
import './system-health';

// ─── CRM ─────────────────────────────────────────────────────────────
import './client';
import './contact';
import './location';
import './equipment';
import './service-history';
import './activity';
import './task';
import './attachment';
import './whatsapp-message';

// ─── Operations ──────────────────────────────────────────────────────
import './work-order';
import './work-order-assignment';
import './work-order-event';
import './pre-visit-checklist';
import './visit-report';
import './technician';
import './technical-visit';

// ─── Contracts ───────────────────────────────────────────────────────
import './contract';
import './contract-equipment';
import './maintenance-plan';
import './maintenance-schedule';

// ─── Leads ───────────────────────────────────────────────────────────
import './lead';
import './lead-assignment';
import './pipeline';

// ─── Quotes ──────────────────────────────────────────────────────────
import './quote';
import './quote-version';

// ─── Negotiation ─────────────────────────────────────────────────────
import './negotiation';
import './negotiation-event';

// ─── Service Types ───────────────────────────────────────────────────
import './service-type';

// ─── Timeline ────────────────────────────────────────────────────────
import './timeline-event';
