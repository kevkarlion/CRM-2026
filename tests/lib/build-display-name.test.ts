import { describe, it, expect } from 'vitest';
import { buildDisplayName } from '@/lib/build-display-name';

describe('buildDisplayName', () => {
  describe('both names present', () => {
    it('joins firstName and lastName with a single space', () => {
      expect(buildDisplayName('Ana', 'Gómez', 'ana@x.com')).toBe('Ana Gómez');
    });

    it('keeps an existing valid full name identical to before the change', () => {
      expect(buildDisplayName('Rodrigo', 'Gómez', 'rodrigo@x.com')).toBe('Rodrigo Gómez');
    });
  });

  describe('single name present', () => {
    it('returns the present name when lastName is null', () => {
      expect(buildDisplayName('Ana', null, 'ana@x.com')).toBe('Ana');
    });

    it('returns the present name when firstName is null', () => {
      expect(buildDisplayName(null, 'Gómez', 'ana@x.com')).toBe('Gómez');
    });
  });

  describe('junk and whitespace handling', () => {
    it('treats a whitespace-only part as missing', () => {
      expect(buildDisplayName('   ', 'Gómez', 'ana@x.com')).toBe('Gómez');
    });

    it('treats the literal string "undefined" as missing', () => {
      expect(buildDisplayName('undefined', 'Gómez', 'ana@x.com')).toBe('Gómez');
    });

    it('treats the literal string "null" as missing', () => {
      expect(buildDisplayName('null', 'Gómez', 'ana@x.com')).toBe('Gómez');
    });

    it('rejects the literal "undefined undefined" junk string produced by bad interpolation', () => {
      expect(buildDisplayName('undefined undefined', null, 'ana@x.com')).toBe('ana@x.com');
    });

    it('drops junk tokens inside a mixed name instead of keeping them', () => {
      expect(buildDisplayName('Rodrigo undefined', null, 'rodrigo@x.com')).toBe('Rodrigo');
    });
  });

  describe('fallbacks', () => {
    it('falls back to email when neither name part is usable', () => {
      expect(buildDisplayName(null, null, 'ana@x.com')).toBe('ana@x.com');
    });

    it('falls back to email when both parts are whitespace-only', () => {
      expect(buildDisplayName('  ', '  ', 'ana@x.com')).toBe('ana@x.com');
    });

    it("uses 'Usuario' as last resort when there is no name and no email", () => {
      expect(buildDisplayName(null, null, '')).toBe('Usuario');
    });

    it("uses 'Usuario' when the email is also junk", () => {
      expect(buildDisplayName('undefined', 'undefined', 'null')).toBe('Usuario');
    });
  });

  describe('no transformation', () => {
    it('does not capitalize or case-fold name parts', () => {
      expect(buildDisplayName('ana', 'gómez', 'ana@x.com')).toBe('ana gómez');
    });
  });

  describe('email deduplication', () => {
    it('collapses firstName and lastName when both hold the same email', () => {
      expect(buildDisplayName('ana@x.com', 'ana@x.com', 'ana@x.com')).toBe('ana@x.com');
    });

    it('collapses an email repeated with extra surrounding whitespace', () => {
      expect(buildDisplayName('  ana@x.com  ', 'ana@x.com', 'ana@x.com')).toBe('ana@x.com');
    });

    it('does not collapse consecutive identical non-email tokens (real repeated names stay)', () => {
      expect(buildDisplayName('José', 'José', 'jose@x.com')).toBe('José José');
    });

    it('keeps distinct name tokens intact', () => {
      expect(buildDisplayName('Ana', 'Gómez', 'ana@x.com')).toBe('Ana Gómez');
    });
  });
});