import { describe, expect, it } from 'vitest';

import { formatLapDeployMj } from './battery-utils';

describe('formatLapDeployMj', () => {
  it('holds one width from no reading through negative to past 10 MJ', () => {
    const widths = [null, 0, 1_940_000, -350_000, 12_340_000].map(
      (joules) => formatLapDeployMj(joules).length
    );

    expect(new Set(widths).size).toBe(1);
  });

  it('writes a harvesting lap with a true minus sign', () => {
    expect(formatLapDeployMj(-350_000).trim()).toBe('−0.35');
  });
});
