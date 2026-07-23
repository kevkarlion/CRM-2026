import { Types } from 'mongoose';
import WhatsAppMessageModel from '../models/whatsapp-message';
import LeadModel from '../../leads/models/lead';
import TenantModel from '../../core/models/tenant';
import type { 
  IWhatsAppMessage, 
  CreateWhatsAppMessageInput,
  WhatsAppMessageDirection,
  WhatsAppMessageType 
} from '../types/whatsapp-message';
import type { ILead } from '../../leads/types/lead';

// Flag para modo desarrollo sin DB
const SKIP_DB_OPERATIONS = process.env.SKIP_WHATSAPP_DB === 'true';

export interface ProcessMessageResult {
  message: IWhatsAppMessage;
  lead: ILead | null;
  isNewLead: boolean;
  shouldRespond: boolean;
  responseText?: string;
}

export class WhatsAppService {
  /**
   * Obtiene el tenant activo (el primero que encuentra)
   * En producción, esto vendría de la configuración del número de WhatsApp
   */
  async getActiveTenantId(): Promise<string> {
    try {
      // Timeout de 3 segundos para evitar que se quede colgado
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 3000)
      );
      
      const tenantPromise = TenantModel.findOne({ deletedAt: null }).lean();
      
      const tenant = await Promise.race([tenantPromise, timeoutPromise]) as any;
      
