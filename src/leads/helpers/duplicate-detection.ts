import { LeadModel } from '../models';
import { normalizePhone } from '@/lib/phone';

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function findDuplicates(
  tenantId: string,
  email?: string,
  companyName?: string,
  phone?: string,
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

  if (phone) {
    const normalized = normalizePhone(phone);
    conditions.push({ phone: normalized });
  }

  if (conditions.length === 0) return [];

  const query: Record<string, unknown> = {
    tenantId,
    deletedAt: null,
    $or: conditions,
  };

  return LeadModel.find(query).exec();
}
