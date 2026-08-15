import { describe, it, expect } from 'vitest';

type PreHook = { fn: Function };

function myHook(schema: any, event: string): PreHook {
  const hooks: PreHook[] = schema.s.hooks._pres.get(event) || [];
  const hook = hooks.find((h) => h.fn.toString().includes('normalizePhone'));
  if (!hook) throw new Error(`phone normalization hook not found for event "${event}"`);
  return hook;
}

describe('Lead schema phone hooks', () => {
  it('normalizes phone on save', async () => {
    const { leadSchema } = await import('../../src/leads/schemas/lead');
    const doc: any = { phone: '+54 9 299 1234567' };
    await new Promise<void>((resolve, reject) =>
      myHook(leadSchema, 'save').fn.call(doc, (err?: unknown) => (err ? reject(err) : resolve()))
    );
    expect(doc.phone).toBe('5492991234567');
  });

  it('normalizes phone on save when already canonical', async () => {
    const { leadSchema } = await import('../../src/leads/schemas/lead');
    const doc: any = { phone: '5492991234567' };
    await new Promise<void>((resolve, reject) =>
      myHook(leadSchema, 'save').fn.call(doc, (err?: unknown) => (err ? reject(err) : resolve()))
    );
    expect(doc.phone).toBe('5492991234567');
  });

  it('leaves missing phone untouched on save', async () => {
    const { leadSchema } = await import('../../src/leads/schemas/lead');
    const doc: any = { name: 'Foo' };
    await new Promise<void>((resolve, reject) =>
      myHook(leadSchema, 'save').fn.call(doc, (err?: unknown) => (err ? reject(err) : resolve()))
    );
    expect(doc.phone).toBeUndefined();
  });

  it('normalizes phone in $set on findOneAndUpdate', async () => {
    const { leadSchema } = await import('../../src/leads/schemas/lead');
    const update: any = { $set: { phone: '+54 9 299 7654321' } };
    const query: any = { getUpdate: () => update };
    await new Promise<void>((resolve, reject) =>
      myHook(leadSchema, 'findOneAndUpdate').fn.call(query, (err?: unknown) => (err ? reject(err) : resolve()))
    );
    expect(update.$set.phone).toBe('5492997654321');
  });

  it('normalizes top-level phone on findOneAndUpdate', async () => {
    const { leadSchema } = await import('../../src/leads/schemas/lead');
    const update: any = { phone: '+54 9 299 1112223' };
    const query: any = { getUpdate: () => update };
    await new Promise<void>((resolve, reject) =>
      myHook(leadSchema, 'findOneAndUpdate').fn.call(query, (err?: unknown) => (err ? reject(err) : resolve()))
    );
    expect(update.phone).toBe('5492991112223');
  });
});

describe('Client schema phone hooks', () => {
  it('normalizes phone on save', async () => {
    const { clientSchema } = await import('../../src/crm/schemas/client');
    const doc: any = { phone: '+54 9 299 4445556' };
    await new Promise<void>((resolve, reject) =>
      myHook(clientSchema, 'save').fn.call(doc, (err?: unknown) => (err ? reject(err) : resolve()))
    );
    expect(doc.phone).toBe('5492994445556');
  });

  it('normalizes phone in $set on findOneAndUpdate', async () => {
    const { clientSchema } = await import('../../src/crm/schemas/client');
    const update: any = { $set: { phone: '+54 9 299 7778889' } };
    const query: any = { getUpdate: () => update };
    await new Promise<void>((resolve, reject) =>
      myHook(clientSchema, 'findOneAndUpdate').fn.call(query, (err?: unknown) => (err ? reject(err) : resolve()))
    );
    expect(update.$set.phone).toBe('5492997778889');
  });

  it('leaves missing phone untouched on findOneAndUpdate', async () => {
    const { clientSchema } = await import('../../src/crm/schemas/client');
    const update: any = { $set: { name: 'Foo' } };
    const query: any = { getUpdate: () => update };
    await new Promise<void>((resolve, reject) =>
      myHook(clientSchema, 'findOneAndUpdate').fn.call(query, (err?: unknown) => (err ? reject(err) : resolve()))
    );
    expect(update.$set.phone).toBeUndefined();
  });
});
