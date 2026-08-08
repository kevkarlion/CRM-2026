import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import { Readable } from 'stream';

// Configure Cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface CloudinaryUploadResult {
  publicId: string;
  url: string;
  secureUrl: string;
  format: string;
  width?: number;
  height?: number;
  bytes: number;
  resourceType: string;
}

export interface CloudinaryDeleteResult {
  result: string;
}

export class CloudinaryService {
  private cloudName: string;

  constructor() {
    this.cloudName = process.env.CLOUDINARY_CLOUD_NAME || '';
    if (!this.cloudName) {
      console.warn('[Cloudinary] CLOUDINARY_CLOUD_NAME not configured');
    }
  }

  /**
   * Upload a file from buffer
   */
  async uploadBuffer(
    buffer: Buffer,
    filename: string,
    options: {
      folder?: string;
      resourceType?: 'image' | 'video' | 'raw' | 'auto';
      publicId?: string;
      tags?: string[];
    } = {}
  ): Promise<CloudinaryUploadResult> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: options.folder || 'crm',
          resource_type: options.resourceType || 'auto',
          public_id: options.publicId,
          tags: options.tags,
          use_filename: true,
          unique_filename: true,
        },
        (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
          if (error) {
            console.error('[Cloudinary] Upload error:', error);
            reject(new Error(error.message));
          } else if (result) {
            resolve({
              publicId: result.public_id,
              url: result.url,
              secureUrl: result.secure_url,
              format: result.format,
              width: result.width,
              height: result.height,
              bytes: result.bytes,
              resourceType: result.resource_type,
            });
          }
        }
      );

      const stream = Readable.from(buffer);
      stream.pipe(uploadStream);
    });
  }

  /**
   * Upload a file from base64 string
   */
  async uploadBase64(
    base64Data: string,
    options: {
      folder?: string;
      resourceType?: 'image' | 'video' | 'raw' | 'auto';
      publicId?: string;
    } = {}
  ): Promise<CloudinaryUploadResult> {
    try {
      const result = await cloudinary.uploader.upload(base64Data, {
        folder: options.folder || 'crm',
        resource_type: options.resourceType || 'auto',
        public_id: options.publicId,
        use_filename: true,
        unique_filename: true,
      });

      return {
        publicId: result.public_id,
        url: result.url,
        secureUrl: result.secure_url,
        format: result.format,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
        resourceType: result.resource_type,
      };
    } catch (error: any) {
      console.error('[Cloudinary] Base64 upload error:', error);
      throw new Error(error.message || 'Failed to upload to Cloudinary');
    }
  }

  /**
   * Delete a file by public ID
   */
  async delete(publicId: string, resourceType: 'image' | 'video' | 'raw' = 'image'): Promise<CloudinaryDeleteResult> {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
      });
      return { result };
    } catch (error: any) {
      console.error('[Cloudinary] Delete error:', error);
      throw new Error(error.message || 'Failed to delete from Cloudinary');
    }
  }

  /**
   * Get secure URL for a file
   */
  getSecureUrl(publicId: string, options: {
    width?: number;
    height?: number;
    crop?: string;
    quality?: string | number;
    format?: string;
  } = {}): string {
    return cloudinary.url(publicId, {
      secure: true,
      width: options.width,
      height: options.height,
      crop: options.crop || 'fill',
      quality: options.quality || 'auto',
      format: options.format || 'auto',
    });
  }

  /**
   * Get thumbnail URL for images
   */
  getThumbnail(publicId: string, size: number = 150): string {
    return cloudinary.url(publicId, {
      secure: true,
      width: size,
      height: size,
      crop: 'thumb',
      gravity: 'auto',
      quality: 'auto',
      format: 'auto',
    });
  }

  /**
   * Get download URL with filename for proper download
   */
  getDownloadUrl(publicId: string, filename: string): string {
    // Get the file extension from the original filename
    const ext = filename.split('.').pop() || '';
    // Remove extension from filename for the URL
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
    
    return cloudinary.url(publicId, {
      secure: true,
      flags: [`attachment:${nameWithoutExt}`],
      format: ext || 'auto',
    });
  }

  /**
   * Get metadata for a file
   */
  async getMetadata(publicId: string): Promise<any> {
    try {
      const result = await cloudinary.api.resource(publicId);
      return result;
    } catch (error: any) {
      console.error('[Cloudinary] Get metadata error:', error);
      return null;
    }
  }

  /**
   * Check if Cloudinary is configured
   */
  isConfigured(): boolean {
    return !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
  }

  /**
   * Get resource type from mime type
   */
  static getResourceType(mimeType: string): 'image' | 'video' | 'raw' | 'auto' {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    return 'raw';
  }

  /**
   * Allowed file extensions
   */
  static readonly ALLOWED_EXTENSIONS = [
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg',
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt',
    'zip', 'rar',
  ];

  /**
   * Allowed mime types
   */
  static readonly ALLOWED_MIME_TYPES = [
    // Images
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    // Archives
    'application/zip',
    'application/x-rar-compressed',
  ];

  /**
   * Max file size (10MB)
   */
  static readonly MAX_FILE_SIZE = 10 * 1024 * 1024;

  /**
   * Validate file
   */
  static validateFile(filename: string, size: number, mimeType: string): { valid: boolean; error?: string } {
    const ext = filename.split('.').pop()?.toLowerCase();
    
    if (!ext || !this.ALLOWED_EXTENSIONS.includes(ext)) {
      return { valid: false, error: `Tipo de archivo no permitido: ${ext}` };
    }

    if (!this.ALLOWED_MIME_TYPES.includes(mimeType)) {
      return { valid: false, error: `Tipo MIME no permitido: ${mimeType}` };
    }

    if (size > this.MAX_FILE_SIZE) {
      return { valid: false, error: 'El archivo excede el tamaño máximo de 10MB' };
    }

    return { valid: true };
  }
}

export const cloudinaryService = new CloudinaryService();
export default cloudinaryService;