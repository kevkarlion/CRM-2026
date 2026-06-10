import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';

describe('Schema Definitions', () => {
  it('tenant schema has required fields', async () => {
    const { tenantSchema } = await import('../../src/core/schemas/tenant');
    const paths = Object.keys(tenantSchema.paths);

    expect(paths).toContain('slug');
    expect(paths).toContain('name');
    expect(paths).toContain('status');
    expect(paths).toContain('deletedAt');
    expect(tenantSchema.get('timestamps')).toBe(true);
  });

  it('user schema has tenantId ref and unique email', async () => {
    const { userSchema } = await import('../../src/core/schemas/user');
    const paths = Object.keys(userSchema.paths);

    expect(paths).toContain('tenantId');
    expect(paths).toContain('email');
    expect(paths).toContain('passwordHash');
    expect(paths).toContain('failedLoginAttempts');
    expect(paths).toContain('deletedAt');
    expect(userSchema.get('timestamps')).toBe(true);
  });

  it('activity-log schema is append-only (no timestamps, no deletedAt)', async () => {
    const { activityLogSchema } = await import('../../src/core/schemas/activity-log');
    const paths = Object.keys(activityLogSchema.paths);

    expect(paths).toContain('entityType');
    expect(paths).toContain('action');
    expect(paths).toContain('actorId');
    expect(paths).toContain('timestamp');
    expect(paths).not.toContain('deletedAt');
    expect(paths).not.toContain('updatedAt');
  });

  it('request-log schema has TTL timestamp', async () => {
    const { requestLogSchema } = await import('../../src/core/schemas/request-log');
    const paths = Object.keys(requestLogSchema.paths);

    expect(paths).toContain('method');
    expect(paths).toContain('endpoint');
    expect(paths).toContain('duration');
    expect(paths).toContain('statusCode');
    expect(paths).toContain('ipAddress');
    expect(paths).not.toContain('deletedAt');
  });

  it('permission schema is global (no tenantId, no deletedAt)', async () => {
    const { permissionSchema } = await import('../../src/core/schemas/permission');
    const paths = Object.keys(permissionSchema.paths);

    expect(paths).toContain('key');
    expect(paths).toContain('group');
    expect(paths).not.toContain('tenantId');
    expect(paths).not.toContain('deletedAt');
    expect(permissionSchema.get('timestamps')).toBe(true);
  });

  it('platform-user schema is global with role enum', async () => {
    const { platformUserSchema } = await import('../../src/core/schemas/platform-user');
    const paths = Object.keys(platformUserSchema.paths);

    expect(paths).toContain('email');
    expect(paths).toContain('role');
    expect(paths).not.toContain('tenantId');
    expect(paths).toContain('deletedAt');

    const roleEnum = (platformUserSchema.paths as any).role.options.enum;
    expect(roleEnum).toContain('super_admin');
    expect(roleEnum).toContain('developer');
    expect(roleEnum).toContain('support');
  });

  it('error-event schema has severity enum and status workflow', async () => {
    const { errorEventSchema } = await import('../../src/core/schemas/error-event');
    const paths = Object.keys(errorEventSchema.paths);

    expect(paths).toContain('severity');
    expect(paths).toContain('message');
    expect(paths).toContain('status');
    expect(paths).toContain('tenantId');
    expect(paths).not.toContain('deletedAt');

    const statusEnum = (errorEventSchema.paths as any).status.options.enum;
    expect(statusEnum).toContain('open');
    expect(statusEnum).toContain('resolved');
    expect(statusEnum).toContain('dismissed');
  });
});

describe('Model Imports', () => {
  const modelNames = [
    'TenantModel',
    'UserModel',
    'RoleModel',
    'PermissionModel',
    'UserRoleModel',
    'RolePermissionModel',
    'ActivityLogModel',
    'SecurityLogModel',
    'SystemLogModel',
    'RequestLogModel',
    'PlatformUserModel',
    'PlatformAuditLogModel',
    'ErrorEventModel',
    'TenantMetricsModel',
    'SystemHealthModel',
  ];

  for (const name of modelNames) {
    it(`exports ${name}`, async () => {
      const models = await import('../../src/core/models/index');
      expect(models[name as keyof typeof models]).toBeDefined();
    });
  }
});

describe('Type Exports', () => {
  const typeNames = [
    'ITenant',
    'IUser',
    'IRole',
    'IPermission',
    'IUserRole',
    'IRolePermission',
    'IActivityLog',
    'ISecurityLog',
    'ISystemLog',
    'IRequestLog',
    'IPlatformUser',
    'IPlatformAuditLog',
    'IErrorEvent',
    'ITenantMetrics',
    'ISystemHealth',
  ];

  for (const name of typeNames) {
    it(`exports ${name} type`, async () => {
      const types = await import('../../src/core/types/index');
      expect(types[name as keyof typeof types]).toBeDefined();
    });
  }
});
