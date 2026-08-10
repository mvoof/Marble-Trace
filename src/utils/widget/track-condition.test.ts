import { describe, expect, it } from 'vitest';

import {
  nextTrackCondition,
  trackConditionForWetness,
} from './track-condition';

describe('trackConditionForWetness', () => {
  it('treats a missing reading as dry', () => {
    expect(trackConditionForWetness(null)).toBe('dry');
  });

  it('turns wet at the threshold', () => {
    expect(trackConditionForWetness(2)).toBe('dry');
    expect(trackConditionForWetness(3)).toBe('wet');
  });
});

describe('nextTrackCondition', () => {
  it('classifies from scratch when there is no current condition', () => {
    expect(nextTrackCondition(null, 3)).toBe('wet');
    expect(nextTrackCondition(null, 2)).toBe('dry');
  });

  it('turns wet on the first reading at the threshold', () => {
    expect(nextTrackCondition('dry', 3)).toBe('wet');
  });

  it('holds wet while the reading hovers on the boundary', () => {
    expect(nextTrackCondition('wet', 2)).toBe('wet');
    expect(nextTrackCondition('wet', 3)).toBe('wet');
  });

  it('returns to dry only on a clearly drier track', () => {
    expect(nextTrackCondition('wet', 1)).toBe('dry');
    expect(nextTrackCondition('wet', 0)).toBe('dry');
  });
});
