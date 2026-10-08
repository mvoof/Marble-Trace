import { describe, expect, it } from 'vitest';

import {
  DESIGN_SCOPE_RANGE_M,
  SIDE_LATERAL_OFFSET_M,
  resolveScopeScale,
  scopeDistanceOf,
} from './radar-constants';

describe('resolveScopeScale', () => {
  it('keeps the range the user set while the widget zooms', () => {
    const small = resolveScopeScale({ scopeRange: 10, radiusPx: 90 });
    const large = resolveScopeScale({ scopeRange: 10, radiusPx: 180 });

    expect(small.rangeMeters).toBe(10);
    expect(large.rangeMeters).toBe(10);
    expect(large.pxPerMeter).toBeCloseTo(small.pxPerMeter * 2);
  });

  it('falls back to the design range on a zero or broken value', () => {
    expect(resolveScopeScale({ scopeRange: 0, radiusPx: 90 }).rangeMeters).toBe(
      DESIGN_SCOPE_RANGE_M
    );
    expect(
      resolveScopeScale({ scopeRange: Number.NaN, radiusPx: 90 }).rangeMeters
    ).toBe(DESIGN_SCOPE_RANGE_M);
  });
});

describe('scopeDistanceOf', () => {
  it('measures a car ahead or behind along the lane', () => {
    expect(
      scopeDistanceOf({ longitudinalDist: -7.5, lateralSide: 'center' })
    ).toBeCloseTo(7.5);
  });

  it('measures a car alongside as the hypotenuse it is drawn at', () => {
    expect(
      scopeDistanceOf({ longitudinalDist: 0, lateralSide: 'left' })
    ).toBeCloseTo(SIDE_LATERAL_OFFSET_M);

    expect(
      scopeDistanceOf({ longitudinalDist: 3, lateralSide: 'right' })
    ).toBeCloseTo(Math.hypot(SIDE_LATERAL_OFFSET_M, 3));
  });
});
