import { describe, expect, it } from 'vitest';

import { buildSpeedRow, SPEED_GREEN_SHARE } from './pit-line-utils';

describe('buildSpeedRow', () => {
  const LIMIT = 20;
  const STEADY = 0;

  it('puts the limit itself on the seam between the two tracks', () => {
    const view = buildSpeedRow(LIMIT, LIMIT, STEADY);

    expect(view.fill).toBeCloseTo(SPEED_GREEN_SHARE, 5);
    expect(view.overFill).toBe(0);
    expect(view.isOver).toBe(false);
  });

  it('scales the green track linearly up to the limit', () => {
    const view = buildSpeedRow(LIMIT / 2, LIMIT, STEADY);

    expect(view.fill).toBeCloseTo(SPEED_GREEN_SHARE / 2, 5);
  });

  it('spends the red tip on the overspeed range', () => {
    // 10% over the limit is half of the 20% over-range.
    const view = buildSpeedRow(LIMIT * 1.1, LIMIT, STEADY);

    expect(view.overFill).toBeCloseTo((1 - SPEED_GREEN_SHARE) / 2, 5);
    expect(view.isOver).toBe(true);
  });

  it('clamps well past the limit instead of overflowing the row', () => {
    const view = buildSpeedRow(LIMIT * 3, LIMIT, STEADY);

    expect(view.fill + view.overFill).toBeCloseTo(1, 5);
  });

  it('marks the lift band ahead of the fill while the car is still gaining', () => {
    const view = buildSpeedRow(LIMIT / 2, LIMIT, 5);

    expect(view.liftStart).toBeCloseTo(view.fill, 5);
    expect(view.liftWidth).toBeGreaterThan(0);
  });

  it('drops the lift band once the throttle is no longer adding speed', () => {
    const view = buildSpeedRow(LIMIT / 2, LIMIT, -2);

    expect(view.liftStart).toBeNull();
    expect(view.liftWidth).toBeNull();
  });

  it('draws nothing when the track reports no pit limit', () => {
    const view = buildSpeedRow(15, 0, STEADY);

    expect(view.fill).toBe(0);
    expect(view.overFill).toBe(0);
  });
});
