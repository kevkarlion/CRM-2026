import { Types } from 'mongoose';
import WhatsAppTemplateModel from '../models/whatsapp-template';
import ClientModel from '../models/client';
import LeadModel from '@/leads/models/lead';
import type {
  IWhatsAppTemplate,
  CreateWhatsAppTemplateInput,
  UpdateWhatsAppTemplateInput,
} from '../types/whatsapp-template';

export class TemplateNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TemplateNotFoundError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class WhatsAppTemplateService {
  /**
   * List all templates for a tenant
   */
  async listTemplates(tenantId: string): Promise<IWhatsAppTemplate[]> {
    return WhatsAppTemplateModel.find({
      tenantId: new Types.ObjectId(tenantId),
      isActive: true,
    })
      .sort({ name: 1 })
      .lean();
  }

  /**
   * Get a single template by ID
   */
  async getTemplate(tenantId: string, templateId: string): Promise<IWhatsAppTemplate> {
    const template = await WhatsAppTemplateModel.findOne({
      _id: new Types.ObjectId(templateId),
      tenantId: new Types.ObjectId(tenantId),
    }).lean();

    if (!template) {
      throw new TemplateNotFoundError(`Template not found: ${templateId}`);
    }

    return template;
  }

  /**
   * Create a new template
   */
  async createTemplate(input: CreateWhatsAppTemplateInput): Promise<IWhatsAppTemplate> {
    const template = new WhatsAppTemplateModel(input);
    await template.save();
    return template.toObject();
  }

  /**
   * Update an existing template
   */
  async updateTemplate(
    tenantId: string,
    templateId: string,
    input: UpdateWhatsAppTemplateInput
  ): Promise<IWhatsAppTemplate> {
    const template = await WhatsAppTemplateModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(templateId),
        tenantId: new Types.ObjectId(tenantId),
      },
      { $set: input },
      { new: true }
    );

    if (!template) {
      throw new TemplateNotFoundError(`Template not found: ${templateId}`);
    }

    return template.toObject();
  }

  /**
   * Delete a template (hard delete)
   */
  async deleteTemplate(tenantId: string, templateId: string): Promise<void> {
    const result = await WhatsAppTemplateModel.deleteOne({
      _id: new Types.ObjectId(templateId),
      tenantId: new Types.ObjectId(tenantId),
    });

    if (result.deletedCount === 0) {
      throw new TemplateNotFoundError(`Template not found: ${templateId}`);
    }
  }

  /**
   * Resolve template variables from client data
   * Maps template variable definitions to actual client field values
   */
  resolveVariables(
    template: IWhatsAppTemplate,
    client: Record<string, unknown>
  ): Record<number, string> {
    const resolved: Record<number, string> = {};

    for (const variable of template.variables) {
      const fieldValue = this.getFieldValue(client, variable.field);
      
      // Exclude undefined, null, and empty strings
      if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
        resolved[variable.index] = String(fieldValue);
      } else if (variable.defaultValue) {
        resolved[variable.index] = variable.defaultValue;
      } else {
        // If no value and no default, use placeholder
        resolved[variable.index] = `[${variable.field}]`;
      }
    }

    return resolved;
  }

  /**
   * Get a nested field value from an object using dot notation
   * Supports fields like "fullName", "operationStatus", "notes"
   */
  private getFieldValue(obj: Record<string, unknown>, field: string): unknown {
    const keys = field.split('.');
    let value: unknown = obj;

    for (const key of keys) {
      if (value === null || value === undefined) {
        return undefined;
      }
      value = (value as Record<string, unknown>)[key];
    }

    return value;
  }

  /**
   * Get client data for variable resolution
   * Fetches the client or lead and returns relevant fields for template variables
   */
  async getClientForTemplate(tenantId: string, clientId: string): Promise<Record<string, unknown> | null> {
    // Try as client first
    let client = await ClientModel.findOne({
      _id: new Types.ObjectId(clientId),
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    }).lean();

    // If not found as client, try as lead
    if (!client) {
      const lead = await LeadModel.findOne({
        _id: new Types.ObjectId(clientId),
        tenantId: new Types.ObjectId(tenantId),
        deletedAt: null,
      }).lean();

      if (!lead) {
        return null;
      }

      // Return lead data in client-like format
      return {
        _id: lead._id,
        fullName: lead.name,
        companyName: lead.companyName,
        phone: lead.phone,
        email: lead.email,
        address: lead.address,
        locality: lead.locality,
        province: lead.province,
        notes: lead.notes,
        operationStatus: lead.status, // For leads, use status as operationStatus
        customerType: lead.customerType,
        status: lead.status,
      };
    }

    // Return a flattened object with the fields needed for variable resolution
    return {
      _id: client._id,
      fullName: client.fullName,
      companyName: client.companyName,
      phone: client.phone,
      email: client.email,
      address: client.address,
      locality: client.locality,
      province: client.province,
      notes: client.notes,
      operationStatus: client.operationStatus,
      customerType: client.customerType,
      status: client.status,
    };
  }
}

export const whatsappTemplateService = new WhatsAppTemplateService();
