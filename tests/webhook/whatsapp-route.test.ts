import { describe, it, expect } from 'vitest';
import { buildWebhookSummary } from '@/app/api/webhook/whatsapp/route';

describe('buildWebhookSummary', () => {
  it('includes the mode and entry count without the body', () => {
    const body = {
      object: 'whatsapp_business_account',
      entry: [{ id: 'x', changes: [] }],
      secret: 'SHOULD-NOT-LEAK',
    };
    const summary = buildWebhookSummary(body);
    expect(summary).toContain('whatsapp_business_account');
    expect(summary).toContain('entries=1');
    expect(summary).not.toContain('SHOULD-NOT-LEAK');
    expect(summary).not.toContain('JSON.stringify');
  });

  it('reports zero entries and unknown mode for a body without them', () => {
    const summary = buildWebhookSummary({ object: 'different' });
    expect(summary).toContain('different');
    expect(summary).toContain('entries=0');
  });

  it('counts multiple entries', () => {
    const summary = buildWebhookSummary({
      object: 'whatsapp_business_account',
      entry: [{}, {}, {}],
    });
    expect(summary).toContain('entries=3');
  });
});
