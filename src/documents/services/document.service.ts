import { Types } from 'mongoose';
import DocumentModel, { IDocumentModel } from '../models/document';
import { cloudinaryService, CloudinaryUploadResult } from '@/core/services/cloudinary.service';
import { CreateDocumentInput, UpdateDocumentInput, DocumentType, DocumentSource } from '../types/document';

export class DocumentService {
  /**
   * Create a new document from Cloudinary upload result
   */
  async create(input: CreateDocumentInput): Promise<IDocumentModel> {
    const document = await DocumentModel.create({
      tenantId: new Types.ObjectId(input.tenantId),
      clientId: input.clientId ? new Types.ObjectId(input.clientId) : undefined,
      leadId: input.leadId ? new Types.ObjectId(input.leadId) : undefined,
      conversationId: input.conversationId ? new Types.ObjectId(input.conversationId) : undefined,
      whatsappMessageId: input.whatsappMessageId,
      filename: input.filename,
      title: input.title,
      description: input.description,
      documentType: input.documentType,
      cloudinaryPublicId: input.cloudinaryPublicId,
      cloudinaryUrl: input.cloudinaryUrl,
      secureUrl: input.secureUrl,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      format: input.format,
      width: input.width,
      height: input.height,
      source: input.source,
      mediaId: input.mediaId,
      createdBy: input.createdBy ? new Types.ObjectId(input.createdBy) : undefined,
    });

    return document;
  }

  /**
   * Find document by ID
   */
  async findById(id: string, tenantId: string): Promise<IDocumentModel | null> {
    return DocumentModel.findOne({
      _id: id,
      tenantId: new Types.ObjectId(tenantId),
    }).lean();
  }

  /**
   * Get all documents for a client
   */
  async findByClient(clientId: string, tenantId: string): Promise<IDocumentModel[]> {
    return DocumentModel.find({
      clientId: new Types.ObjectId(clientId),
      tenantId: new Types.ObjectId(tenantId),
    })
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * Get all documents for a lead
   */
  async findByLead(leadId: string, tenantId: string): Promise<IDocumentModel[]> {
    return DocumentModel.find({
      leadId: new Types.ObjectId(leadId),
      tenantId: new Types.ObjectId(tenantId),
    })
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * Get all documents for a conversation
   */
  async findByConversation(conversationId: string, tenantId: string): Promise<IDocumentModel[]> {
    return DocumentModel.find({
      conversationId: new Types.ObjectId(conversationId),
      tenantId: new Types.ObjectId(tenantId),
    })
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * Update document metadata
   */
  async update(id: string, tenantId: string, input: UpdateDocumentInput): Promise<IDocumentModel | null> {
    const update: Record<string, any> = {};
    
    if (input.title !== undefined) update.title = input.title;
    if (input.description !== undefined) update.description = input.description;
    if (input.documentType !== undefined) update.documentType = input.documentType;

    return DocumentModel.findOneAndUpdate(
      { _id: id, tenantId: new Types.ObjectId(tenantId) },
      { $set: update },
      { new: true }
    ).lean();
  }

  /**
   * Delete document (from DB and Cloudinary)
   */
  async delete(id: string, tenantId: string): Promise<boolean> {
    const document = await DocumentModel.findOne({
      _id: id,
      tenantId: new Types.ObjectId(tenantId),
    });

    if (!document) {
      return false;
    }

    // Delete from Cloudinary
    try {
      await cloudinaryService.delete(document.cloudinaryPublicId);
    } catch (error) {
      console.error('[DocumentService] Error deleting from Cloudinary:', error);
      // Continue with DB deletion even if Cloudinary fails
    }

    // Delete from DB
    await DocumentModel.deleteOne({ _id: id });
    return true;
  }

  /**
   * Get document count for a client
   */
  async countByClient(clientId: string, tenantId: string): Promise<number> {
    return DocumentModel.countDocuments({
      clientId: new Types.ObjectId(clientId),
      tenantId: new Types.ObjectId(tenantId),
    });
  }

  /**
   * Get document count for a lead
   */
  async countByLead(leadId: string, tenantId: string): Promise<number> {
    return DocumentModel.countDocuments({
      leadId: new Types.ObjectId(leadId),
      tenantId: new Types.ObjectId(tenantId),
    });
  }

  /**
   * Upload and create document
   */
  async uploadAndCreate(
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
    options: {
      tenantId: string;
      clientId?: string;
      leadId?: string;
      conversationId?: string;
      title?: string;
      description?: string;
      documentType?: DocumentType;
      source?: DocumentSource;
      createdBy?: string;
    }
  ): Promise<IDocumentModel> {
    // Validate file
    const validation = cloudinaryService.constructor.validateFile(
      file.originalname,
      file.size,
      file.mimetype
    );
    
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Determine resource type
    const resourceType = cloudinaryService.constructor.getResourceType(file.mimetype);
    
    // Generate folder path
    const folder = options.clientId 
      ? `crm/clients/${options.clientId}`
      : options.leadId 
        ? `crm/leads/${options.leadId}`
        : 'crm/temp';

    // Upload to Cloudinary
    const uploadResult: CloudinaryUploadResult = await cloudinaryService.uploadBuffer(
      file.buffer,
      file.originalname,
      {
        folder,
        resourceType,
      }
    );

    // Generate title if not provided
    const title = options.title || this.generateTitle(
      options.documentType || 'otro',
      file.originalname
    );

    // Create document record
    return this.create({
      tenantId: options.tenantId,
      clientId: options.clientId,
      leadId: options.leadId,
      conversationId: options.conversationId,
      filename: file.originalname,
      title,
      description: options.description,
      documentType: options.documentType || 'otro',
      cloudinaryPublicId: uploadResult.publicId,
      cloudinaryUrl: uploadResult.url,
      secureUrl: uploadResult.secureUrl,
      mimeType: file.mimetype,
      fileSize: file.size,
      format: uploadResult.format,
      width: uploadResult.width,
      height: uploadResult.height,
      source: options.source || 'crm',
      createdBy: options.createdBy,
    });
  }

  /**
   * Generate a default title based on document type
   */
  private generateTitle(documentType: DocumentType, filename: string): string {
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    
    const typeLabels: Record<DocumentType, string> = {
      presupuesto: 'Presupuesto',
      cotizacion: 'Cotización',
      remito: 'Remito',
      factura: 'Factura',
      contrato: 'Contrato',
      imagen: 'Imagen',
      otro: 'Documento',
    };

    const baseName = filename.replace(/\.[^/.]+$/, ''); // Remove extension
    return `${typeLabels[documentType] || 'Documento'} - ${dateStr}`;
  }
}

export const documentService = new DocumentService();
export default documentService;