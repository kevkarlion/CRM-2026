// @vitest-environment node

import { describe, it, expect } from 'vitest';
import { getNextAction } from '../../src/components/quotes/next-action-badge';
import { getExpiryBadge } from '../../src/components/quotes/expiry-badge';
import { getStatusColor } from '../../src/components/quotes/status-color';
import { mergeQuotesAndNegotiations } from '../../src/components/quotes/data-utils';
import type { ApiQuote, ApiNegotiation } from '../../src/quotes/types/client-quote-types';

// ── getNextAction ─────────────────────────────────────────

describe('getNextAction', () => {
  it('returns send_quote for draft quote', () => {
    const result = getNextAction({ status: 'draft', entityType: 'quote' });
    expect(result.type).toBe('send_quote');
    expect(result.label).toBe('Enviar cotización');
  });

  it('returns convert_to_work_order for approved quote', () => {
    const result = getNextAction({ status: 'approved', entityType: 'quote' });
    expect(result.type).toBe('convert_to_work_order');
    expect(result.label).toBe('Convertir a orden de trabajo');
  });

  it('returns review_and_requote for expired quote', () => {
    const result = getNextAction({ status: 'expired', entityType: 'quote' });
    expect(result.type).toBe('review_and_requote');
    expect(result.label).toBe('Revisar y re-cotizar');
  });

  it('returns contact_client for sent quote expiring within 7 days', () => {
    const future = new Date();
    future.setDate(future.getDate() + 3);
    const result = getNextAction({
      status: 'sent',
      entityType: 'quote',
      validUntil: future.toISOString(),
    });
    expect(result.type).toBe('contact_client');
    expect(result.label).toBe('Contactar cliente');
  });

  it('returns go_to_negotiation for sent quote with counteroffer negotiation', () => {
    const future = new Date();
    future.setDate(future.getDate() + 30);
    const result = getNextAction({
      status: 'sent',
      entityType: 'quote',
      validUntil: future.toISOString(),
      hasNegotiationWithCounteroffer: true,
    });
    expect(result.type).toBe('go_to_negotiation');
    expect(result.label).toBe('Ir a negociación');
  });

  it('returns follow_up for sent quote without special conditions', () => {
    const future = new Date();
    future.setDate(future.getDate() + 30);
    const result = getNextAction({
      status: 'sent',
      entityType: 'quote',
      validUntil: future.toISOString(),
      hasNegotiationWithCounteroffer: false,
    });
    expect(result.type).toBe('follow_up');
    expect(result.label).toBe('Dar seguimiento');
  });

  it('returns respond_counteroffer for negotiation with counteroffer_made', () => {
    const result = getNextAction({
      status: 'counteroffer_made',
      entityType: 'negotiation',
    });
    expect(result.type).toBe('respond_counteroffer');
    expect(result.label).toBe('Responder contraoferta');
  });

  it('returns none for unmatched states', () => {
    const result = getNextAction({ status: 'cancelled', entityType: 'quote' });
    expect(result.type).toBe('none');
    expect(result.label).toBe('—');
  });

  it('returns none for open negotiation', () => {
    const result = getNextAction({ status: 'open', entityType: 'negotiation' });
    expect(result.type).toBe('none');
    expect(result.label).toBe('—');
  });

  it('prioritizes contact_client over go_to_negotiation when both apply', () => {
    const future = new Date();
    future.setDate(future.getDate() + 3);
    const result = getNextAction({
      status: 'sent',
      entityType: 'quote',
      validUntil: future.toISOString(),
      hasNegotiationWithCounteroffer: true,
    });
    expect(result.type).toBe('contact_client');
  });
});

// ── getExpiryBadge ─────────────────────────────────────────

describe('getExpiryBadge', () => {
  it('returns expired badge for past validUntil', () => {
    const past = new Date();
    past.setDate(past.getDate() - 1);
    const result = getExpiryBadge({ status: 'sent', validUntil: past.toISOString() });
    expect(result.type).toBe('expired');
    expect(result.label).toBe('Vencida');
    expect(result.colorClass).toContain('red');
  });

  it('returns expiring badge for validUntil within 7 days', () => {
    const future = new Date();
    future.setDate(future.getDate() + 3);
    const result = getExpiryBadge({ status: 'sent', validUntil: future.toISOString() });
    expect(result.type).toBe('expiring');
    expect(result.label).toContain('Por vencer');
    expect(result.colorClass).toContain('orange');
  });

  it('returns none for validUntil beyond 7 days', () => {
    const future = new Date();
    future.setDate(future.getDate() + 30);
    const result = getExpiryBadge({ status: 'sent', validUntil: future.toISOString() });
    expect(result.type).toBe('none');
  });

  it('returns none for approved entities even with past validUntil', () => {
    const past = new Date();
    past.setDate(past.getDate() - 5);
    const result = getExpiryBadge({ status: 'approved', validUntil: past.toISOString() });
    expect(result.type).toBe('none');
  });

  it('returns none for accepted negotiations even with past validUntil', () => {
    const past = new Date();
    past.setDate(past.getDate() - 5);
    const result = getExpiryBadge({ status: 'accepted', validUntil: past.toISOString() });
    expect(result.type).toBe('none');
  });

  it('returns none when no validUntil', () => {
    const result = getExpiryBadge({ status: 'draft', validUntil: null });
    expect(result.type).toBe('none');
  });
});

