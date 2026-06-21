/**
 * Central permission catalog for the CRM platform.
 *
 * Convention: {entity}.{action}
 * Actions: create, read, edit, delete, assign, approve, manage, export
 */

export const Permissions = {
  // ── Clients ────────────────────────────────────────────────
  CLIENTS_CREATE: 'clients.create',
  CLIENTS_READ: 'clients.read',
  CLIENTS_EDIT: 'clients.edit',
  CLIENTS_DELETE: 'clients.delete',

  // ── Locations ──────────────────────────────────────────────
  LOCATIONS_CREATE: 'locations.create',
  LOCATIONS_READ: 'locations.read',
  LOCATIONS_EDIT: 'locations.edit',
  LOCATIONS_DELETE: 'locations.delete',

  // ── Equipment ──────────────────────────────────────────────
  EQUIPMENT_CREATE: 'equipment.create',
  EQUIPMENT_READ: 'equipment.read',
  EQUIPMENT_EDIT: 'equipment.edit',
  EQUIPMENT_DELETE: 'equipment.delete',

  // ── Work Orders ────────────────────────────────────────────
  WORKORDERS_CREATE: 'workorders.create',
  WORKORDERS_READ: 'workorders.read',
  WORKORDERS_EDIT: 'workorders.edit',
  WORKORDERS_DELETE: 'workorders.delete',
  WORKORDERS_ASSIGN: 'workorders.assign',
  WORKORDERS_STATUS_CHANGE: 'workorders.statusChange',

  // ── Quotes ─────────────────────────────────────────────────
  QUOTES_CREATE: 'quotes.create',
  QUOTES_READ: 'quotes.read',
  QUOTES_EDIT: 'quotes.edit',
  QUOTES_DELETE: 'quotes.delete',
  QUOTES_APPROVE: 'quotes.approve',

  // ── Leads ──────────────────────────────────────────────────
  LEADS_CREATE: 'leads.create',
  LEADS_READ: 'leads.read',
  LEADS_EDIT: 'leads.edit',
  LEADS_DELETE: 'leads.delete',
  LEADS_ASSIGN: 'leads.assign',
  LEADS_STATUS_CHANGE: 'leads.statusChange',

  // ── Users (within tenant) ──────────────────────────────────
  USERS_CREATE: 'users.create',
  USERS_READ: 'users.read',
  USERS_EDIT: 'users.edit',
  USERS_DELETE: 'users.delete',

  // ── Roles (within tenant) ──────────────────────────────────
  ROLES_MANAGE: 'roles.manage',

  // ── Reports / Dashboard ────────────────────────────────────
  REPORTS_VIEW: 'reports.view',
  REPORTS_EXPORT: 'reports.export',

  // ── Settings (tenant configuration) ────────────────────────
  SETTINGS_MANAGE: 'settings.manage',
} as const;

export type PermissionKey = (typeof Permissions)[keyof typeof Permissions];

/**
 * Permission groups for UI organization.
 */
export const PermissionGroups: Record<string, PermissionKey[]> = {
  clients: [
    Permissions.CLIENTS_CREATE,
    Permissions.CLIENTS_READ,
    Permissions.CLIENTS_EDIT,
    Permissions.CLIENTS_DELETE,
  ],
  locations: [
    Permissions.LOCATIONS_CREATE,
    Permissions.LOCATIONS_READ,
    Permissions.LOCATIONS_EDIT,
    Permissions.LOCATIONS_DELETE,
  ],
  equipment: [
    Permissions.EQUIPMENT_CREATE,
    Permissions.EQUIPMENT_READ,
    Permissions.EQUIPMENT_EDIT,
    Permissions.EQUIPMENT_DELETE,
  ],
  workorders: [
    Permissions.WORKORDERS_CREATE,
    Permissions.WORKORDERS_READ,
    Permissions.WORKORDERS_EDIT,
    Permissions.WORKORDERS_DELETE,
    Permissions.WORKORDERS_ASSIGN,
    Permissions.WORKORDERS_STATUS_CHANGE,
  ],
  quotes: [
    Permissions.QUOTES_CREATE,
    Permissions.QUOTES_READ,
    Permissions.QUOTES_EDIT,
    Permissions.QUOTES_DELETE,
    Permissions.QUOTES_APPROVE,
  ],
  leads: [
    Permissions.LEADS_CREATE,
    Permissions.LEADS_READ,
    Permissions.LEADS_EDIT,
    Permissions.LEADS_DELETE,
    Permissions.LEADS_ASSIGN,
    Permissions.LEADS_STATUS_CHANGE,
  ],
  users: [
    Permissions.USERS_CREATE,
    Permissions.USERS_READ,
    Permissions.USERS_EDIT,
    Permissions.USERS_DELETE,
  ],
  roles: [Permissions.ROLES_MANAGE],
  reports: [Permissions.REPORTS_VIEW, Permissions.REPORTS_EXPORT],
  settings: [Permissions.SETTINGS_MANAGE],
};

