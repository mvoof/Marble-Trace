import { describe, expect, it } from 'vitest';

import { summarize } from './stats';

describe('summarize', () => {
  it('returns null for an empty cell', () => {
    expect(summarize([])).toBeNull();
  });

  it('reports the median regardless of input order', () => {
    const ascending = summarize([10, 20, 30, 40, 50]);
    const shuffled = summarize([30, 50, 10, 40, 20]);

    expect(ascending?.median).toBe(30);
    expect(shuffled?.median).toBe(30);
  });

  it('keeps a single outlier out of the median', () => {
    const stats = summarize([60, 60, 61, 59, 60, 5]);

    expect(stats?.median).toBeGreaterThan(55);
  });

  it('brackets the samples with the low and high percentiles', () => {
    const stats = summarize([50, 55, 60, 65, 70, 75, 80, 85, 90, 95]);

    expect(stats?.low).toBeLessThanOrEqual(stats?.median ?? 0);
    expect(stats?.high).toBeGreaterThanOrEqual(stats?.median ?? 0);
    expect(stats?.samples).toBe(10);
  });

  it('collapses to the only sample when just one arrived', () => {
    const stats = summarize([42]);

    expect(stats).toEqual({ samples: 1, median: 42, low: 42, high: 42 });
  });
});
