// @vitest-environment jsdom

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockPush = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => '/leads/pipeline',
}));

import { LeadFilters } from '../../src/leads/pipeline-board/components/LeadFilters';

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

describe('LeadFilters', () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.forEach((_, key) => mockSearchParams.delete(key));
  });

  it('renders search input', () => {
    render(<LeadFilters stages={[makeStage() as any]} />);

    const searchInput = screen.getByPlaceholderText(/buscar/i);
    expect(searchInput).toBeDefined();
  });

  it('renders date range inputs', () => {
    render(<LeadFilters stages={[makeStage() as any]} />);

    expect(screen.getByLabelText('Desde')).toBeDefined();
    expect(screen.getByLabelText('Hasta')).toBeDefined();
  });
});
