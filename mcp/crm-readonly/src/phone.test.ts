import { describe, it, expect } from 'vitest';
import { normalizePhone } from './phone.js';

describe('normalizePhone', () => {
  it('keeps canonical values unchanged', () => {
    expect(normalizePhone('5492991234567')).toBe('5492991234567');
  });

  it('canonicalizes input with +54 9 prefix', () => {
    expect(normalizePhone('+54 9 299 1234567')).toBe('5492991234567');
  });

  it('canonicalizes input with 54 9 prefix (no plus)', () => {
    expect(normalizePhone('54 9 299 1234567')).toBe('5492991234567');
  });

  it('strips parens and dashes', () => {
    expect(normalizePhone('54 (9) 299-123-4567')).toBe('5492991234567');
  });

  it('decodes URL-encoded plus before stripping', () => {
    expect(normalizePhone('%2B54 9 299 1234567')).toBe('5492991234567');
  });

  it('adds 549 to local 10-digit mobile numbers', () => {
    expect(normalizePhone('2991234567')).toBe('5492991234567');
  });

  it('matches the spec scenario: Buenos Aires 10-digit mobile', () => {
    expect(normalizePhone('11 2233-4455')).toBe('5491122334455');
  });

  it('keeps landlines with country code untouched', () => {
    expect(normalizePhone('54 299 400000')).toBe('54299400000');
  });

  it('is idempotent', () => {
    const samples = [
      '+54 9 299 1234567',
      '5492991234567',
      '54 9 299 1234567',
      '2991234567',
      '54 299 400000',
      '%2B54 9 299 1234567',
    ];
    for (const sample of samples) {
      expect(normalizePhone(normalizePhone(sample))).toBe(normalizePhone(sample));
    }
  });
});