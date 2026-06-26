// @vitest-environment jsdom

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('@dnd-kit/core', () => ({
  useDroppable: () => ({
    isOver: false,
    setNodeRef: () => {},
  }),
}));

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

import { PipelineColumn } from '../../src/leads/pipeline-board/components/PipelineColumn';

function makeStage(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Nuevo contacto',
    position: 0,
    probability: 10,
    isActive: true,
    mapsToStatus: 'new' as const,
    ...overrides,
  };
}

function makeLead(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'lead-1',
    tenantId: 'tenant-1',
    name: 'Juan Pérez',
    companyName: 'Acme Corp',
    phone: '+5491123456789',
    source: 'whatsapp' as const,
    status: 'new' as const,
    createdAt: new Date('2026-06-01'),
    estimatedValue: 12500,
    ...overrides,
  };
}

describe('PipelineColumn', () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders column with stage header', () => {
    render(<PipelineColumn stage={makeStage() as any} leads={[]} />);

    expect(screen.getByText('Nuevo contacto')).toBeDefined();
  });

  it('shows leads when provided', () => {
    const leads = [
      makeLead({ _id: 'lead-1', name: 'Juan Pérez' }),
      makeLead({ _id: 'lead-2', name: 'María García' }),
      makeLead({ _id: 'lead-3', name: 'Pedro López' }),
    ] as any;

    render(<PipelineColumn stage={makeStage() as any} leads={leads} />);

    expect(screen.getByText('Juan Pérez')).toBeDefined();
    expect(screen.getByText('María García')).toBeDefined();
    expect(screen.getByText('Pedro López')).toBeDefined();
  });

  it('shows "No hay leads en esta etapa" when empty', () => {
    render(<PipelineColumn stage={makeStage() as any} leads={[]} />);

    expect(screen.getByText('No hay leads en esta etapa')).toBeDefined();
  });

  it('shows skeleton cards when isLoading', () => {
    const { container } = render(
      <PipelineColumn stage={makeStage() as any} leads={[]} isLoading={true} />,
    );

    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });
});
