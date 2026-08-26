import { describe, expect, it } from 'vitest';

import {
  DESIGN_SCOPE_RANGE_M,
  DESIGN_SIZE_PX,
  carBearingSpan,
  collapseLaneRows,
  rangeRingRadii,
  readableOn,
  resolveScopeScale,
} from './radar-scope-utils';

const CAR_LENGTH_M = 4.6;

describe('resolveScopeScale', () => {
  it('keeps the scope constant while the widget zooms', () => {
    const small = resolveScopeScale({
      scaleMode: 'fixed-scope',
      scopeRange: 10,
      radiusPx: DESIGN_SIZE_PX / 2,
      widgetScale: 1,
    });

    const large = resolveScopeScale({
      scaleMode: 'fixed-scope',
      scopeRange: 10,
      radiusPx: DESIGN_SIZE_PX,
      widgetScale: 2,
    });

    expect(small.rangeMeters).toBeCloseTo(DESIGN_SCOPE_RANGE_M);
    expect(large.rangeMeters).toBeCloseTo(DESIGN_SCOPE_RANGE_M);
    expect(large.pxPerMeter).toBeCloseTo(small.pxPerMeter * 2);
  });

  it('keeps the car size constant while the scope grows', () => {
    const small = resolveScopeScale({
      scaleMode: 'fixed-cars',
      scopeRange: 10,
      radiusPx: DESIGN_SIZE_PX / 2,
      widgetScale: 1,
    });

    const large = resolveScopeScale({
      scaleMode: 'fixed-cars',
      scopeRange: 10,
      radiusPx: DESIGN_SIZE_PX,
      widgetScale: 2,
    });

    expect(large.pxPerMeter).toBe(small.pxPerMeter);
    expect(large.rangeMeters).toBeCloseTo(small.rangeMeters * 2);
  });

  it('takes the manual range as the scope, whatever the size', () => {
    const scale = resolveScopeScale({
      scaleMode: 'manual',
      scopeRange: 18,
      radiusPx: 120,
      widgetScale: 1.33,
    });

    expect(scale.rangeMeters).toBe(18);
    expect(scale.pxPerMeter).toBeCloseTo(120 / 18);
  });
});

describe('rangeRingRadii', () => {
  it('follows the scope: half of it, and its rim', () => {
    expect(rangeRingRadii(10)).toEqual([5, 10]);
    expect(rangeRingRadii(20)).toEqual([10, 20]);
  });
});

describe('carBearingSpan', () => {
  it('widens as the opponent closes in', () => {
    const near = carBearingSpan(0, 6, CAR_LENGTH_M);
    const far = carBearingSpan(0, 20, CAR_LENGTH_M);

    expect(near.half).toBeGreaterThan(far.half);
  });

  it('points at the opponent, not at its side of the car', () => {
    const ahead = carBearingSpan(0, 8, CAR_LENGTH_M);
    const left = carBearingSpan(-3.4, 0, CAR_LENGTH_M);

    expect(ahead.center).toBeCloseTo(0, 5);
    expect(left.center).toBeCloseTo(-Math.PI / 2, 1);
  });
});

describe('collapseLaneRows', () => {
  it('counts cars sharing a row rather than inventing a column', () => {
    expect(collapseLaneRows([0.4, 1.1])).toEqual([
      { longitudinal: 0.4, count: 2 },
    ]);
  });

  it('keeps a queue as separate rows, nearest first', () => {
    expect(collapseLaneRows([-5.5, 0.5])).toEqual([
      { longitudinal: 0.5, count: 1 },
      { longitudinal: -5.5, count: 1 },
    ]);
  });
});

describe('readableOn', () => {
  it('goes dark on a light body and light on a dark one', () => {
    expect(readableOn('rgba(250, 250, 250, 0.82)')).toContain('8, 9, 10');
    expect(readableOn('#1b1d21')).toContain('250, 250, 250');
  });
});
