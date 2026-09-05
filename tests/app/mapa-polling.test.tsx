// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/use-visible-polling', () => ({
  useVisiblePolling: vi.fn(() => ({
    data: undefined,
    error: null,
    isLoading: false,
    refetch: vi.fn().mockResolvedValue(undefined),
    lastUpdatedAt: null,
  })),
  chatPollingKey: (p: string | null | undefined) => (p ? `chat:${p}` : 'chat:__none__'),
}));

vi.mock('next/dynamic', () => ({
  default: () => function MockMap() {
    return <div data-testid="mock-map" />;
  },
}));

vi.mock('@/dashboard/context/role-context', () => ({
  useRole: () => ({ user: { name: 'Test' }, isTechnician: false }),
}));

vi.mock('@/components/map/MapFilters', () => ({
  MapFilters: () => <div data-testid="mock-filters" />,
}));

vi.mock('@/operations/config/technician-colors', () => ({
  getTechniciansWithColors: () => [],
}));

import { useVisiblePolling } from '@/lib/use-visible-polling';
const useVisiblePollingMock = vi.mocked(useVisiblePolling);

import { render } from '@testing-library/react';
import MapaOperativoPage from '@/app/(dashboard)/mapa/page';

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  Object.defineProperty(window.navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: vi.fn(), watchPosition: vi.fn() },
  });
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ markers: [], data: [] }),
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('MapaOperativoPage polling', () => {
  it('uses useVisiblePolling with key map:markers at 30s', () => {
    render(<MapaOperativoPage />);
    const mapCall = useVisiblePollingMock.mock.calls.find(([o]) => o.key === 'map:markers');
    expect(mapCall).toBeTruthy();
    expect(mapCall![0].interval).toBe(30000);
  });

  it('does not drive refresh with a bare setInterval (visibility-aware hook)', () => {
    render(<MapaOperativoPage />);
    const spy = vi.spyOn(global, 'setInterval');
    const setIntervalCalls = spy.mock.calls.filter(
      ([, ms]) => typeof ms === 'number' && ms === 30000,
    );
    // The hook is mocked, so the page itself must NOT register a raw 30s interval.
    expect(setIntervalCalls).toHaveLength(0);
  });
});
