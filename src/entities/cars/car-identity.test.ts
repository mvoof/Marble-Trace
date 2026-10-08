import { describe, expect, it } from 'vitest';

import type { DriverEntry } from '@shared/contracts/driver-entry';

import { CarIdentityCache, carIdentityOf } from './car-identity';

const makeEntry = (overrides: Partial<DriverEntry> = {}): DriverEntry =>
  ({
    carIdx: 7,
    position: 3,
    userName: 'Driver 7',
    lapDistPct: 0.25,
    relativeLapDist: 0.1,
    estTime: 41.2,
    f2Time: 3.4,
    speed: 61.5,
    ...overrides,
  }) as DriverEntry;

describe('carIdentityOf', () => {
  it('keeps what is drawn and drops what moves every tick', () => {
    expect(carIdentityOf(makeEntry())).toEqual({
      carIdx: 7,
      position: 3,
      userName: 'Driver 7',
    });
  });
});

describe('CarIdentityCache', () => {
  it('hands back the same identity while only moving fields change', () => {
    const cache = new CarIdentityCache();
    const [first] = cache.identitiesOf([makeEntry()]);
    const [second] = cache.identitiesOf([
      makeEntry({ lapDistPct: 0.3, speed: 62, estTime: 40.9 }),
    ]);

    expect(second).toBe(first);
  });

  it('builds a new identity once a drawn field changes', () => {
    const cache = new CarIdentityCache();
    const [first] = cache.identitiesOf([makeEntry()]);
    const [second] = cache.identitiesOf([makeEntry({ position: 2 })]);

    expect(second).not.toBe(first);
    expect(second.position).toBe(2);
  });

  it('forgets every car on clear', () => {
    const cache = new CarIdentityCache();
    const [first] = cache.identitiesOf([makeEntry()]);

    cache.clear();

    expect(cache.identitiesOf([makeEntry()])[0]).not.toBe(first);
  });
});
