import { describe, expect, it } from 'vitest';

import type { CatalogueCar } from '@shared/contracts/generated/bindings';
import type { AutoSwitchRule } from '@shared/contracts/widget-settings';

import {
  layoutHolding,
  playerCarClass,
  ruleLayoutFor,
  type AutoSwitchSituation,
} from './auto-switch-rules';

const MERCEDES_GT3 = 156;
const PORSCHE_CUP = 143;

const rule = (
  layoutId: string,
  conditions: Partial<Omit<AutoSwitchRule, 'id' | 'layoutId'>> = {}
): AutoSwitchRule => ({
  id: layoutId,
  context: null,
  carClass: null,
  carId: null,
  layoutId,
  ...conditions,
});

const raceInMercedes: AutoSwitchSituation = {
  context: 'Race',
  carClass: 'GT3',
  carId: MERCEDES_GT3,
};

describe('ruleLayoutFor', () => {
  it('picks the rule of the session context', () => {
    const rules = [
      rule('practice', { context: 'Practice' }),
      rule('race', { context: 'Race' }),
    ];

    expect(ruleLayoutFor(rules, raceInMercedes)).toBe('race');
  });

  it('answers null when no rule matches', () => {
    const rules = [rule('practice', { context: 'Practice' })];

    expect(ruleLayoutFor(rules, raceInMercedes)).toBeNull();
  });

  it('takes a class rule over a session rule', () => {
    const rules = [
      rule('race', { context: 'Race' }),
      rule('gt3', { carClass: 'GT3' }),
    ];

    expect(ruleLayoutFor(rules, raceInMercedes)).toBe('gt3');
  });

  it('takes a car rule over a class and session rule', () => {
    const rules = [
      rule('gt3-race', { context: 'Race', carClass: 'GT3' }),
      rule('mercedes', { carId: MERCEDES_GT3 }),
    ];

    expect(ruleLayoutFor(rules, raceInMercedes)).toBe('mercedes');
  });

  it('takes the car rule of the session over the car rule of any session', () => {
    const rules = [
      rule('mercedes', { carId: MERCEDES_GT3 }),
      rule('mercedes-race', { context: 'Race', carId: MERCEDES_GT3 }),
    ];

    expect(ruleLayoutFor(rules, raceInMercedes)).toBe('mercedes-race');
  });

  it('skips a rule naming another car or class', () => {
    const rules = [
      rule('porsche', { carId: PORSCHE_CUP }),
      rule('gtp', { carClass: 'GTP' }),
      rule('any'),
    ];

    expect(ruleLayoutFor(rules, raceInMercedes)).toBe('any');
  });

  it('skips a car or class rule while the car is unknown', () => {
    const rules = [rule('mercedes', { carId: MERCEDES_GT3 }), rule('any')];

    expect(
      ruleLayoutFor(rules, { context: 'Garage', carClass: null, carId: null })
    ).toBe('any');
  });

  it('decides a session rule and a class rule by specificity, in either order', () => {
    const rules = [
      rule('gt3', { carClass: 'GT3' }),
      rule('race', { context: 'Race' }),
    ];

    expect(ruleLayoutFor(rules, raceInMercedes)).toBe('gt3');
    expect(ruleLayoutFor([...rules].reverse(), raceInMercedes)).toBe('gt3');
  });
});

describe('layoutHolding', () => {
  const rules = [
    rule('race', { context: 'Race' }),
    rule('race-gt3', { context: 'Race', carClass: 'GT3' }),
    rule('mercedes', { carId: MERCEDES_GT3 }),
  ];

  it('names the layout of a rule with exactly that situation', () => {
    expect(
      layoutHolding(rules, { context: 'Race', carClass: 'GT3', carId: null })
    ).toBe('race-gt3');
    expect(
      layoutHolding(rules, {
        context: null,
        carClass: null,
        carId: MERCEDES_GT3,
      })
    ).toBe('mercedes');
  });

  it('answers null for a situation no rule names, however it overlaps', () => {
    expect(
      layoutHolding(rules, { context: null, carClass: 'GT3', carId: null })
    ).toBeNull();
    expect(
      layoutHolding(rules, {
        context: 'Race',
        carClass: null,
        carId: MERCEDES_GT3,
      })
    ).toBeNull();
  });
});

describe('playerCarClass', () => {
  const catalogue: CatalogueCar[] = [
    {
      carId: MERCEDES_GT3,
      name: 'Mercedes-AMG GT3 2020',
      badge: 'GT3',
      retired: false,
    },
  ];

  it("is the catalogue's badge of the player's car, whatever the session class", () => {
    expect(
      playerCarClass(catalogue, {
        carId: MERCEDES_GT3,
        carName: 'Mercedes-AMG GT3 2020',
        carClass: 'All Cars',
      })
    ).toBe('GT3');
  });

  it('falls back to the session class for a car the catalogue lacks', () => {
    expect(
      playerCarClass(catalogue, {
        carId: 999,
        carName: 'Brand New Car',
        carClass: 'GT3',
      })
    ).toBe('GT3');
  });

  it('is null with no car', () => {
    expect(playerCarClass(catalogue, null)).toBeNull();
  });
});
