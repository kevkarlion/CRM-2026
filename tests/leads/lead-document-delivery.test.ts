import { describe, it, expect } from 'vitest';
import {
  WHATSAPP_SEND_ERROR,
  PHONE_MISSING_ERROR,
  sanitizePhone,
  buildWhatsAppSendPayload,
  resolvePhoneError,
} from '../../src/leads/helpers/lead-document-delivery';

describe('lead-document-delivery helper', () => {
  describe('error constants', () => {
    it('exposes the exact WhatsApp hard-fail error copy', () => {
      expect(WHATSAPP_SEND_ERROR).toBe('Error de WhatsApp, prueba enviando nuevamente');
    });

    it('exposes the exact missing-phone error copy', () => {
      expect(PHONE_MISSING_ERROR).toBe('El lead no tiene teléfono registrado');
    });
  });

  describe('sanitizePhone', () => {
    it('keeps a leading plus and strips whitespace, dashes and letters', () => {
      expect(sanitizePhone('+54 9 11 2345-6789')).toBe('+5491123456789');
    });

    it('removes surrounding labels but keeps the first plus and digits', () => {
      expect(sanitizePhone('Tel: +5491123456789 (Lun-Vie)')).toBe('+5491123456789');
    });

    it('keeps a plus found mid-string', () => {
      expect(sanitizePhone('ab+54 9 11')).toBe('+54911');
    });

    it('returns an empty string when input is empty', () => {
      expect(sanitizePhone('')).toBe('');
    });

    it('returns an empty string when input has no digits or plus', () => {
      expect(sanitizePhone('abc-def')).toBe('');
    });

    it('returns an empty string when input is whitespace-only', () => {
      expect(sanitizePhone('   ')).toBe('');
    });
  });

  describe('buildWhatsAppSendPayload', () => {
    const doc = {
      secureUrl: 'https://res.cloudinary.com/tenant/presupuesto.pdf',
      title: 'Presupuesto instalación - 30/08/2026',
      mimeType: 'application/pdf',
    };

    it('builds a send-document payload with sanitized phone and leadId', () => {
      const payload = buildWhatsAppSendPayload(doc, {
        phone: '+54 9 11 2345-6789',
        leadId: 'lead-123',
      });

      expect(payload).toEqual({
        url: doc.secureUrl,
        to: '+5491123456789',
        caption: doc.title,
        leadId: 'lead-123',
        mimeType: 'application/pdf',
      });
    });

    it('contains exactly the send-document fields (leadId and no clientId)', () => {
      const payload = buildWhatsAppSendPayload(doc, {
        phone: '+5491123456789',
        leadId: 'lead-123',
      });

      expect(Object.keys(payload)).toEqual(['url', 'to', 'caption', 'leadId', 'mimeType']);
    });
  });

  describe('resolvePhoneError', () => {
    it('returns the missing-phone error when phone is null', () => {
      expect(resolvePhoneError(null)).toBe(PHONE_MISSING_ERROR);
    });

    it('returns the missing-phone error when phone is undefined', () => {
      expect(resolvePhoneError(undefined)).toBe(PHONE_MISSING_ERROR);
    });

    it('returns the missing-phone error when phone is an empty string', () => {
      expect(resolvePhoneError('')).toBe(PHONE_MISSING_ERROR);
    });

    it('returns the missing-phone error when phone is whitespace-only', () => {
      expect(resolvePhoneError('   ')).toBe(PHONE_MISSING_ERROR);
    });

    it('returns null when a phone is provided', () => {
      expect(resolvePhoneError('+5491123456789')).toBeNull();
    });
  });
});