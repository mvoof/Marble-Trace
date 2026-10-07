import { describe, expect, it } from 'vitest';

import {
  DESIGN_SCOPE_RANGE_M,
  DESIGN_SIZE_PX,
  SIDE_LATERAL_OFFSET_M,
  resolveScopeScale,
  scopeDistanceOf,
} from './radar-constants';

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