// ── getStatusColor ─────────────────────────────────────────

describe('getStatusColor', () => {
  it('returns green for approved', () => {
    expect(getStatusColor('approved')).toBe('#16A34A');
  });

  it('returns green for accepted', () => {
    expect(getStatusColor('accepted')).toBe('#16A34A');
  });

  it('returns gray for draft', () => {
    expect(getStatusColor('draft')).toBe('#6B7280');
  });

  it('returns null for sent', () => {
    expect(getStatusColor('sent')).toBeNull();
  });

  it('returns null for rejected', () => {
    expect(getStatusColor('rejected')).toBeNull();
  });

  it('returns null for cancelled', () => {
    expect(getStatusColor('cancelled')).toBeNull();
  });

  it('returns null for expired', () => {
    expect(getStatusColor('expired')).toBeNull();
  });

  it('returns null for open', () => {
    expect(getStatusColor('open')).toBeNull();
  });

  it('returns null for counteroffer_made', () => {
    expect(getStatusColor('counteroffer_made')).toBeNull();
  });
});

// ── mergeQuotesAndNegotiations ─────────────────────────────

describe('mergeQuotesAndNegotiations', () => {
  it('merges and sorts by createdAt descending', () => {
    const quotes: ApiQuote[] = [
      { _id: 'q1', number: 'Q-001', status: 'draft', total: 1000, subtotal: 1000, title: 'Quote 1', createdAt: '2026-06-01T00:00:00Z' },
      { _id: 'q2', number: 'Q-002', status: 'sent', total: 2000, subtotal: 2000, title: 'Quote 2', createdAt: '2026-06-03T00:00:00Z' },
    ];
    const negotiations: ApiNegotiation[] = [
      { _id: 'n1', status: 'open', leadId: null, counterOffers: [], createdAt: '2026-06-02T00:00:00Z' },
    ];

    const result = mergeQuotesAndNegotiations(quotes, negotiations);

    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('q2');
    expect(result[1].id).toBe('n1');
    expect(result[2].id).toBe('q1');
  });

  it('returns empty array when both inputs are empty', () => {
    const result = mergeQuotesAndNegotiations([], []);
    expect(result).toHaveLength(0);
  });

  it('sets entityType correctly', () => {
    const quotes: ApiQuote[] = [
      { _id: 'q1', number: 'Q-001', status: 'draft', total: 500, subtotal: 500, title: 'Q', createdAt: '2026-06-01T00:00:00Z' },
    ];
    const negotiations: ApiNegotiation[] = [
      { _id: 'n1', status: 'open', leadId: null, counterOffers: [], createdAt: '2026-06-01T00:00:00Z' },
    ];

    const result = mergeQuotesAndNegotiations(quotes, negotiations);
    expect(result.find(r => r.id === 'q1')?.entityType).toBe('quote');
    expect(result.find(r => r.id === 'n1')?.entityType).toBe('negotiation');
  });

  it('handles null totals for negotiations', () => {
    const negotiations: ApiNegotiation[] = [
      { _id: 'n1', status: 'open', leadId: null, counterOffers: [], createdAt: '2026-06-01T00:00:00Z' },
    ];
    const result = mergeQuotesAndNegotiations([], negotiations);
    expect(result[0].total).toBeNull();
  });

  it('uses last counteroffer amount as total for negotiations', () => {
    const negotiations: ApiNegotiation[] = [
      {
        _id: 'n1', status: 'counteroffer_made', leadId: null,
        counterOffers: [
          { amount: 1000, terms: '', createdBy: null, validUntil: null, createdAt: '2026-06-01T00:00:00Z' },
          { amount: 1500, terms: '', createdBy: null, validUntil: null, createdAt: '2026-06-02T00:00:00Z' },
        ],
        createdAt: '2026-06-01T00:00:00Z',
      },
    ];
    const result = mergeQuotesAndNegotiations([], negotiations);
    expect(result[0].total).toBe(1500);
  });
});
