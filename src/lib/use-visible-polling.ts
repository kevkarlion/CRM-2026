'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useVisiblePolling — visibility-aware, keyed-dedup, backoff-capped polling.
 *
 * Polls ONLY while the tab is visible AND focused. Pauses immediately on
 * hidden/blur, resumes (with a soft refetch when `refetchOnFocus`) on regain.
 * Applies exponential backoff after repeated failures (interval doubles every
 * 3 consecutive failures, capped at `backoffMax`) and resets to the base
 * interval on any success. Concurrent mounts sharing the same `key` run a
 * single poll loop (keyed dedup): the last-mounted fetcher drives the loop,
 * and the loop lives until the LAST mount unmounts.
 *
 * Key scheme (documented — call sites must agree on the same format to dedupe):
 * - `chat:<phoneNumber>`           → one loop per WhatsApp conversation
 * - `follow-up-marks:all`          → pipeline badges + AttentionToast share this
 * - `follow-up-marks:user:<email>` → per-user marks in the "Mi Atención" page
 * - `notifications:work-reports`   → WorkReportToast
 * - `pipeline:board`               → PipelineBoard aggregate refresh
 * - `conversations:status`         → useConversationStatus (global conversations)
 * - `conversations:handoffs`       → usePendingHandoffs
 * - `map:markers`                  → Mapa Operativo 30s refresh
 */

export interface UseVisiblePollingOptions {
  /** Key shared across mounts that must dedupe into one poll loop. */
  key: string;
  /** Function invoked on each poll tick. May return a promise. */
  fetcher: () => unknown | Promise<unknown>;
  /** Base interval in ms between polls while visible+focused. */
  interval: number;
  /** Mount contributes to its key's loop only while enabled. @default true */
  enabled?: boolean;
  /** Exponential-backoff cap in ms. @default 60000 */
  backoffMax?: number;
  /** Soft-refetch immediately when the tab regains focus/visibility. @default true */
  refetchOnFocus?: boolean;
}

export interface UseVisiblePollingResult {
  data: unknown;
  error: unknown;
  isLoading: boolean;
  refetch: () => Promise<void>;
  lastUpdatedAt: number | null;
}

interface MountRegistration {
  enabled: boolean;
}

interface SharedLoop {
  fetcher: () => unknown | Promise<unknown>;
  interval: number;
  backoffMax: number;
  refetchOnFocus: boolean;
  mounts: Set<MountRegistration>;
  timer: ReturnType<typeof setTimeout> | null;
  inFlight: Promise<void> | null;
  consecutiveFailures: number;
  currentInterval: number;
  wasActive: boolean;
  everActive: boolean;
  lastData: unknown;
  lastError: unknown;
  lastUpdatedAt: number | null;
  listeners: Set<() => void>;
}

const loops = new Map<string, SharedLoop>();

const gate = { visible: true, focused: true };
let gateBound = false;

function readVisible(): boolean {
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}

function readFocused(): boolean {
  return typeof document === 'undefined' || document.hasFocus();
}

function bindVisibilityGates(): void {
  if (gateBound) return;
  gateBound = true;
  gate.visible = readVisible();
  gate.focused = readFocused();

  document.addEventListener('visibilitychange', () => {
    gate.visible = readVisible();
    syncAllLoops();
  });
  window.addEventListener('focus', () => {
    gate.focused = readFocused();
    syncAllLoops();
  });
  window.addEventListener('blur', () => {
    gate.focused = readFocused();
    syncAllLoops();
  });
}

function createLoop(): SharedLoop {
  return {
    fetcher: () => undefined,
    interval: 10000,
    backoffMax: 60000,
    refetchOnFocus: true,
    mounts: new Set(),
    timer: null,
    inFlight: null,
    consecutiveFailures: 0,
    currentInterval: 10000,
    wasActive: false,
    everActive: false,
    lastData: undefined,
    lastError: undefined,
    lastUpdatedAt: null,
    listeners: new Set(),
  };
}

function snapshotOf(loop: SharedLoop): UseVisiblePollingResult {
  return {
    data: loop.lastData,
    error: loop.lastError,
    isLoading: loop.inFlight !== null,
    refetch: () => refetchLoop(loop),
    lastUpdatedAt: loop.lastUpdatedAt,
  };
}

function loopActive(loop: SharedLoop): boolean {
  if (!gate.visible || !gate.focused) return false;
  for (const mount of loop.mounts) {
    if (mount.enabled) return true;
  }
  return false;
}

function notify(loop: SharedLoop): void {
  for (const listener of loop.listeners) listener();
}

function clearTimer(loop: SharedLoop): void {
  if (loop.timer !== null) {
    clearTimeout(loop.timer);
    loop.timer = null;
  }
}

function schedule(loop: SharedLoop): void {
  if (!loopActive(loop)) return;
  if (loop.timer !== null) return;
  loop.timer = setTimeout(() => {
    loop.timer = null;
    void run(loop);
  }, loop.currentInterval);
}

