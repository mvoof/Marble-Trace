import { describe, expect, it } from 'vitest';

import { cornerSpeedRows } from './corner-speed-rows';

const TARGET = { entry: 60, apex: 25, exit: 40 };

describe('cornerSpeedRows', () => {
  it('shows every target dimmed on the approach', () => {
    const rows = cornerSpeedRows({ current: null, target: TARGET });

    expect(rows).toEqual([
      { point: 'entry', value: 60, reached: false },
      { point: 'apex', value: 25, reached: false },
      { point: 'exit', value: 40, reached: false },
    ]);
  });

  it('lights the entry past the brake point and keeps the rest as targets', () => {
    const rows = cornerSpeedRows({
      current: { entry: 62, apex: 30, apexPassed: false, exit: null },
      target: TARGET,
    });

    expect(rows.map((row) => [row.value, row.reached])).toEqual([
      [62, true],
      [25, false],
      [40, false],
    ]);
  });

  it('lights each point as the car reaches it', () => {
    const rows = cornerSpeedRows({
      current: { entry: 62, apex: 27, apexPassed: true, exit: 41 },
      target: TARGET,
    });

    expect(rows.map((row) => [row.value, row.reached])).toEqual([
      [62, true],
      [27, true],
      [41, true],
    ]);
  });

  it('falls back to the live lowest speed with no reference lap', () => {
    const rows = cornerSpeedRows({
      current: { entry: 62, apex: 30, apexPassed: false, exit: null },
      target: null,
    });

    expect(rows[1]).toEqual({
      point: 'apex',
      value: 30,
      reached: false,
    });
    expect(rows[2].value).toBeNull();
  });

  it('is empty with nothing to show', () => {
    const rows = cornerSpeedRows(null);

    expect(rows.every((row) => row.value === null && !row.reached)).toBe(true);
  });
});
