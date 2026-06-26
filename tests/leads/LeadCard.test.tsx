// @vitest-environment jsdom

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: { toString: () => '' },
  },
}));

import { LeadCard } from '../../src/leads/pipeline-board/components/LeadCard';

function makeLead(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'lead-1',
    tenantId: 'tenant-1',
    name: 'Juan Pérez',
    companyName: 'Acme Corp',
    phone: '+5491123456789',
    email: 'juan@acme.com',
    source: 'whatsapp' as const,
    status: 'new' as const,
    assignedTo: undefined,
    estimatedValue: 12500,
    notes: '',
    createdBy: 'user-1',
    updatedBy: 'user-1',
    deletedAt: null,
    deletedBy: null,
    createdAt: new Date('2026-06-01'),
    ...overrides,
  };
}

describe('LeadCard', () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders lead name, company, phone, status badge', () => {
    render(<LeadCard lead={makeLead() as any} />);

    expect(screen.getByText('Juan Pérez')).toBeDefined();
    expect(screen.getByText('Acme Corp')).toBeDefined();
    expect(screen.getByText('+5491123456789')).toBeDefined();
    expect(screen.getByText('new')).toBeDefined();
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<LeadCard lead={makeLead() as any} onClick={onClick} />);

    const name = screen.getByText('Juan Pérez');
    await user.click(name.closest('[role="button"]')!);

    expect(onClick).toHaveBeenCalledWith('lead-1');
  });

  it('renders correctly with all fields', () => {
    const lead = makeLead({
      estimatedValue: 50000,
      assignedTo: { _id: 'user-2', name: 'Carlos Gómez' },
    });
    render(<LeadCard lead={lead as any} />);

    expect(screen.getByText('Juan Pérez')).toBeDefined();
    expect(screen.getByText('Acme Corp')).toBeDefined();
    expect(screen.getByText('$50.000')).toBeDefined();
    expect(screen.getByText('Carlos Gómez')).toBeDefined();
  });

  it('status badge shows correct status', () => {
    const statuses = ['new', 'contacted', 'qualified', 'won', 'lost', 'disqualified'];

    for (const status of statuses) {
      const { unmount } = render(<LeadCard lead={makeLead({ status }) as any} />);
      expect(screen.getByText(status)).toBeDefined();
      unmount();
    }
  });
});
