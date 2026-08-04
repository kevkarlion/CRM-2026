import type { IClient } from '@/crm/types/client';
import ClientModel from '@/crm/models/client';
import { Types } from 'mongoose';
import connectDB from '@/core/db';

/**
 * Conversation Context - Data container for conversation state
 * 
 * This is the data layer passed between states during conversation flow.
 * Separated from persistence layer (ConversationContext in domain/conversation.ts).
 */

export interface ConversationContextData {
  phoneNumber: string
  version: number
  data: Record<string, unknown>
}

/**
 * Conversation context that holds conversation state and user data
 */
export class ConversationContext implements ConversationContextData {
  phoneNumber: string
  version: number
  data: Record<string, unknown>

  constructor(phoneNumber: string, version = 1) {
    this.phoneNumber = phoneNumber
    this.version = version
    this.data = {}
  }

  /**
   * Get a value from context by key
   */
  get<T>(key: string): T | undefined {
    return this.data[key] as T | undefined
  }

  /**
   * Set a value in context
   */
  set<T>(key: string, value: T): void {
    this.data[key] = value
  }

  /**
   * Check if a key exists in context
   */
  has(key: string): boolean {
    return key in this.data
  }

  /**
   * Serialize context to JSON for persistence
   */
  toJSON(): ConversationContextData {
    return {
      phoneNumber: this.phoneNumber,
      version: this.version,
      data: { ...this.data },
    }
  }

  /**
   * Reconstruct context from JSON
   */
  static fromJSON(json: ConversationContextData): ConversationContext {
    const ctx = new ConversationContext(json.phoneNumber, json.version)
    ctx.data = { ...json.data }
    return ctx
  }

  /**
   * Initialize context from customer data
   * Populates context with customer information for flow processing
   */
  initializeFromCustomer(customer: IClient): void {
    const customerData = customer as unknown as { 
      fullName?: string; 
      name?: string; 
      address?: string; 
      locality?: string; 
      province?: string; 
      equipment?: unknown[],
      _id?: Types.ObjectId,
      tenantId?: Types.ObjectId
    }
    this.set('customerName', customerData.fullName ?? customerData.name ?? '')
    this.set('address', customerData.address)
    this.set('locality', customerData.locality)
    this.set('province', customerData.province)
    this.set('isCustomer', true)
    this.set('clientId', customerData._id?.toString())
    this.set('tenantId', customerData.tenantId?.toString())

    // Store any equipment data
    if (customerData.equipment && Array.isArray(customerData.equipment)) {
      this.set('equipment', customerData.equipment)
    }
  }

  /**
   * Get fresh client data from database
   * Use after address confirmation to ensure latest data
   * Always queries DB directly, bypassing any cache
   */
  async getFreshClientData(phone: string, tenantId: string): Promise<IClient | null> {
    await connectDB();
    
    const normalizedPhone = phone.replace(/[\s\-\(\)\+]/g, '').replace(/^0/, '');
    const client = await ClientModel.findOne({
      tenantId: new Types.ObjectId(tenantId),
      phone: { $regex: new RegExp(normalizedPhone.replace(/^\+/, ''), 'i') },
      deletedAt: null,
    }).lean();
    
    return client as IClient | null;
  }

  /**
   * Update client address after confirmation
   * Stores the updated address in context for use by subsequent states
   */
  async updateClientAddress(
    clientId: string,
    tenantId: string,
    address: string,
    locality?: string,
    province?: string
  ): Promise<IClient | null> {
    await connectDB();
    
    const updateData: Record<string, string> = { address };
    if (locality) updateData.locality = locality;
    if (province) updateData.province = province;
    
    const updatedClient = await ClientModel.findByIdAndUpdate(
      clientId,
      { $set: updateData },
      { new: true }
    ).lean();
    
    // Update context with new address data
    if (updatedClient) {
      this.set('address', address);
      this.set('locality', locality || '');
      this.set('province', province || '');
    }
    
    return updatedClient as IClient | null;
  }
}