import { describe, expect, it } from 'vitest';

import type { CornerSpeedsFrame } from '@shared/contracts/generated/bindings';
import { cornerSpeedRows } from './corner-speed-rows';

const frameOf = (
  passed: [boolean, boolean, boolean],
  fromReference = true
): CornerSpeedsFrame => ({
  entry: 60,
  apex: 25,
  exit: 40,
  entryPassed: passed[0],
  apexPassed: passed[1],
  exitPassed: passed[2],
  fromReference,
});

const litOf = (frame: CornerSpeedsFrame): boolean[] =>
  cornerSpeedRows(frame).map((row) => row.lit);

describe('cornerSpeedRows', () => {
  it('lights the reference point the car is heading for, one at a time', () => {
    expect(litOf(frameOf([false, false, false]))).toEqual([true, false, false]);
    expect(litOf(frameOf([true, false, false]))).toEqual([false, true, false]);
    expect(litOf(frameOf([true, true, false]))).toEqual([false, false, true]);
    expect(litOf(frameOf([true, true, true]))).toEqual([false, false, true]);
  });

  it('lights the car’s own point it passed last', () => {
    expect(litOf(frameOf([false, false, false], false))).toEqual([
      false,
      false,
      false,
    ]);
    expect(litOf(frameOf([true, false, false], false))).toEqual([
      true,
      false,
      false,
    ]);
    expect(litOf(frameOf([true, true, true], false))).toEqual([
      false,
      false,
      true,
    ]);
  });

  it('keeps the figures in order', () => {
    expect(
      cornerSpeedRows(frameOf([false, false, false])).map((row) => row.value)
    ).toEqual([60, 25, 40]);
  });

  it('is empty with no frame', () => {
    const rows = cornerSpeedRows(null);

    expect(rows.every((row) => row.value === null && !row.lit)).toBe(true);
  });
});
