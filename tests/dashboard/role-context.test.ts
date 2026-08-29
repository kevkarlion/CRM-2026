import { describe, it, expect } from 'vitest';
import { decodeToken } from '@/dashboard/context/role-context';

function makeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.sig`;
}

const futureExp = Math.floor(Date.now() / 1000) + 3600;

describe('decodeToken name handling', () => {
  it('rejects a junk "undefined undefined" name and falls back to email', () => {
    const decoded = decodeToken(makeJwt({ userId: 'u1', email: 'ana@x.com', name: 'undefined undefined', exp: futureExp }));
    expect(decoded?.name).toBe('ana@x.com');
  });

  it('rejects a literal "undefined" name and falls back to email', () => {
    const decoded = decodeToken(makeJwt({ userId: 'u1', email: 'ana@x.com', name: 'undefined', exp: futureExp }));
    expect(decoded?.name).toBe('ana@x.com');
  });

  it('rejects an empty name and falls back to email', () => {
    const decoded = decodeToken(makeJwt({ userId: 'u1', email: 'ana@x.com', name: '', exp: futureExp }));
    expect(decoded?.name).toBe('ana@x.com');
  });

  it('rejects a whitespace-only name and falls back to email', () => {
    const decoded = decodeToken(makeJwt({ userId: 'u1', email: 'ana@x.com', name: '   ', exp: futureExp }));
    expect(decoded?.name).toBe('ana@x.com');
  });

  it('falls back to "Usuario" when the name is junk and there is no email', () => {
    const decoded = decodeToken(makeJwt({ userId: 'u1', name: 'null null', exp: futureExp }));
    expect(decoded?.name).toBe('Usuario');
  });

  it('keeps a valid full name from the JWT', () => {
    const decoded = decodeToken(makeJwt({ userId: 'u1', email: 'ana@x.com', name: 'Ana Gómez', exp: futureExp }));
    expect(decoded?.name).toBe('Ana Gómez');
  });

  it('returns null for an expired token', () => {
    const expired = Math.floor(Date.now() / 1000) - 10;
    const decoded = decodeToken(makeJwt({ userId: 'u1', email: 'ana@x.com', name: 'Ana Gómez', exp: expired }));
    expect(decoded).toBeNull();
  });
});