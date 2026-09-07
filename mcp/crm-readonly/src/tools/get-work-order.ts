import { ObjectId } from 'mongodb';
import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { COLLECTIONS, workOrderQuery } from '../collections.js';
import { getDb } from '../db.js';
import { serializeDoc } from '../serialize.js';
import { errorMessage, errorResult, textResult } from './result.js';

export const getWorkOrderInputSchema = {
  tenantId: z.string().describe('Tenant that owns the work order').optional(),
  id: z.string().describe('Work order _id (24-character hex ObjectId)').optional(),
  workOrderNumber: z.string().describe('Work order number').optional(),
  clientId: z.string().describe('Client _id the work order belongs to (24-character hex ObjectId)').optional(),
};

export interface GetWorkOrderArgs {
  tenantId?: string;
  id?: string;
  workOrderNumber?: string;
  clientId?: string;
}

function hasLookup(args: GetWorkOrderArgs): boolean {
  return args.id !== undefined || args.workOrderNumber !== undefined || args.clientId !== undefined;
}

export async function handleGetWorkOrder(args: GetWorkOrderArgs): Promise<CallToolResult> {
  if (!hasLookup(args)) {
    return errorResult('At least one of id, workOrderNumber, or clientId is required');
  }
  if (!args.tenantId) {
    return errorResult('tenantId is required');
  }
  if (args.id !== undefined && !ObjectId.isValid(args.id)) {
    return errorResult('Invalid id format');
  }
  if (args.clientId !== undefined && !ObjectId.isValid(args.clientId)) {
    return errorResult('Invalid clientId format');
  }
  if (!ObjectId.isValid(args.tenantId)) {
    return errorResult('Invalid tenantId format');
  }

  try {
    const filter = workOrderQuery(args.tenantId, {
      id: args.id,
      workOrderNumber: args.workOrderNumber,
      clientId: args.clientId,
    });
    const db = await getDb();
    const doc = await db.collection(COLLECTIONS.workOrders).findOne(filter);
    return textResult(JSON.stringify(doc ? serializeDoc(doc) : null));
  } catch (err) {
    return errorResult(`Failed to query work order: ${errorMessage(err)}`);
  }
}