import { describe, it, expect } from 'vitest';

describe('TimelineEvent schema (client-activity foundation)', () => {
  it('leadId is optional so leadless events can persist', async () => {
    const { timelineEventSchema } = await import('../../src/timeline/schemas/timeline-event');
    const leadIdPath = timelineEventSchema.paths['leadId'] as any;

    expect(leadIdPath).toBeDefined();
    expect(leadIdPath.options.required).toBeUndefined();
  });

  it('clientId path exists and references the Client collection', async () => {
    const { timelineEventSchema } = await import('../../src/timeline/schemas/timeline-event');
    const clientIdPath = timelineEventSchema.paths['clientId'] as any;

    expect(clientIdPath).toBeDefined();
    expect(clientIdPath.options.ref).toBe('Client');
  });

  it('indexes clientId for client activity reads', async () => {
    const { timelineEventSchema } = await import('../../src/timeline/schemas/timeline-event');
    const indexSpecs = timelineEventSchema.indexes().map(([spec]) => spec);

    expect(indexSpecs).toContainEqual({ tenantId: 1, clientId: 1, createdAt: -1 });
  });
});