      if (!tenant) {
        throw new Error('No hay tenants disponibles. Ejecuta el seed primero.');
      }
      return String(tenant._id);
    } catch (error) {
      console.error('Error getting tenant:', error);
      // Fallback para desarrollo: usar un ID fijo si la DB no responde
      // IMPORTANTE: Cambiar esto en producción
      return '000000000000000000000001';
    }
  }

  /**
   * Normaliza un número de teléfono (quita espacios, guiones, código de país)
   */
  normalizePhone(phone: string): string {
    // Elimina espacios, guiones, paréntesis y el +
    return phone.replace(/[\s\-\(\)\+]/g, '').replace(/^0/, '');
  }

  /**
   * Guarda un mensaje de WhatsApp
   */
  async saveMessage(
    input: CreateWhatsAppMessageInput
  ): Promise<IWhatsAppMessage> {
    if (SKIP_DB_OPERATIONS) {
      console.log('[WhatsApp] Skip DB - Would save message:', input);
      // Return a mock message for development with fake save method
      const mockMessage = {
        _id: new Types.ObjectId(),
        ...input,
        processedAt: new Date(),
        createdAt: new Date(),
        save: async () => mockMessage,
      } as IWhatsAppMessage & { save: () => Promise<any> };
      return mockMessage;
    }
    try {
      const message = new WhatsAppMessageModel(input);
      await message.save();
      return message;
    } catch (error) {
      console.error('[WhatsApp] Error saving message:', error);
      // Return mock message on error
      const mockMessage = {
        _id: new Types.ObjectId(),
        ...input,
        processedAt: new Date(),
        createdAt: new Date(),
        save: async () => mockMessage,
      } as IWhatsAppMessage & { save: () => Promise<any> };
      return mockMessage;
    }
  }

  /**
   * Busca un lead por número de teléfono o crea uno nuevo
   */
  async findOrCreateLeadByPhone(
    tenantId: string,
    phone: string,
    messageContent?: string
  ): Promise<{ lead: ILead | null; isNew: boolean }> {
    if (SKIP_DB_OPERATIONS) {
      console.log('[WhatsApp] Skip DB - Would find/create lead for:', phone);
      // Return mock lead for development with fake save method
      const mockLead = {
        _id: new Types.ObjectId(),
        tenantId: new Types.ObjectId(tenantId),
        name: `Lead WhatsApp ${phone.slice(-4)}`,
        phone,
        source: 'whatsapp',
        status: 'new',
        notes: messageContent || 'Desarrollo sin DB',
        createdBy: 'whatsapp-bot',
        updatedBy: 'whatsapp-bot',
        createdAt: new Date(),
        updatedAt: new Date(),
        save: async () => mockLead,
      } as ILead & { save: () => Promise<any> };
      return {
        lead: mockLead,
        isNew: true,
      };
    }
    
    const normalizedPhone = this.normalizePhone(phone);
    
    // Buscar lead existente por teléfono
    const existingLead = await LeadModel.findOne({
      tenantId: new Types.ObjectId(tenantId),
      phone: { $regex: new RegExp(normalizedPhone.replace(/^\+/, ''), 'i') },
      deletedAt: null,
    });

    if (existingLead) {
      return { lead: existingLead, isNew: false };
    }

    // Crear nuevo lead
    const newLead = new LeadModel({
      tenantId: new Types.ObjectId(tenantId),
      name: `Lead WhatsApp ${normalizedPhone.slice(-4)}`,
      phone: normalizedPhone,
      source: 'whatsapp',
      status: 'new',
      notes: messageContent ? `Mensaje inicial: ${messageContent}` : 'Creado desde WhatsApp',
      createdBy: 'whatsapp-bot',
      updatedBy: 'whatsapp-bot',
    });

    await newLead.save();
    return { lead: newLead, isNew: true };
  }

  /**
   * Procesa un mensaje entrante de WhatsApp
   * 1. Guarda el mensaje
   * 2. Busca o crea el lead
   * 3. Actualiza el lead si es necesario
   * 4. Genera respuesta automática
   */
  async processIncomingMessage(
    tenantId: string,
    phone: string,
    messageId: string,
    content: string,
    messageType: WhatsAppMessageType = 'text'
  ): Promise<ProcessMessageResult> {
    
    // 1. Guardar el mensaje
    const message = await this.saveMessage({
      tenantId: new Types.ObjectId(tenantId),
      phone: this.normalizePhone(phone),
      messageId,
      direction: 'inbound',
      type: messageType,
      content,
    });

    // 2. Buscar o crear lead
    const { lead, isNew } = await this.findOrCreateLeadByPhone(tenantId, phone, content);

    // 3. Actualizar lead si es nuevo o si hay información relevante
    if (lead) {
      // Actualizar el mensaje con el leadId
      message.leadId = lead._id;
      await message.save();

      // Si es nuevo lead, already tiene el notes con el mensaje inicial
      // Si ya existía, agregamos el mensaje a los notes
      if (!isNew && content) {
        const currentNotes = lead.notes || '';
        lead.notes = `${currentNotes}\n${new Date().toISOString()}: ${content}`.trim();
        await lead.save();
      }
    }

    // 4. Generar respuesta automática (lógica básica del bot)
    const { shouldRespond, responseText } = this.generateAutoResponse(content, isNew);

    return {
      message,
      lead,
      isNewLead: isNew,
      shouldRespond,
      responseText,
    };
  }

  /**
   * Lógica básica del bot para generar respuestas automáticas
   */
  private generateAutoResponse(
    messageContent: string,
    isNewLead: boolean
  ): { shouldRespond: boolean; responseText?: string } {
    const text = messageContent.toLowerCase().trim();

    // Saludo inicial
    if (['hola', 'hello', 'hi', 'buenas', 'buenos días', 'buenas tardes'].includes(text)) {
      return {
        shouldRespond: true,
        responseText: isNewLead 
          ? '¡Hola! 👋 Bienvenido a Patagonia. Soy tu asistente virtual. ¿En qué puedo ayudarte hoy?'
          : '¡Hola de nuevo! 👋 ¿En qué puedo ayudarte?'
      };
    }

    // Consultas básicas
    if (text.includes('presupuesto') || text.includes('cotizacion') || text.includes('cotizar')) {
      return {
        shouldRespond: true,
        responseText: 'Para solicitar un presupuesto, necesito algunos datos:\n\n1. ¿Qué tipo de servicio necesitas? (instalación, reparación, mantenimiento)\n2. ¿Cuál es la dirección del lugar?\n3. ¿Tienes algún equipo existente que debamos revisar?'
      };
    }

    if (text.includes('contacto') || text.includes('hablar') || text.includes('asesor')) {
      return {
        shouldRespond: true,
        responseText: 'Perfecto, un asesor te contactará pronto. ¿Podrías confirmarnos tu nombre y el servicio que necesitas?'
      };
    }

    if (text.includes('gracias') || text.includes('ok') || text.includes('entendido')) {
      return {
        shouldRespond: true,
        responseText: '¡De nada! 😊 ¿Hay algo más en lo que pueda ayudarte?'
      };
    }

    // Si no reconoce nada, respuesta genérica
    if (isNewLead) {
      return {
        shouldRespond: true,
        responseText: 'Gracias por contactarnos. Un asesor te ayudará pronto. Mientras tanto, cuéntanos más sobre lo que necesitas.'
      };
    }

    return { shouldRespond: false };
  }

  /**
   * Obtiene mensajes de WhatsApp para un lead
   */
  async getMessagesByLead(
    tenantId: string,
    leadId: string
  ): Promise<IWhatsAppMessage[]> {
    return WhatsAppMessageModel.find({
      tenantId: new Types.ObjectId(tenantId),
      leadId: new Types.ObjectId(leadId),
    }).sort({ createdAt: 1 });
  }

  /**
   * Obtiene mensajes por número de teléfono
   */
  async getMessagesByPhone(
    tenantId: string,
    phone: string
  ): Promise<IWhatsAppMessage[]> {
    return WhatsAppMessageModel.find({
      tenantId: new Types.ObjectId(tenantId),
      phone: this.normalizePhone(phone),
    }).sort({ createdAt: 1 });
  }
}

export default new WhatsAppService();