import { describe, it, expect } from 'vitest';
import { ObjectId } from 'mongodb';
import { serializeDoc } from './serialize.js';

describe('serializeDoc', () => {
  const id = new ObjectId('507f1f77bcf86cd799439011');

  it('converts ObjectId to hex string', () => {
    expect(serializeDoc(new ObjectId('507f1f77bcf86cd799439012'))).toBe(
      '507f1f77bcf86cd799439012',
    );
  });

  it('converts Date to ISO string', () => {
    expect(serializeDoc(new Date('2026-09-01T10:00:00Z'))).toBe('2026-09-01T10:00:00.000Z');
  });

  it('recursively serializes nested objects, arrays, and scalar passthrough', () => {
    const doc = {
      _id: id,
      createdAt: new Date('2026-09-01T10:00:00Z'),
      assignedTechnicians: [
        new ObjectId('507f1f77bcf86cd799439013'),
        new ObjectId('507f1f77bcf86cd799439014'),
      ],
      nested: {
        quoteId: new ObjectId('507f1f77bcf86cd799439015'),
        value: 42,
        enabled: true,
        nullable: null,
      },
      status: 'new',
    };
    expect(serializeDoc(doc)).toEqual({
      _id: '507f1f77bcf86cd799439011',
      createdAt: '2026-09-01T10:00:00.000Z',
      assignedTechnicians: [
        '507f1f77bcf86cd799439013',
        '507f1f77bcf86cd799439014',
      ],
      nested: {
        quoteId: '507f1f77bcf86cd799439015',
        value: 42,
        enabled: true,
        nullable: null,
      },
      status: 'new',
    });
  });

  it('leaves scalars untouched', () => {
    expect(serializeDoc('abc')).toBe('abc');
    expect(serializeDoc(42)).toBe(42);
    expect(serializeDoc(true)).toBe(true);
    expect(serializeDoc(null)).toBeNull();
    expect(serializeDoc(undefined)).toBeUndefined();
  });
});