export type TenantRoleName =
  | 'Owner'
  | 'Administrator'
  | 'Supervisor'
  | 'Dispatcher'
  | 'Technician'
  | 'Sales'
  | 'Accounting';

/**
 * Default permission sets for each tenant role.
 * Owner has all permissions. Other roles have progressively restricted access.
 */
export const RoleDefaultPermissions: Record<TenantRoleName, PermissionKey[]> = {
  Owner: Object.values(Permissions),

  Administrator: [
    ...PermissionGroups.clients,
    ...PermissionGroups.locations,
    ...PermissionGroups.equipment,
    ...PermissionGroups.workorders,
    ...PermissionGroups.quotes,
    ...PermissionGroups.leads,
    ...PermissionGroups.users,
    ...PermissionGroups.roles,
    ...PermissionGroups.reports,
    Permissions.SETTINGS_MANAGE,
  ],

  Supervisor: [
    ...PermissionGroups.clients,
    ...PermissionGroups.locations,
    ...PermissionGroups.equipment,
    Permissions.WORKORDERS_CREATE,
    Permissions.WORKORDERS_READ,
    Permissions.WORKORDERS_EDIT,
    Permissions.WORKORDERS_ASSIGN,
    Permissions.WORKORDERS_STATUS_CHANGE,
    Permissions.QUOTES_READ,
    Permissions.QUOTES_APPROVE,
    ...PermissionGroups.leads,
    Permissions.USERS_READ,
    Permissions.REPORTS_VIEW,
  ],

  Dispatcher: [
    Permissions.CLIENTS_READ,
    Permissions.LOCATIONS_READ,
    Permissions.EQUIPMENT_READ,
    Permissions.WORKORDERS_CREATE,
    Permissions.WORKORDERS_READ,
    Permissions.WORKORDERS_EDIT,
    Permissions.WORKORDERS_ASSIGN,
    Permissions.WORKORDERS_STATUS_CHANGE,
    Permissions.LEADS_CREATE,
    Permissions.LEADS_READ,
    Permissions.LEADS_EDIT,
    Permissions.LEADS_ASSIGN,
  ],

  Technician: [
    Permissions.CLIENTS_READ,
    Permissions.LOCATIONS_READ,
    Permissions.EQUIPMENT_READ,
    Permissions.WORKORDERS_READ,
    Permissions.WORKORDERS_EDIT,
    Permissions.WORKORDERS_STATUS_CHANGE,
  ],

  Sales: [
    Permissions.CLIENTS_CREATE,
    Permissions.CLIENTS_READ,
    Permissions.CLIENTS_EDIT,
    Permissions.LOCATIONS_CREATE,
    Permissions.LOCATIONS_READ,
    Permissions.LOCATIONS_EDIT,
    Permissions.EQUIPMENT_READ,
    Permissions.LEADS_CREATE,
    Permissions.LEADS_READ,
    Permissions.LEADS_EDIT,
    Permissions.QUOTES_CREATE,
    Permissions.QUOTES_READ,
    Permissions.QUOTES_EDIT,
    Permissions.REPORTS_VIEW,
  ],

  Accounting: [
    Permissions.CLIENTS_READ,
    Permissions.WORKORDERS_READ,
    Permissions.QUOTES_READ,
    Permissions.REPORTS_VIEW,
    Permissions.REPORTS_EXPORT,
  ],
};
