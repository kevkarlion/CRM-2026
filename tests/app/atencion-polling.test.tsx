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

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('lucide-react', () => ({ Inbox: () => <div data-testid="inbox" /> }));

const fetchMarksMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/leads/pipeline-board/hooks/useFollowUpMarks', () => ({
  useFollowUpMarks: () => ({
    marks: [],
    loading: false,
    error: null,
    fetchMarks: (...args: unknown[]) => fetchMarksMock(...args),
    deleteMark: vi.fn().mockResolvedValue(true),
  }),
}));

vi.mock('@/components/ui/ConfirmModal', () => ({
  ConfirmModal: () => <div data-testid="confirm" />,
}));

import { useVisiblePolling } from '@/lib/use-visible-polling';
const useVisiblePollingMock = vi.mocked(useVisiblePolling);

import { render } from '@testing-library/react';
import AtencionPage from '@/app/(dashboard)/atencion/page';

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  // Provide an authenticated token so the page gets a currentUser and runs polling.
  const payload = btoa(JSON.stringify({ userId: 'u1', email: 'user@example.com', tenantId: 't1' }));
  localStorage.setItem('token', `header.${payload}.sig`);
});

afterEach(() => {
  localStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('AtencionPage polling', () => {
  it('uses useVisiblePolling with per-user key follow-up-marks:user:<email> at 15s', () => {
    render(<AtencionPage />);
    const calls = useVisiblePollingMock.mock.calls;
    const userCall = calls.find(([o]) => o.key === 'follow-up-marks:user:user@example.com');
    expect(userCall).toBeTruthy();
    expect(userCall![0].interval).toBe(15000);
  });

  it('does not register a raw 15s setInterval (visibility-aware hook)', () => {
    render(<AtencionPage />);
    const spy = vi.spyOn(global, 'setInterval');
    const setIntervalCalls = spy.mock.calls.filter(
      ([, ms]) => typeof ms === 'number' && ms === 15000,
    );
    expect(setIntervalCalls).toHaveLength(0);
  });
});
