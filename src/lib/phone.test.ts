import { describe, it, expect } from 'vitest';
import {
  normalizePhone,
  phoneMatchQuery,
  samePhoneNumber,
  isActiveLead,
  isActiveClient,
} from './phone';

describe('normalizePhone', () => {
  it('keeps bot-canonical values unchanged', () => {
    expect(normalizePhone('5492991234567')).toBe('5492991234567');
  });

  it('canonicalizes raw manual input with +54 prefix', () => {
    expect(normalizePhone('+54 9 299 1234567')).toBe('5492991234567');
  });

  it('strips parens and dashes', () => {
    expect(normalizePhone('54 (9) 299-123-4567')).toBe('5492991234567');
  });

  it('strips a single leading zero and adds 549 for cellphones', () => {
    // Teléfono fijo: 02991234567 -> 2991234567 (sin prefijo, no detecta como celular)
    // Celular con código área: 02981234567 -> 5492981234567 (agrega prefijo)
    expect(normalizePhone('0299 1234567')).toBe('2991234567');
  });

  it('decodes URL-encoded plus before stripping', () => {
    expect(normalizePhone('%2B54 9 299 1234567')).toBe('5492991234567');
  });

  it('is idempotent', () => {
    const samples = ['+54 9 299 1234567', '5492991234567', '0299 1234567', '+54 (299) 123-4567'];
    for (const sample of samples) {
      expect(normalizePhone(normalizePhone(sample))).toBe(normalizePhone(sample));
    }
  });
});

describe('phoneMatchQuery', () => {
  it('matches a stored canonical value', () => {
    const query = phoneMatchQuery('5492991234567');
    expect(query.$regex.test('5492991234567')).toBe(true);
  });

  it('matches a stored raw value with separators', () => {
    const query = phoneMatchQuery('5492991234567');
    expect(query.$regex.test('+54 9 299 1234567')).toBe(true);
    expect(query.$regex.test('54 (9) 299-123-4567')).toBe(true);
    expect(query.$regex.test('+5492991234567')).toBe(true);
  });

  it('does not match a different number', () => {
    const query = phoneMatchQuery('5492991234567');
    expect(query.$regex.test('5492997654321')).toBe(false);
  });

  it('is anchored: does not match longer numbers containing the digits', () => {
    const query = phoneMatchQuery('5492991234567');
    expect(query.$regex.test('54929912345678')).toBe(false);
    expect(query.$regex.test('15492991234567')).toBe(false);
  });
});

describe('isActiveLead', () => {
  it('returns true for a lead in an active status', () => {
    expect(isActiveLead({ status: 'negotiation', deletedAt: null })).toBe(true);
    expect(isActiveLead({ status: 'contacted', deletedAt: null })).toBe(true);
  });

  it('returns false for terminal statuses', () => {
    expect(isActiveLead({ status: 'won', deletedAt: null })).toBe(false);
    expect(isActiveLead({ status: 'lost', deletedAt: null })).toBe(false);
    expect(isActiveLead({ status: 'disqualified', deletedAt: null })).toBe(false);
  });

  it('returns false when the lead is deleted', () => {
    expect(isActiveLead({ status: 'contacted', deletedAt: new Date() })).toBe(false);
  });
});

describe('isActiveClient', () => {
  it('returns true when not deleted', () => {
    expect(isActiveClient({ deletedAt: null })).toBe(true);
  });

  it('returns false when deleted', () => {
    expect(isActiveClient({ deletedAt: new Date() })).toBe(false);
  });
});

describe('samePhoneNumber', () => {
  it('matches 13-digit WhatsApp number against 10-digit local with separators', () => {
    expect(samePhoneNumber('2995 24-8670', '5492995248670')).toBe(true);
  });

  it('matches 13-digit WhatsApp number against 10-digit local', () => {
    expect(samePhoneNumber('2995464405', '5492995464405')).toBe(true);
  });

  it('matches another interior cellphone pair', () => {
    expect(samePhoneNumber('3513974222', '5493513974222')).toBe(true);
  });

  it('matches a 12-digit vs 13-digit variant of the same number', () => {
    expect(samePhoneNumber('542996300680', '5492996300680')).toBe(true);
  });

  it('matches identical strings', () => {
    expect(samePhoneNumber('5492995248670', '5492995248670')).toBe(true);
  });

  it('returns false for clearly different numbers', () => {
    expect(samePhoneNumber('2995464405', '2995702283')).toBe(false);
    expect(samePhoneNumber('5492995248670', '5492996300680')).toBe(false);
  });

  it('returns false for null/undefined inputs', () => {
    expect(samePhoneNumber(null, '5492995248670')).toBe(false);
    expect(samePhoneNumber('2995248670', undefined)).toBe(false);
    expect(samePhoneNumber(null, null)).toBe(false);
  });
});
