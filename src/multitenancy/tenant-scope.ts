import { FilterQuery, Model } from 'mongoose';

/**
 * Builds a standard tenant-scoped query filter.
 *
 * - Adds `tenantId` filter for logical multitenancy isolation.
 * - By default excludes soft-deleted records (`deletedAt: null`).
 * - Pass `includeDeleted: true` to include soft-deleted records (admin use).
 */
export function tenantScope<T>(
  tenantId: string,
  includeDeleted = false
): FilterQuery<T> {
  const scope: FilterQuery<T> = { tenantId } as unknown as FilterQuery<T>;

  if (!includeDeleted) {
    scope.deletedAt = null;
  }

  return scope;
}

/**
 * Counts documents scoped to a tenant, excluding soft-deleted records.
 */
export async function countByTenant<T>(
  model: Model<T>,
  tenantId: string,
  filter: FilterQuery<T> = {}
): Promise<number> {
  return model.countDocuments({
    ...filter,
    ...tenantScope<T>(tenantId),
  });
}

/**
 * Finds documents scoped to a tenant, excluding soft-deleted records.
 */
export async function findByTenant<T>(
  model: Model<T>,
  tenantId: string,
  filter: FilterQuery<T> = {},
  options?: { skip?: number; limit?: number; sort?: Record<string, 1 | -1> }
): Promise<T[]> {
  const query = model.find({
    ...filter,
    ...tenantScope<T>(tenantId),
  });

  if (options?.sort) query.sort(options.sort);
  if (options?.skip) query.skip(options.skip);
  if (options?.limit) query.limit(options.limit);

  return query.exec();
}

/**
 * Finds a single document within a tenant scope.
 */
export async function findOneByTenant<T>(
  model: Model<T>,
  tenantId: string,
  filter: FilterQuery<T> = {}
): Promise<T | null> {
  return model.findOne({
    ...filter,
    ...tenantScope<T>(tenantId),
  }).exec();
}
