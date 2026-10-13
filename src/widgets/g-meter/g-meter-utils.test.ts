import { describe, expect, it } from 'vitest';

import { decayOver, smoothingOver, ticksElapsed } from './g-meter-utils';

const FRAME_60_HZ_MS = 1000 / 60;
const FRAME_30_HZ_MS = 1000 / 30;

/** One step of the per-frame filter, as it ran at 60 Hz. */
const stepOnce = (smoothed: number, raw: number): number =>
  smoothed + (raw - smoothed) * smoothingOver(1);

describe('g-meter rates over elapsed time', () => {
  it('counts a 60 Hz frame as one tick and a 30 Hz frame as two', () => {
    expect(ticksElapsed(FRAME_60_HZ_MS)).toBeCloseTo(1);
    expect(ticksElapsed(FRAME_30_HZ_MS)).toBeCloseTo(2);
  });

  // The point of the change: the dot sits where it would have at 60 Hz,
  // whatever clock the overlay publishes on.
  it('smooths one 30 Hz frame exactly as two 60 Hz ones', () => {
    const raw = 1.5;
    const twoSixtyHzSteps = stepOnce(stepOnce(0, raw), raw);
    const oneThirtyHzStep = raw * smoothingOver(ticksElapsed(FRAME_30_HZ_MS));

    expect(oneThirtyHzStep).toBeCloseTo(twoSixtyHzSteps);
  });

  it('fades one 30 Hz frame exactly as two 60 Hz ones', () => {
    expect(decayOver(ticksElapsed(FRAME_30_HZ_MS))).toBeCloseTo(
      decayOver(1) ** 2
    );
  });

  // A paused replay or a stalled stream must not read as seconds of motion.
  it('caps a long gap instead of jumping to the new reading', () => {
    expect(smoothingOver(ticksElapsed(10_000))).toBeLessThan(1);
    expect(ticksElapsed(10_000)).toBe(ticksElapsed(250));
  });

  it('treats a clock that went backwards as no time', () => {
    expect(ticksElapsed(-5)).toBe(0);
  });
});
