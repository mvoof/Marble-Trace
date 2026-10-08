import { describe, expect, it } from 'vitest';

import { ARRAY_PAGE, buildRows, countAbsent } from './inspector-tree';

const frame = {
  car_dynamics: { speed: 42.123456, gear: 3 },
  car_idx: {
    car_idx_lap_dist_pct: [0.1, 0.2, 0.3],
    spotter: null,
  },
};

const options = (over: Partial<Parameters<typeof buildRows>[1]> = {}) => ({
  expanded: new Set<string>(),
  filter: '',
  hideAbsent: false,
  arrayLimits: new Map<string, number>(),
  ...over,
});

const paths = (rows: { path: string }[]) => rows.map((row) => row.path);

describe('buildRows', () => {
  it('shows only the top level while nothing is open', () => {
    expect(paths(buildRows(frame, options()))).toEqual([
      'car_dynamics',
      'car_idx',
    ]);
  });

  it('descends into an opened branch', () => {
    const rows = buildRows(
      frame,
      options({ expanded: new Set(['car_dynamics']) })
    );

    expect(paths(rows)).toEqual([
      'car_dynamics',
      'car_dynamics.speed',
      'car_dynamics.gear',
      'car_idx',
    ]);
  });

  // The complaint this replaced: an array printed inline behind an ellipsis
  // answers nothing about a sixty-three car field.
  it('lists array entries by index when the array is opened', () => {
    const rows = buildRows(
      frame,
      options({
        expanded: new Set(['car_idx', 'car_idx.car_idx_lap_dist_pct']),
      })
    );

    expect(paths(rows)).toContain('car_idx.car_idx_lap_dist_pct.0');
    expect(paths(rows)).toContain('car_idx.car_idx_lap_dist_pct.2');
  });

  it('caps a long array until the cap is lifted for it', () => {
    const long = { values: Array.from({ length: ARRAY_PAGE + 10 }, () => 0) };
    const expanded = new Set(['values']);

    expect(buildRows(long, options({ expanded }))).toHaveLength(ARRAY_PAGE + 1);

    const lifted = buildRows(
      long,
      options({
        expanded,
        arrayLimits: new Map([['values', ARRAY_PAGE + 10]]),
      })
    );

    expect(lifted).toHaveLength(ARRAY_PAGE + 11);
  });

  it('marks a branch expandable and reports an array length', () => {
    const rows = buildRows(frame, options({ expanded: new Set(['car_idx']) }));
    const array = rows.find(
      (row) => row.path === 'car_idx.car_idx_lap_dist_pct'
    );

    expect(array?.expandable).toBe(true);
    expect(array?.length).toBe(3);
  });

  it('does not offer to expand an empty array', () => {
    const rows = buildRows({ nothing: [] }, options());

    expect(rows[0].expandable).toBe(false);
  });

  // Without this, searching for a leaf finds nothing unless its parent happens
  // to be open — which is the opposite of what a search is for.
  it('keeps a parent whose descendant matches the filter', () => {
    const rows = buildRows(frame, options({ filter: 'gear' }));

    expect(paths(rows)).toEqual(['car_dynamics']);
  });

  it('matches case-insensitively', () => {
    expect(paths(buildRows(frame, options({ filter: 'spott' })))).toEqual([
      'car_idx',
    ]);
  });

  it('can hide what the sim does not report', () => {
    const rows = buildRows(
      frame,
      options({ expanded: new Set(['car_idx']), hideAbsent: true })
    );

    expect(paths(rows)).not.toContain('car_idx.spotter');
  });

  it('returns nothing when there is no source yet', () => {
    expect(buildRows(null, options())).toEqual([]);
  });
});

describe('countAbsent', () => {
  it('counts leaves the sim is not reporting, at any depth', () => {
    expect(countAbsent(frame)).toBe(1);
  });

  // An empty slot in a per-car array means "no car there", not "the sim failed
  // to report this field".
  it('does not count array entries', () => {
    expect(countAbsent({ group: { values: [null, null] } })).toBe(0);
  });

  it('is zero without a source', () => {
    expect(countAbsent(null)).toBe(0);
  });
});
