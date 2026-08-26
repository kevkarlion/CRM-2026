import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { whatsappTemplateService } from '@/crm/services/whatsapp-template.service';
import whatsappService from '@/crm/services/whatsapp.service';
import { normalizePhone } from '@/lib/phone';
import ClientModel from '@/crm/models/client';
import LeadModel from '@/leads/models/lead';
import { Types } from 'mongoose';

interface SendTemplateRequest {
  clientId: string;
  templateId: string;
  variableOverrides?: Record<number, string>; // Optional manual overrides { 1: "custom value", 2: "..." }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    const body = await request.json() as SendTemplateRequest;

    // Validate required fields
    if (!body.clientId || !body.templateId) {
      return NextResponse.json(
        { error: 'clientId and templateId are required' },
        { status: 422 }
      );
    }

    // Fetch client or lead
    let client = await ClientModel.findOne({
      _id: new Types.ObjectId(body.clientId),
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    }).lean();

    // If not found as client, try as lead
    if (!client) {
      const lead = await LeadModel.findOne({
        _id: new Types.ObjectId(body.clientId),
        tenantId: new Types.ObjectId(tenantId),
        deletedAt: null,
      }).lean();

      if (!lead) {
        return NextResponse.json({ error: 'Client or Lead not found' }, { status: 404 });
      }

      if (!lead.phone) {
        return NextResponse.json(
          { error: 'Lead does not have a phone number' },
          { status: 422 }
        );
      }

      // Transform lead to client-like structure
      client = {
        _id: lead._id,
        fullName: lead.name,
        phone: lead.phone,
        email: lead.email,
        notes: lead.notes,
        operationStatus: lead.status,
      };
    } else if (!client.phone) {
      return NextResponse.json(
        { error: 'Client does not have a phone number' },
        { status: 422 }
      );
    }

    // Fetch template
    let template;
    try {
      template = await whatsappTemplateService.getTemplate(tenantId, body.templateId);
    } catch (error) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Resolve variables from client data
    const clientData = await whatsappTemplateService.getClientForTemplate(tenantId, body.clientId);
    if (!clientData) {
      return NextResponse.json({ error: 'Could not load client data for template' }, { status: 500 });
    }

    // Start with resolved variables from client data
    let resolvedVariables = whatsappTemplateService.resolveVariables(template, clientData);

    // Apply manual overrides if provided (user edited values in UI)
    if (body.variableOverrides) {
      for (const [index, value] of Object.entries(body.variableOverrides)) {
        if (value && value.trim() !== '') {
          resolvedVariables[Number(index)] = value;
        }
      }
    }

    // Normalize phone number
    const normalizedPhone = normalizePhone(client.phone);

    // Send the template message
    const result = await whatsappService.sendTemplateMessage({
      tenantId,
      to: normalizedPhone,
      templateName: template.name,
      language: template.language,
      variables: resolvedVariables,
    });

    return NextResponse.json({
      success: true,
      messageId: result.message._id,
      phone: normalizedPhone,
      templateName: template.name,
      variables: resolvedVariables,
    });
  } catch (error) {
    console.error('[WhatsApp Template Send] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
