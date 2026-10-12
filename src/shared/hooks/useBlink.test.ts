import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BLINK_STEP_ATTRIBUTE, createBlink, type BlinkCycle } from './useBlink';

const HALF_SECOND: BlinkCycle = { stepMs: 500, steps: 2 };

// The blink lands a millisecond past each boundary, so a read there is unambiguous.
const PAST_BOUNDARY_MS = 1;

// Only the three attribute methods the blink touches; there is no DOM in the
// test environment.
const fakeElement = () => {
  const attributes = new Map<string, string>();
  const writes: string[] = [];

  const element = {
    getAttribute: (name: string) => attributes.get(name) ?? null,
    setAttribute: (name: string, value: string) => {
      attributes.set(name, value);
      writes.push(value);
    },
    removeAttribute: (name: string) => {
      attributes.delete(name);
      writes.push('removed');
    },
  };

  return {
    element: element as unknown as Element,
    step: () => attributes.get(BLINK_STEP_ATTRIBUTE) ?? null,
    writes,
  };
};

describe('createBlink', () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'performance'],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes the step off the page clock and moves it on each boundary', () => {
    const target = fakeElement();
    const blink = createBlink();

    vi.advanceTimersByTime(HALF_SECOND.stepMs);
    blink.attach(target.element);
    blink.run(HALF_SECOND);

    expect(target.step()).toBe('1');

    vi.advanceTimersByTime(HALF_SECOND.stepMs + PAST_BOUNDARY_MS);

    expect(target.step()).toBe('0');

    blink.run(null);
  });

  it('writes the DOM only when the step changes', () => {
    const target = fakeElement();
    const blink = createBlink();

    blink.attach(target.element);
    blink.run(HALF_SECOND);
    vi.advanceTimersByTime(HALF_SECOND.stepMs * 4 + PAST_BOUNDARY_MS);

    expect(target.writes).toEqual(['0', '1', '0', '1', '0']);

    blink.run(null);
  });

  it('keeps two blinks of one cycle in step', () => {
    const first = fakeElement();
    const second = fakeElement();
    const firstBlink = createBlink();
    const secondBlink = createBlink();

    firstBlink.attach(first.element);
    firstBlink.run(HALF_SECOND);
    vi.advanceTimersByTime(HALF_SECOND.stepMs + HALF_SECOND.stepMs / 2);
    secondBlink.attach(second.element);
    secondBlink.run(HALF_SECOND);

    expect(second.step()).toBe(first.step());

    firstBlink.run(null);
    secondBlink.run(null);
  });

  it('removes the step and stops the timer when stopped', () => {
    const target = fakeElement();
    const blink = createBlink();

    blink.attach(target.element);
    blink.run(HALF_SECOND);
    blink.run(null);

    expect(target.step()).toBeNull();

    const writesAfterStop = target.writes.length;

    vi.advanceTimersByTime(HALF_SECOND.stepMs * 4);

    expect(target.writes).toHaveLength(writesAfterStop);
  });

  it('does not restart a cycle it is already running', () => {
    const target = fakeElement();
    const blink = createBlink();

    blink.attach(target.element);
    blink.run(HALF_SECOND);
    blink.run({ ...HALF_SECOND });

    expect(vi.getTimerCount()).toBe(1);

    blink.run(null);
  });
});
