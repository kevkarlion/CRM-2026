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
import '@/core/models/tenant';
import '@/core/models/user';
import '@/core/models/role';
import '@/core/models/permission';
import '@/core/models/user-role';
import '@/core/models/role-permission';
import '@/core/models/activity-log';
import '@/core/models/security-log';
import '@/core/models/system-log';
import '@/core/models/request-log';
import '@/core/models/platform-user';
import '@/core/models/platform-audit-log';
import '@/core/models/error-event';
import '@/core/models/tenant-metrics';
import '@/core/models/system-health';

// ─── CRM ─────────────────────────────────────────────────────────────
import '@/crm/models/client';
import '@/crm/models/contact';
import '@/crm/models/location';
import '@/crm/models/equipment';
import '@/crm/models/service-history';
import '@/crm/models/activity';
import '@/crm/models/task';
import '@/crm/models/attachment';
import '@/crm/models/whatsapp-message';

// ─── Operations ──────────────────────────────────────────────────────
import '@/operations/models/work-order';
import '@/operations/models/work-order-assignment';
import '@/operations/models/work-order-event';
import '@/operations/models/pre-visit-checklist';
import '@/operations/models/technician';
import '@/operations/models/technical-visit';
import '@/operations/models/work-report';

// ─── Contracts ───────────────────────────────────────────────────────
import '@/contracts/models/contract';
import '@/contracts/models/contract-equipment';
import '@/contracts/models/maintenance-plan';
import '@/contracts/models/maintenance-schedule';

// ─── Leads ───────────────────────────────────────────────────────────
import '@/leads/models/lead';
import '@/leads/models/lead-assignment';
import '@/leads/models/pipeline';

// ─── Quotes ──────────────────────────────────────────────────────────
import '@/quotes/models/quote';
import '@/quotes/models/quote-version';

// ─── Remitos ─────────────────────────────────────────────────────────
import '@/remitos/models/remito';

// ─── Negotiation ─────────────────────────────────────────────────────
import '@/negotiation/models/negotiation';
import '@/negotiation/models/negotiation-event';

// ─── Service Types ───────────────────────────────────────────────────
import '@/service-types/models/service-type';

// ─── Conversation ──────────────────────────────────────────────────
import '@/conversation/models/conversation';

// ─── Timeline ────────────────────────────────────────────────────────
import '@/timeline/models/timeline-event';
