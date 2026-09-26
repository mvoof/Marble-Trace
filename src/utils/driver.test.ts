import { describe, expect, it } from 'vitest';

import { getIncidentPenaltyStatus, isNearIncidentPenalty } from './driver';

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

describe('isNearIncidentPenalty', () => {
  it('warns within the margin of the next penalty', () => {
    expect(isNearIncidentPenalty(6, { served: 0, nextAt: 8 })).toBe(true);
    expect(isNearIncidentPenalty(5, { served: 0, nextAt: 8 })).toBe(false);
  });

  it('stays quiet with no penalty ahead', () => {
    expect(isNearIncidentPenalty(15, { served: 2, nextAt: null })).toBe(false);
    expect(isNearIncidentPenalty(15, null)).toBe(false);
  });
});
