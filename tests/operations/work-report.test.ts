import { describe, it, expect } from 'vitest';

describe('WorkReport schema migration fields', () => {
  it('arrivalTime path exists, Date type, null default', async () => {
    const { workReportSchema } = await import('../../src/operations/schemas/work-report');
    const p = workReportSchema.paths['arrivalTime'] as any;
    expect(p).toBeDefined();
    expect(p.instance).toBe('Date');
    expect(p.options.default).toBeNull();
  });

  it('departureTime path exists, Date type, null default', async () => {
    const { workReportSchema } = await import('../../src/operations/schemas/work-report');
    const p = workReportSchema.paths['departureTime'] as any;
    expect(p).toBeDefined();
    expect(p.instance).toBe('Date');
    expect(p.options.default).toBeNull();
  });

  it('internalComments path exists, String, maxlength 5000, null default', async () => {
    const { workReportSchema } = await import('../../src/operations/schemas/work-report');
    const p = workReportSchema.paths['internalComments'] as any;
    expect(p).toBeDefined();
    expect(p.instance).toBe('String');
    expect(p.options.maxlength).toBe(5000);
    expect(p.options.default).toBeNull();
  });

  it('materialsItems path exists and defaults to empty array', async () => {
    const { workReportSchema } = await import('../../src/operations/schemas/work-report');
    const p = workReportSchema.paths['materialsItems'] as any;
    expect(p).toBeDefined();
    expect(Array.isArray(p.options.default)).toBe(true);
    expect(p.options.default).toEqual([]);
  });

  it('materialsItems defines item, quantity and unit subfields', async () => {
    const { workReportSchema } = await import('../../src/operations/schemas/work-report');
    const p = workReportSchema.paths['materialsItems'] as any;
    expect(p.schema).toBeDefined();
    const sub = p.schema.paths ?? {};
    expect(sub['item']).toBeDefined();
    expect(sub['quantity']).toBeDefined();
    expect(sub['unit']).toBeDefined();
  });

  it('legacy docs stay valid: none of the new fields are required', async () => {
    const { workReportSchema } = await import('../../src/operations/schemas/work-report');
    for (const field of ['arrivalTime', 'departureTime', 'internalComments', 'materialsItems']) {
      const p = workReportSchema.paths[field] as any;
      expect(p.options.required).toBeUndefined();
    }
  });
});

describe('CreateWorkReportApiInput carries migrated fields', () => {
  it('accepts the four new fields on input', async () => {
    const { CreateWorkReportApiInput } = await import('../../src/operations/types/work-report');
    type Input = CreateWorkReportApiInput;
    const input: Input = {
      technicianId: 't1',
      result: 'Reparacion',
      startedAt: new Date(),
      finishedAt: new Date(),
      arrivalTime: new Date(),
      departureTime: new Date(),
      internalComments: 'nota interna',
      materialsItems: [{ item: 'Filtro', quantity: 2, unit: 'un' }],
    };
    expect(input.arrivalTime).toBeInstanceOf(Date);
    expect(input.departureTime).toBeInstanceOf(Date);
    expect(input.internalComments).toBe('nota interna');
    expect(input.materialsItems).toHaveLength(1);
    expect(input.materialsItems![0].quantity).toBe(2);
  });
});