async function run(loop: SharedLoop): Promise<void> {
  clearTimer(loop);

  if (!loopActive(loop)) return;

  // Single-flight: a fetch already in progress skips this tick entirely.
  if (loop.inFlight) {
    schedule(loop);
    return;
  }

  let releaseInFlight!: () => void;
  loop.inFlight = new Promise<void>((resolve) => {
    releaseInFlight = resolve;
  });
  notify(loop);

  try {
    const result = await Promise.resolve(loop.fetcher());
    loop.consecutiveFailures = 0;
    loop.currentInterval = loop.interval;
    loop.lastData = result;
    loop.lastError = undefined;
    loop.lastUpdatedAt = Date.now();
  } catch (error) {
    loop.lastError = error;
    loop.consecutiveFailures += 1;
    if (loop.consecutiveFailures >= 3) {
      const multiplier = 2 ** Math.floor(loop.consecutiveFailures / 3);
      loop.currentInterval = Math.min(loop.interval * multiplier, loop.backoffMax);
    }
  } finally {
    loop.inFlight = null;
    releaseInFlight();
    notify(loop);
    if (loopActive(loop) && loop.timer === null) {
      schedule(loop);
    }
  }
}

function refetchLoop(loop: SharedLoop): Promise<void> {
  if (!loopActive(loop)) return Promise.resolve();
  if (loop.inFlight) return loop.inFlight;
  void run(loop);
  return loop.inFlight ?? Promise.resolve();
}

function syncAllLoops(): void {
  for (const loop of loops.values()) syncLoop(loop);
}

function syncLoop(loop: SharedLoop): void {
  const active = loopActive(loop);
  if (!active) {
    if (loop.wasActive) {
      loop.wasActive = false;
      clearTimer(loop);
    }
    return;
  }

  const justActivated = !loop.wasActive;
  loop.wasActive = true;

  if (justActivated) {
    clearTimer(loop);
    if (loop.everActive && loop.refetchOnFocus && loop.inFlight === null) {
      void refetchLoop(loop);
    } else if (loop.timer === null) {
      schedule(loop);
    }
    loop.everActive = true;
  } else {
    schedule(loop);
  }
}

export function useVisiblePolling(options: UseVisiblePollingOptions): UseVisiblePollingResult {
  const { key, fetcher, interval, enabled = true, backoffMax = 60000, refetchOnFocus = true } =
    options;

  const registrationRef = useRef<MountRegistration | null>(null);
  const [snapshot, setSnapshot] = useState<UseVisiblePollingResult>(() => {
    const loop = loops.get(key);
    return loop ? snapshotOf(loop) : snapshotOf(createLoop());
  });

  const handleChange = useCallback(() => {
    setSnapshot((prev) => {
      const loop = loops.get(key);
      return loop ? snapshotOf(loop) : prev;
    });
  }, [key]);

  useEffect(() => {
    bindVisibilityGates();

    let loop = loops.get(key);
    if (!loop) {
      loop = createLoop();
      loops.set(key, loop);
    }

    const registration: MountRegistration = { enabled };
    registrationRef.current = registration;

    loop.interval = interval;
    loop.currentInterval = interval;
    loop.backoffMax = backoffMax;
    loop.refetchOnFocus = refetchOnFocus;
    loop.fetcher = fetcher;
    loop.mounts.add(registration);
    loop.listeners.add(handleChange);

    setSnapshot(snapshotOf(loop));
    syncLoop(loop);

    return () => {
      loop.mounts.delete(registration);
      loop.listeners.delete(handleChange);
      if (loop.mounts.size === 0) {
        clearTimer(loop);
        loops.delete(key);
      } else {
        syncLoop(loop);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    const loop = loops.get(key);
    if (!loop) return;
    loop.interval = interval;
    loop.backoffMax = backoffMax;
    loop.refetchOnFocus = refetchOnFocus;
    loop.currentInterval = loop.interval;
    syncLoop(loop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, interval, backoffMax, refetchOnFocus]);

  useEffect(() => {
    const loop = loops.get(key);
    if (!loop) return;
    loop.fetcher = fetcher;
  }, [key, fetcher]);

  useEffect(() => {
    const loop = loops.get(key);
    if (!loop) return;
    const registration = registrationRef.current;
    if (!registration || registration.enabled === enabled) return;
    registration.enabled = enabled;
    syncLoop(loop);
  }, [key, enabled]);

  const refetch = useCallback(() => {
    const loop = loops.get(key);
    return loop ? refetchLoop(loop) : Promise.resolve();
  }, [key]);

  return {
    data: snapshot.data,
    error: snapshot.error,
    isLoading: snapshot.isLoading,
    refetch,
    lastUpdatedAt: snapshot.lastUpdatedAt,
  };
}

/**
 * Chat dedup key: one loop per WhatsApp conversation so LeadChatDrawer, the
 * WhatsApp page center and the lead/client detail pages never triple-fetch the
 * same conversation's messages. A missing phone collapses to a stable key so
 * all "no active chat" mounts share one (inert) loop.
 */
export function chatPollingKey(phone: string | null | undefined): string {
  return phone ? `chat:${phone}` : 'chat:__none__';
}