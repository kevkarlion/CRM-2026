import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { whatsappTemplateService } from '@/crm/services/whatsapp-template.service';
import type {
  CreateWhatsAppTemplateInput,
  UpdateWhatsAppTemplateInput,
  WhatsAppTemplateCategory,
} from '@/crm/types/whatsapp-template';
import { Types } from 'mongoose';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    const templates = await whatsappTemplateService.listTemplates(tenantId);
    return NextResponse.json(templates);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.language || !body.category) {
      return NextResponse.json(
        { error: 'name, language, and category are required' },
        { status: 422 }
      );
    }

    // Validate category
    const validCategories: WhatsAppTemplateCategory[] = ['TRANSACTIONAL', 'MARKETING', 'AUTHENTICATION'];
    if (!validCategories.includes(body.category)) {
      return NextResponse.json(
        { error: 'category must be TRANSACTIONAL, MARKETING, or AUTHENTICATION' },
        { status: 422 }
      );
    }

    const input: CreateWhatsAppTemplateInput = {
      tenantId: new Types.ObjectId(tenantId),
      name: body.name,
      language: body.language,
      category: body.category,
      variables: body.variables || [],
      isActive: body.isActive !== false,
      createdBy: new Types.ObjectId(body.userId || '000000000000000000000000'),
      updatedBy: new Types.ObjectId(body.userId || '000000000000000000000000'),
    };

    const result = await whatsappTemplateService.createTemplate(input);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
