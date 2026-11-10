import { describe, expect, it } from 'vitest';

import {
  getIncidentPenaltyStatus,
  isNearIncidentLimit,
  isNearIncidentPenalty,
  parseDriverFlags,
  trackGapMeters,
} from './driver';

describe('trackGapMeters', () => {
  it('scales the lap fraction by the track length, keeping the sign', () => {
    expect(trackGapMeters(0.1, 5000)).toBe(500);
    expect(trackGapMeters(-0.02, 5000)).toBe(-100);
  });

  it('is null until the track length is known', () => {
    expect(trackGapMeters(0.1, null)).toBeNull();
    expect(trackGapMeters(0.1, 0)).toBeNull();
  });
});

const INITIAL = 8;
const SUBSEQUENT = 4;
const LIMIT = 17;

describe('getIncidentPenaltyStatus', () => {
  it('is null when the session gives no penalties', () => {
    expect(
      getIncidentPenaltyStatus(5, { initial: null, subsequent: 4, limit: 17 })
    ).toBeNull();
  });

  it('is null when the first penalty sits at or past the DQ limit', () => {
    expect(
      getIncidentPenaltyStatus(5, { initial: 17, subsequent: 4, limit: 17 })
    ).toBeNull();
  });

  it('points at the first penalty before it is reached', () => {
    expect(
      getIncidentPenaltyStatus(3, {
        initial: INITIAL,
        subsequent: SUBSEQUENT,
        limit: LIMIT,
      })
    ).toEqual({ served: 0, nextAt: 8 });
  });

  it('counts each further penalty every `subsequent` incidents', () => {
    const rules = { initial: INITIAL, subsequent: SUBSEQUENT, limit: null };

    expect(getIncidentPenaltyStatus(8, rules)).toEqual({
      served: 1,
      nextAt: 12,
    });
    expect(getIncidentPenaltyStatus(13, rules)).toEqual({
      served: 2,
      nextAt: 16,
    });
  });

  it('drops the next penalty once it would land on the DQ', () => {
    expect(
      getIncidentPenaltyStatus(13, {
        initial: INITIAL,
        subsequent: SUBSEQUENT,
        limit: 16,
      })
    ).toEqual({ served: 2, nextAt: null });
  });

  it('counts no penalty at or past the DQ limit', () => {
    expect(
      getIncidentPenaltyStatus(20, {
        initial: INITIAL,
        subsequent: SUBSEQUENT,
        limit: LIMIT,
      })
    ).toEqual({ served: 3, nextAt: null });
  });

  it('gives a single penalty when there is no subsequent step', () => {
    expect(
      getIncidentPenaltyStatus(10, {
        initial: INITIAL,
        subsequent: null,
        limit: null,
      })
    ).toEqual({ served: 1, nextAt: null });
  });
});

describe('isNearIncidentLimit', () => {
  it('warns within five incidents of the limit, whatever the limit', () => {
    expect(isNearIncidentLimit(12, 17)).toBe(true);
    expect(isNearIncidentLimit(11, 17)).toBe(false);
    expect(isNearIncidentLimit(45, 50)).toBe(true);
    expect(isNearIncidentLimit(17, 50)).toBe(false);
  });

  it('stays quiet when the session has no limit', () => {
    expect(isNearIncidentLimit(40, null)).toBe(false);
  });
});

describe('isNearIncidentPenalty', () => {
  it('warns within the margin of the next penalty', () => {
    expect(isNearIncidentPenalty(3, { served: 0, nextAt: 8 })).toBe(true);
    expect(isNearIncidentPenalty(2, { served: 0, nextAt: 8 })).toBe(false);
  });

  it('stays quiet with no penalty ahead', () => {
    expect(isNearIncidentPenalty(15, { served: 2, nextAt: null })).toBe(false);
    expect(isNearIncidentPenalty(15, null)).toBe(false);
  });
});

// The sim's own bits, as `CarIdxSessionFlags` carries them.
const BLACK_BIT = 0x00010000;
const DISQUALIFY_BIT = 0x00020000;
const FURLED_BIT = 0x00080000;

describe('parseDriverFlags', () => {
  it('names each black-flag bit the way the flag widgets do', () => {
    expect(parseDriverFlags(BLACK_BIT)).toBe('black');
    expect(parseDriverFlags(FURLED_BIT)).toBe('furled');
    expect(parseDriverFlags(DISQUALIFY_BIT)).toBe('dq');
  });

  it('shows the penalty to serve over the slowdown', () => {
    expect(parseDriverFlags(BLACK_BIT | FURLED_BIT)).toBe('black');
  });
});
