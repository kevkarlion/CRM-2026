import { ObjectId } from 'mongodb';
import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { COLLECTIONS, clientQuery } from '../collections.js';
import { getDb } from '../db.js';
import { serializeDoc } from '../serialize.js';
import { errorMessage, errorResult, textResult } from './result.js';

export const getClientInputSchema = {
  tenantId: z.string().describe('Tenant that owns the client').optional(),
  id: z.string().describe('Client _id (24-character hex ObjectId)').optional(),
  phone: z.string().describe('Client phone number').optional(),
  taxId: z.string().describe('Client tax ID (CUIT)').optional(),
};

export interface GetClientArgs {
  tenantId?: string;
  id?: string;
  phone?: string;
  taxId?: string;
}

function hasLookup(args: GetClientArgs): boolean {
  return args.id !== undefined || args.phone !== undefined || args.taxId !== undefined;
}

export async function handleGetClient(args: GetClientArgs): Promise<CallToolResult> {
  if (!hasLookup(args)) {
    return errorResult('At least one of id, phone, or taxId is required');
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
    const filter = clientQuery(args.tenantId, { id: args.id, phone: args.phone, taxId: args.taxId });
    const db = await getDb();
    const doc = await db.collection(COLLECTIONS.clients).findOne(filter);
    return textResult(JSON.stringify(doc ? serializeDoc(doc) : null));
  } catch (err) {
    return errorResult(`Failed to query client: ${errorMessage(err)}`);
  }
}