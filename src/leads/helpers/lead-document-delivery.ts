export const WHATSAPP_SEND_ERROR = 'Error de WhatsApp, prueba enviando nuevamente';
export const PHONE_MISSING_ERROR = 'El lead no tiene teléfono registrado';

export function sanitizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

export function buildWhatsAppSendPayload(
  doc: { secureUrl: string; title: string; mimeType: string },
  opts: { phone: string; leadId: string },
): { url: string; to: string; caption: string; leadId: string; mimeType: string } {
  return {
    url: doc.secureUrl,
    to: sanitizePhone(opts.phone),
    caption: doc.title,
    leadId: opts.leadId,
    mimeType: doc.mimeType,
  };
}

export function resolvePhoneError(phone: string | null | undefined): string | null {
  if (!phone) return PHONE_MISSING_ERROR;
  return null;
}