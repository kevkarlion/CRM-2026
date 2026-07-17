// @vitest-environment jsdom

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SmartTableRow } from '../../src/components/quotes/smart-table-row';
import type { QuoteTableRow } from '../../src/quotes/types/client-quote-types';

function makeRow(overrides: Partial<QuoteTableRow> = {}): QuoteTableRow {
  return {
    id: 'test-1',
    entityType: 'quote',
    clientName: 'Cliente Test',
    companyName: 'Empresa Test',
    status: 'draft',
    total: 500000,
    validUntil: null,
    nextAction: 'none',
    assignedName: 'Juan Pérez',
    createdAt: '2026-06-01T00:00:00Z',
    entityStatus: 'draft',
    ...overrides,
  };
}

function renderRow(row: QuoteTableRow) {
  return render(<table><tbody><SmartTableRow row={row} /></tbody></table>);
}

describe('SmartTableRow', () => {
  it('renders a draft quote', () => {
    renderRow(makeRow());
    expect(screen.getByText('Cliente Test')).toBeTruthy();
    expect(screen.getByText('Borrador')).toBeTruthy();
    expect(screen.getByText('Cotización')).toBeTruthy();
  });

  it('renders an expired quote with expiry badge', () => {
    const past = new Date();
    past.setDate(past.getDate() - 3);
    renderRow(makeRow({
      status: 'expired',
      entityStatus: 'expired',
      validUntil: past.toISOString(),
    }));
    expect(screen.getAllByText('Vencida')).toHaveLength(2);
  });

  it('renders a sent quote with expiring badge', () => {
    const future = new Date();
    future.setDate(future.getDate() + 3);
    renderRow(makeRow({
      status: 'sent',
      entityStatus: 'sent',
      validUntil: future.toISOString(),
    }));
    expect(screen.getByText(/Por vencer/)).toBeTruthy();
  });

  it('renders an approved quote with green status', () => {
    renderRow(makeRow({
      status: 'approved',
      entityStatus: 'approved',
    }));
    const statusEl = screen.getByText('Aprobada');
    expect(statusEl.style.color).toBe('rgb(22, 163, 74)');
  });

  it('renders a negotiation row', () => {
    renderRow(makeRow({
      entityType: 'negotiation',
      status: 'open',
      entityStatus: 'open',
    }));
    expect(screen.getByText('Negociación')).toBeTruthy();
    expect(screen.getByText('Abierta')).toBeTruthy();
  });

  it('renders empty/missing data gracefully', () => {
    renderRow(makeRow({
      total: null,
      assignedName: '',
      companyName: undefined,
      validUntil: null,
    }));
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });
});
