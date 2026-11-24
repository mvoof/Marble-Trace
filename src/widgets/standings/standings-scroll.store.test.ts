import { afterEach, describe, expect, it, vi } from 'vitest';

import { StandingsScrollStore } from './standings-scroll.store';

describe('StandingsScrollStore reset setting', () => {
  afterEach(() => vi.useRealTimers());

  it('reschedules from the last scroll when the delay changes', () => {
    vi.useFakeTimers();
    let resetSeconds = 8;
    const store = new StandingsScrollStore(() => resetSeconds);
    store.setScrollBounds(new Map([[-1, { total: 10, windowSize: 5 }]]));

    store.scrollByRows(1);
    vi.advanceTimersByTime(3000);
    resetSeconds = 5;
    store.settingsChanged();

    vi.advanceTimersByTime(1999);
    expect(store.isScrolled).toBe(true);
    vi.advanceTimersByTime(1);
    expect(store.isScrolled).toBe(false);
  });

  it('discards queued row input when the inactivity timeout expires', () => {
    vi.useFakeTimers();
    const store = new StandingsScrollStore(() => 1);
    store.setScrollBounds(
      new Map([[10, { total: 5, windowSize: 2 }]]),
      [10, 20],
      1
    );
    store.scrollClasses(1);
    store.scrollByRows(1);

    vi.advanceTimersByTime(1000);
    store.setScrollBounds(
      new Map([[20, { total: 5, windowSize: 2 }]]),
      [10, 20],
      1,
      1
    );

    expect(store.groupScrollIndex).toBe(0);
    expect(store.scrollOffsetFor(20)).toBe(0);
  });

  it('cancels reset while disabled and resets when re-enabled after expiry', () => {
    vi.useFakeTimers();
    let resetSeconds = 0;
    const store = new StandingsScrollStore(() => resetSeconds);
    store.setScrollBounds(new Map([[-1, { total: 10, windowSize: 5 }]]));

    store.scrollByRows(1);
    vi.advanceTimersByTime(10_000);
    expect(store.isScrolled).toBe(true);

    resetSeconds = 1;
    store.settingsChanged();
    vi.advanceTimersByTime(0);

    expect(store.isScrolled).toBe(false);
  });

  it('defers row scrolling until the selected class publishes its bounds', () => {
    const store = new StandingsScrollStore(() => 0);
    store.setScrollBounds(
      new Map([[10, { total: 5, windowSize: 2 }]]),
      [10, 20],
      1
    );

    store.scrollClasses(1);
    store.scrollByRows(1);

    expect(store.groupScrollIndex).toBe(1);
    expect(store.scrollOffsetFor(10)).toBe(0);
    expect(store.scrollOffsetFor(20)).toBe(0);

    store.setScrollBounds(
      new Map([[20, { total: 5, windowSize: 2 }]]),
      [10, 20],
      1,
      0
    );

    expect(store.scrollOffsetFor(20)).toBe(0);

    store.setScrollBounds(
      new Map([[20, { total: 5, windowSize: 2 }]]),
      [10, 20],
      1,
      1
    );

    expect(store.scrollOffsetFor(10)).toBe(0);
    expect(store.scrollOffsetFor(20)).toBe(1);
  });
});
