import { LeadModel } from '../models';

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function findDuplicates(
  tenantId: string,
  email?: string,
  companyName?: string,
): Promise<unknown[]> {
  const conditions: Record<string, unknown>[] = [];

  if (email) {
    conditions.push({
      email: { $regex: new RegExp(`^${escapeRegex(email.toLowerCase())}$`, 'i') },
    });
  }

  if (companyName) {
    conditions.push({
      companyName: { $regex: new RegExp(`^${escapeRegex(companyName.trim())}$`, 'i') },
    });
  }

  if (conditions.length === 0) return [];

  const query: Record<string, unknown> = {
    tenantId,
    deletedAt: null,
    $or: conditions,
  };

  return LeadModel.find(query).exec();
}
