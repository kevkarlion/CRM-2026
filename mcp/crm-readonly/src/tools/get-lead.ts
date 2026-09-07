import { ObjectId } from 'mongodb';
import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { COLLECTIONS, leadQuery } from '../collections.js';
import { getDb } from '../db.js';
import { serializeDoc } from '../serialize.js';
import { errorMessage, errorResult, textResult } from './result.js';

export const getLeadInputSchema = {
  tenantId: z.string().describe('Tenant that owns the lead').optional(),
  id: z.string().describe('Lead _id (24-character hex ObjectId)').optional(),
  phone: z.string().describe('Lead phone number').optional(),
  email: z.string().describe('Lead email address').optional(),
};

export interface GetLeadArgs {
  tenantId?: string;
  id?: string;
  phone?: string;
  email?: string;
}

function hasLookup(args: GetLeadArgs): boolean {
  return args.id !== undefined || args.phone !== undefined || args.email !== undefined;
}

export async function handleGetLead(args: GetLeadArgs): Promise<CallToolResult> {
  if (!hasLookup(args)) {
    return errorResult('At least one of id, phone, or email is required');
  }
  if (!args.tenantId) {
    return errorResult('tenantId is required');
  }
  if (args.id !== undefined && !ObjectId.isValid(args.id)) {
    return errorResult('Invalid id format');
  }
  if (!ObjectId.isValid(args.tenantId)) {
    return errorResult('Invalid tenantId format');
  }

  try {
    const filter = leadQuery(args.tenantId, { id: args.id, phone: args.phone, email: args.email });
    const db = await getDb();
    const doc = await db.collection(COLLECTIONS.leads).findOne(filter);
    return textResult(JSON.stringify(doc ? serializeDoc(doc) : null));
  } catch (err) {
    return errorResult(`Failed to query lead: ${errorMessage(err)}`);
  }
}