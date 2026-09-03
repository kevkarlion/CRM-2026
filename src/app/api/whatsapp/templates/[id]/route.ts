import { NextRequest, NextResponse } from 'next/server';
import { errorMessage } from '@/core/error-message';
import { whatsappTemplateService, TemplateNotFoundError } from '@/crm/services/whatsapp-template.service';
import type { UpdateWhatsAppTemplateInput, WhatsAppTemplateCategory } from '@/crm/types/whatsapp-template';
import { Types } from 'mongoose';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    const { id } = await params;

    try {
      const template = await whatsappTemplateService.getTemplate(tenantId, id);
      return NextResponse.json(template);
    } catch (error) {
      if (error instanceof TemplateNotFoundError) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }
      throw error;
    }
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, 'Internal server error') },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Validate category if provided
    if (body.category) {
      const validCategories: WhatsAppTemplateCategory[] = ['TRANSACTIONAL', 'MARKETING', 'AUTHENTICATION'];
      if (!validCategories.includes(body.category)) {
        return NextResponse.json(
          { error: 'category must be TRANSACTIONAL, MARKETING, or AUTHENTICATION' },
          { status: 422 }
        );
      }
    }

    const input: UpdateWhatsAppTemplateInput = {
      name: body.name,
      language: body.language,
      category: body.category,
      variables: body.variables,
      isActive: body.isActive,
      updatedBy: new Types.ObjectId(body.userId || '000000000000000000000000'),
    };

    // Remove undefined values
    Object.keys(input).forEach(key => {
      if (input[key as keyof UpdateWhatsAppTemplateInput] === undefined) {
        delete input[key as keyof UpdateWhatsAppTemplateInput];
      }
    });

    try {
      const result = await whatsappTemplateService.updateTemplate(tenantId, id, input);
      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof TemplateNotFoundError) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }
      throw error;
    }
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, 'Internal server error') },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    const { id } = await params;

    try {
      await whatsappTemplateService.deleteTemplate(tenantId, id);
      return NextResponse.json({ success: true });
    } catch (error) {
      if (error instanceof TemplateNotFoundError) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }
      throw error;
    }
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, 'Internal server error') },
      { status: 500 }
    );
  }
}
