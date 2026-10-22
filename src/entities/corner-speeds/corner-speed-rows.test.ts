import { describe, expect, it } from 'vitest';

import type { CornerSpeedsFrame } from '@shared/contracts/generated/bindings';
import { cornerSpeedRows } from './corner-speed-rows';

const frameOf = (passed: [boolean, boolean, boolean]): CornerSpeedsFrame => ({
  entry: 60,
  apex: 25,
  exit: 40,
  entryPassed: passed[0],
  apexPassed: passed[1],
  exitPassed: passed[2],
  fromReference: true,
});

describe('cornerSpeedRows', () => {
  it('shows the figures unlit on the approach', () => {
    expect(cornerSpeedRows(frameOf([false, false, false]))).toEqual([
      { point: 'entry', value: 60, reached: false },
      { point: 'apex', value: 25, reached: false },
      { point: 'exit', value: 40, reached: false },
    ]);
  });

  it('lights each point the car has passed', () => {
    const rows = cornerSpeedRows(frameOf([true, true, false]));

    expect(rows.map((row) => row.reached)).toEqual([true, true, false]);
  });

  it('is empty with no frame', () => {
    const rows = cornerSpeedRows(null);

    expect(rows.every((row) => row.value === null && !row.reached)).toBe(true);
  });
});
