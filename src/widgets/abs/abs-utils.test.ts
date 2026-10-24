import { describe, expect, it } from 'vitest';

import { computeAbsDesignWidth } from './abs-utils';

describe('computeAbsDesignWidth', () => {
  it('is the shipped plate with the level shown', () => {
    expect(computeAbsDesignWidth({ showLevel: true })).toBe(150);
  });

  it('narrows to the badge alone without it', () => {
    expect(computeAbsDesignWidth({ showLevel: false })).toBe(92);
  });
});
