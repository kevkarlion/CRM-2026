/**
 * Flow Selector - Selects the appropriate flow based on contact type
 * 
 * Determines whether to use Lead Qualification Flow (new contacts) or
 * Customer Service Flow (existing clients) based on phone number lookup.
 */

import { connectDB } from '@/core/db';
import ClientModel from '@/crm/models/client';
import LeadModel from '@/leads/models/lead';
import { Types } from 'mongoose';
import { LEAD_QUALIFICATION_FLOW, CUSTOMER_SERVICE_FLOW } from './config';
import type { FlowConfig } from './types';

/**
 * Select the appropriate flow configuration based on phone number
 * 
 * @param phone - The phone number to lookup
 * @param tenantId - The tenant ID for the lookup
 * @returns FlowConfig - The selected flow configuration
 */
export async function selectFlow(phone: string, tenantId: string): Promise<FlowConfig> {
  try {
    await connectDB();

    // Normalize phone: remove common formatting chars and leading zeros
    const normalizedPhone = phone.replace(/[\s\-\(\)\+]/g, '').replace(/^0/, '');

    // Check if phone belongs to a Client
    const client = await ClientModel.findOne({
      tenantId: new Types.ObjectId(tenantId),
      phone: { $regex: new RegExp(normalizedPhone.replace(/^\+/, ''), 'i') },
      deletedAt: null,
    });

    if (client) {
      console.log('[FlowSelector] ✅ Client found in Clients table:', client.name || client._id, '| using customer_service_flow');
      return CUSTOMER_SERVICE_FLOW;
    }

    // Check if lead exists and is won/qualified (meaning it's already a customer)
    const lead = await LeadModel.findOne({
      tenantId: new Types.ObjectId(tenantId),
      phone: { $regex: new RegExp(normalizedPhone.replace(/^\+/, ''), 'i') },
      deletedAt: null,
    });

    // If lead is won/qualified, treat as customer
    if (lead && (lead.status === 'won' || lead.status === 'qualified')) {
      console.log('[FlowSelector] ✅ Lead is won/qualified:', lead.name, '| treating as customer');
      return CUSTOMER_SERVICE_FLOW;
    }

    if (lead) {
      console.log('[FlowSelector] Lead found but status is:', lead.status, '| using lead_qualification_flow');
    } else {
      console.log('[FlowSelector] No client or lead found for phone:', normalizedPhone);
    }
    
    return LEAD_QUALIFICATION_FLOW;
  } catch (error) {
    console.error('[FlowSelector] Error:', error);
    // Fallback to lead flow on error
    return LEAD_QUALIFICATION_FLOW;
  }
}