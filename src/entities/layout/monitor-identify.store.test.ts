import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MonitorIdentifyStore } from './monitor-identify.store';

describe('MonitorIdentifyStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the number it was sent, then clears itself', () => {
    const identify = new MonitorIdentifyStore();

    identify.show(2);

    expect(identify.number).toBe(2);

    vi.advanceTimersByTime(5000);

    expect(identify.number).toBeNull();
  });

  it('a second press restarts the flash rather than cutting it short', () => {
    const identify = new MonitorIdentifyStore();

    identify.show(1);
    vi.advanceTimersByTime(1000);
    identify.show(1);
    vi.advanceTimersByTime(1000);

    expect(identify.number).toBe(1);
  });
});
