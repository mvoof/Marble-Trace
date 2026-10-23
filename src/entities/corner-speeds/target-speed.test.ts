import { describe, expect, it } from 'vitest';

import type { CornerSpeedsFrame } from '@shared/contracts/generated/bindings';
import { MPS_TO_KMH } from '@shared/lib/telemetry-format';
import { targetSpeedState } from './target-speed';

const KMH = 1 / MPS_TO_KMH;

// Past the entry: the apex, 100 km/h, is the lit target.
const HEADING_FOR_APEX: CornerSpeedsFrame = {
  entry: 200 * KMH,
  apex: 100 * KMH,
  exit: 150 * KMH,
  entryPassed: true,
  apexPassed: false,
  exitPassed: false,
  fromReference: true,
};

describe('targetSpeedState', () => {
  it('is over while the car is still faster than the target', () => {
    expect(targetSpeedState(140 * KMH, HEADING_FOR_APEX)).toBe('over');
  });

  it('is on target within 5 km/h either way', () => {
    expect(targetSpeedState(104 * KMH, HEADING_FOR_APEX)).toBe('onTarget');
    expect(targetSpeedState(96 * KMH, HEADING_FOR_APEX)).toBe('onTarget');
  });

  it('is nothing below the target', () => {
    expect(targetSpeedState(90 * KMH, HEADING_FOR_APEX)).toBeNull();
  });

  it('is nothing on the car’s own speeds or with no frame', () => {
    expect(
      targetSpeedState(100 * KMH, { ...HEADING_FOR_APEX, fromReference: false })
    ).toBeNull();
    expect(targetSpeedState(100 * KMH, null)).toBeNull();
  });
});
