import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  timelineRegister: vi.fn(),
  orchestratorRegister: vi.fn(),
  auditRegister: vi.fn(),
  on: vi.fn(),
}));

vi.mock('@/timeline/handlers/timeline.handler', () => ({
  timelineHandler: { register: hoisted.timelineRegister },
}));

vi.mock('@/timeline/handlers/client-activity.handler', () => ({
  clientActivityOrchestrator: { register: hoisted.orchestratorRegister },
}));

vi.mock('@/audit/handlers/audit.handler', () => ({
  auditHandler: { register: hoisted.auditRegister },
}));

vi.mock('@/infrastructure/events/event-bus', () => ({
  eventBus: { on: hoisted.on, publish: vi.fn() },
}));

import { setupEventHandlers } from '@/infrastructure/events/setup';

describe('setupEventHandlers registration wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers timelineHandler, clientActivityOrchestrator and auditHandler', () => {
    setupEventHandlers();

    expect(hoisted.timelineRegister).toHaveBeenCalledTimes(1);
    expect(hoisted.orchestratorRegister).toHaveBeenCalledTimes(1);
    expect(hoisted.auditRegister).toHaveBeenCalledTimes(1);
  });
});
